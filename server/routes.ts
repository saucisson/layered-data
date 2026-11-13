// ============================================================
// Layered Data — the routes: quarry API, geologist, editor
// session (SSE), static host
//
// The quarry API is `api/layers` — the workshop protocol, one shape
// for every client.
// ============================================================
import { createServer } from "node:http";
import { readFileSync, existsSync } from "node:fs";
import { join, extname } from "node:path";
import { randomUUID } from "node:crypto";

import { composeVerifiedLayerDraft } from "../src/application/penLoop.ts";
import {
  VERSION,
  DIST_DIRECTORY,
  MAX_PEN_ATTEMPTS,
  STRICT_CONFLICTS,
  STRICT_CHECKS,
  DATABASE_URL,
  RATE_LIMIT_WINDOW_SECONDS,
  GENERATE_MAX_REQUESTS,
  POST_MAX_REQUESTS,
  EDITOR_SESSION_HISTORY_DEPTH,
} from "./config.ts";
import {
  KERNEL_LAYER_NAMES,
  KERNEL_LANGUAGE_SOURCE,
  asLayerName,
  type LayerName,
} from "./layerStore.ts";
import { lookupLayer } from "./userLayerStore.ts";
import { createQuarryStoresFromEnv, type QuarryStores } from "./stores.ts";
import { PenInfraFailure, generateLayer } from "./mistralClient.ts";
import {
  editorSession,
  editorClients,
  ensureEditorSessionLoaded,
  persistEditorSession,
  editorSessionHistory,
  setEditorSessionStore,
  sendEvent,
  sessionSnapshot,
  broadcastEditorState,
  broadcastEditorPresence,
} from "./editorSessionServer.ts";
import {
  applySecurityHeaders,
  sendJson,
  sendText,
  rateLimitKeyOf,
  readRequestBody,
  resolveIdentity,
  sourceOfRequestBody,
} from "./httpUtils.ts";
import {
  createPostgresRateLimitStore,
  createRateLimiter,
  type RateLimitDecision,
  type RateLimitStore,
} from "./rateLimit.ts";

/** The API rate limiters (issue #85): PostgreSQL-backed fixed windows
 * per client key, shared by every server instance. Without
 * DATABASE_URL (local dev, tests) they are null and POSTs pass
 * through — a startup warning says so. */
function createApiRateLimiters(): {
  generate: ((key: string) => Promise<RateLimitDecision>) | null;
  post: ((key: string) => Promise<RateLimitDecision>) | null;
} {
  if (!DATABASE_URL) return { generate: null, post: null };
  let storePromise: Promise<RateLimitStore> | null = null;
  const lazyStore: RateLimitStore = {
    increment: (args) => (storePromise ??= createPostgresRateLimitStore({ databaseUrl: DATABASE_URL })).then((store) => store.increment(args)),
  };
  return {
    generate: createRateLimiter({
      store: lazyStore,
      maxRequests: GENERATE_MAX_REQUESTS,
      windowSeconds: RATE_LIMIT_WINDOW_SECONDS,
    }),
    post: createRateLimiter({
      store: lazyStore,
      maxRequests: POST_MAX_REQUESTS,
      windowSeconds: RATE_LIMIT_WINDOW_SECONDS,
    }),
  };
}

export function createQuarryServer({
  stores = createQuarryStoresFromEnv(),
}: {
  stores?: QuarryStores;
} = {}) {
  setEditorSessionStore({ editorSessionStore: stores.editorSession });
  const rateLimiters = createApiRateLimiters();
  return createServer(async (request, response) => {
    applySecurityHeaders({ response });
    const url = new URL(request.url ?? "/", "http://" + (request.headers.host ?? "localhost"));
    const segments = url.pathname.split("/").filter(Boolean);

    try {
      // ---- the quarry and geologist API ----
      if (segments[0] === "api") {
        // Rate limit before the auth check: the counters also blunt
        // brute force on the access code. /api/generate (the Mistral
        // call) gets the strict window, the other POSTs a wider one.
        if (request.method === "POST") {
          const limiter = url.pathname === "/api/generate" ? rateLimiters.generate : rateLimiters.post;
          if (limiter !== null) {
            const decision = await limiter(rateLimitKeyOf({ request }));
            if (!decision.allowed) {
              response.setHeader("Retry-After", String(decision.retryAfterSeconds));
              return sendJson({
                response,
                statusCode: 429,
                body: {
                  erreur: `trop de requêtes — réessayez dans ${decision.retryAfterSeconds}s`,
                  remaining: 0,
                },
              });
            }
          }
        }

        if (url.pathname === "/api/whoami") {
          const identity = resolveIdentity({ request });
          if (identity.kind === "anonymous-local") {
            return sendJson({ response, statusCode: 401, body: { erreur: "code d'accès requis" } });
          }
          // A personal access code resolves to the user profile
          // (issue #140, ADR-0114); the shared code keeps the legacy
          // porteur-du-code identity.
          if (identity.kind === "personal-code") {
            const profile = await stores.users.findByAccessCodeHash({
              accessCodeHash: identity.accessCodeHash,
            });
            if (profile === null) {
              return sendJson({
                response,
                statusCode: 401,
                body: { erreur: "code d'accès personnel inconnu" },
              });
            }
            return sendJson({
              response,
              statusCode: 200,
              body: {
                version: VERSION,
                utilisateur: profile.displayName,
                identity: identity.kind,
                user: {
                  id: profile.id,
                  displayName: profile.displayName,
                  role: profile.role,
                },
              },
            });
          }
          return sendJson({
            response,
            statusCode: 200,
            body: {
              version: VERSION,
              utilisateur: "porteur-du-code",
              identity: identity.kind,
            },
          });
        }
        // Resolve the access: the shared code or a personal code
        // with a matching user row (issue #140, ADR-0114).
        const identity = resolveIdentity({ request });
        let ownerId: number | undefined;
        if (identity.kind === "shared-code") {
          // the legacy shared identity — no owner scoping
        } else if (identity.kind === "personal-code") {
          const profile = await stores.users.findByAccessCodeHash({
            accessCodeHash: identity.accessCodeHash,
          });
          if (profile === null) {
            return sendJson({
              response,
              statusCode: 401,
              body: { erreur: "code d'accès requis" },
            });
          }
          ownerId = profile.id;
        } else {
          return sendJson({ response, statusCode: 401, body: { erreur: "code d'accès requis" } });
        }

        // ---- the workshop protocol: api/layers ----
        if (request.method === "GET" && url.pathname === "/api/layers") {
          const userNames = await stores.userLayers.listNames(
            ownerId === undefined ? {} : { ownerId },
          );
          const layers = [
            ...KERNEL_LAYER_NAMES.map((name) => ({ name, builtIn: true })),
            ...userNames.map((name) => ({
              name,
              builtIn: false,
            })),
          ];
          return sendJson({ response, statusCode: 200, body: { layers } });
        }

        if (segments[1] === "layers" && segments[2]) {
          const nameCheck = asLayerName({ candidate: segments[2] });
          if ("reason" in nameCheck)
            return sendJson({ response, statusCode: 400, body: { erreur: nameCheck.reason } });
          const name = nameCheck.name;

          if (request.method === "GET") {
            const lookup = await lookupLayer({ name, userLayerStore: stores.userLayers });
            if (!lookup.found)
              return sendJson({
                response,
                statusCode: 404,
                body: { erreur: "couche inconnue : " + name },
              });
            return sendJson({
              response,
              statusCode: 200,
              body: { name, builtIn: lookup.location === "kernel", source: lookup.source },
            });
          }

          if (request.method === "PUT") {
            if (KERNEL_LAYER_NAMES.includes(name)) {
              return sendJson({
                response,
                statusCode: 403,
                body: { erreur: "le socle est en lecture seule : " + name },
              });
            }
            const bodyCheck = sourceOfRequestBody({ rawBody: await readRequestBody({ request }) });
            if ("reason" in bodyCheck)
              return sendJson({ response, statusCode: 400, body: { erreur: bodyCheck.reason } });
            const { created } = await stores.userLayers.write({
              name,
              source: bodyCheck.source,
              ownerId,
            });
            return sendJson({
              response,
              statusCode: created ? 201 : 200,
              body: { name, builtIn: false, écrit: true },
            });
          }
        }

        // ---- freeze a formalism (issue #155, ADR-0116): timestamped
        // snapshot, version stamp assigned by the classifier ----
        if (request.method === "POST" && segments[1] === "formalisms" && segments[2] && segments[3] === "freeze") {
          const nameCheck = asLayerName({ candidate: segments[2] });
          if ("reason" in nameCheck)
            return sendJson({ response, statusCode: 400, body: { erreur: nameCheck.reason } });
          const name = nameCheck.name;
          if (KERNEL_LAYER_NAMES.includes(name)) {
            return sendJson({
              response,
              statusCode: 403,
              body: { erreur: "le socle est déjà figé : " + name },
            });
          }
          const lookup = await lookupLayer({ name, userLayerStore: stores.userLayers });
          if (!lookup.found || lookup.location !== "users")
            return sendJson({
              response,
              statusCode: 404,
              body: { erreur: "formalisme inconnu : " + name },
            });
          const { classifyVersionDiff } = await import("../src/domain/versionClassifier.ts");
          const { parseLanguage } = await import("../src/domain/language/parser.ts");
          const { compileLanguage } = await import("../src/domain/language/compiler.ts");
          const { nextSemVer, resolveBareName, insertFrozenVersion } = await import(
            "./formalismVersionStore.ts"
          );
          let previousSemver: string | null = null;
          let previousSource: string | null = null;
          if (DATABASE_URL) {
            const { Pool } = await import("pg");
            const pool = new Pool({ connectionString: DATABASE_URL });
            try {
              const resolved = await resolveBareName({ pool, formalismId: name });
              previousSemver = resolved?.semver ?? null;
              previousSource = resolved?.source ?? null;
            } finally {
              await pool.end();
            }
          }
          const level =
            previousSource === null
              ? "MINOR"
              : classifyVersionDiff({
                  previous: compileLanguage(parseLanguage(previousSource).layers).layers[name] ?? {},
                  next: compileLanguage(parseLanguage(lookup.source).layers).layers[name] ?? {},
                });
          const semver = nextSemVer({ previousSemver, level });
          const frozenAt = new Date().toISOString();
          if (DATABASE_URL) {
            const { Pool } = await import("pg");
            const pool = new Pool({ connectionString: DATABASE_URL });
            try {
              await insertFrozenVersion({
                pool,
                formalismId: name,
                semver,
                source: lookup.source,
                dumpFingerprint: null,
              });
            } finally {
              await pool.end();
            }
          }
          return sendJson({
            response,
            statusCode: 201,
            body: { name, semver, status: "frozen", frozenAt, persisted: DATABASE_URL !== "" },
          });
        }

        // ---- the geologist: prompt (workshop protocol) or instruction
        // (compatibility), answered with a STAGED draft in plain
        // text. Every proposal is judged by the exact staging the
        // workshop applies; a refusal travels back to the model
        // with its verdicts, up to MAX_PEN_ATTEMPTS propositions ----
        if (request.method === "POST" && url.pathname === "/api/generate") {
          const body = JSON.parse((await readRequestBody({ request })) || "{}") as {
            prompt?: unknown;
            instruction?: unknown;
          };
          const instruction = body?.prompt ?? body?.instruction;
          if (typeof instruction !== "string" || !instruction.trim()) {
            return sendJson({
              response,
              statusCode: 400,
              body: { erreur: 'corps JSON attendu : { "prompt": "…" }' },
            });
          }
          // The living context of the loop: the kernel once, the
          // visitors' layers read at the call through the store —
          // a layer written seconds ago stays refinable for the
          // geologist.
          const userNames = await stores.userLayers.listNames(
            ownerId === undefined ? {} : { ownerId },
          );
          const visitorLayers: { name: string; source: string }[] = [];
          for (const name of userNames) {
            const read = await stores.userLayers.read({ name: name as LayerName });
            if (read.found) visitorLayers.push({ name, source: read.source });
          }
          const previousAdditionSources = visitorLayers.map((visitorLayer) => visitorLayer.source);
          try {
            const loopOutcome = await composeVerifiedLayerDraft({
              instruction,
              languageSource: KERNEL_LANGUAGE_SOURCE,
              livingLayerNames: [...KERNEL_LAYER_NAMES, ...userNames],
              readonlyLayerNames: [...KERNEL_LAYER_NAMES],
              previousAdditionSources,
              maxAttempts: MAX_PEN_ATTEMPTS,
              strictConflicts: STRICT_CONFLICTS,
              strictChecks: STRICT_CHECKS,
              propose: async ({ instruction, feedback }) => {
                const generated = await generateLayer({ instruction, feedback, visitorLayers });
                if (generated.statusCode !== 200) {
                  throw new PenInfraFailure({
                    statusCode: generated.statusCode,
                    body: generated.body,
                  });
                }
                return generated.body;
              },
            });
            if (loopOutcome.ok && loopOutcome.draftSource !== null) {
              return sendText({ response, statusCode: 200, body: loopOutcome.draftSource });
            }
            // The budget is spent: the refusal speaks — the last
            // feedback, the verdicts the model ignored. The client
            // shows it and falls back to its own staging.
            const lastRefusal = loopOutcome.refusals[loopOutcome.refusals.length - 1];
            return sendText({
              response,
              statusCode: 422,
              body:
                "le géologue n'a pas produit de couche acceptable en " +
                loopOutcome.attempts +
                " propositions — dernier refus :\n" +
                (lastRefusal?.feedback ?? ""),
            });
          } catch (error) {
            if (error instanceof PenInfraFailure) {
              return sendText({ response, statusCode: error.statusCode, body: error.body });
            }
            throw error;
          }
        }

        // ---- the shared editor session (ADR-0110) ----
        if (url.pathname === "/api/editor/session" && request.method === "GET") {
          await ensureEditorSessionLoaded();
          const clientId = randomUUID();
          response.writeHead(200, {
            "Content-Type": "text/event-stream; charset=utf-8",
            "Cache-Control": "no-cache",
            Connection: "keep-alive",
          });
          response.write("retry: 3000\n\n");
          editorClients.set(clientId, { response, focus: null });
          sendEvent({ response, event: "hello", data: { clientId } });
          sendEvent({ response, event: "state", data: sessionSnapshot() });
          // the heartbeat keeps proxies from closing the idle stream
          const heartbeat = setInterval(() => {
            response.write(": ping\n\n");
          }, 25_000);
          request.on("close", () => {
            clearInterval(heartbeat);
            editorClients.delete(clientId);
            broadcastEditorPresence();
          });
          return;
        }

        if (url.pathname === "/api/editor/presence" && request.method === "POST") {
          await ensureEditorSessionLoaded();
          const body = JSON.parse((await readRequestBody({ request })) || "{}") as {
            clientId?: unknown;
            focus?: unknown;
          };
          const client =
            typeof body?.clientId === "string" ? editorClients.get(body.clientId) : undefined;
          if (!client)
            return sendJson({ response, statusCode: 404, body: { erreur: "client inconnu" } });
          client.focus = typeof body?.focus === "string" && body.focus.trim() ? body.focus : null;
          broadcastEditorPresence();
          return sendJson({ response, statusCode: 200, body: { ok: true } });
        }

        if (url.pathname === "/api/editor/gesture" && request.method === "POST") {
          await ensureEditorSessionLoaded();
          const body = JSON.parse((await readRequestBody({ request })) || "{}") as {
            source?: unknown;
            baseVersion?: unknown;
          };
          if (
            typeof body?.source !== "string" ||
            !body.source.trim() ||
            typeof body?.baseVersion !== "number"
          ) {
            return sendJson({
              response,
              statusCode: 400,
              body: { erreur: 'corps JSON attendu : { "source": "…", "baseVersion": 0 }' },
            });
          }
          const outcome = editorSession().applyGesture({
            source: body.source,
            baseVersion: body.baseVersion,
          });
          if (outcome.ok) {
            await persistEditorSession();
            broadcastEditorState();
            return sendJson({
              response,
              statusCode: 200,
              body: { ok: true, ...sessionSnapshot() },
            });
          }
          if (outcome.reason === "conflict") {
            return sendJson({
              response,
              statusCode: 409,
              body: { ok: false, reason: "conflict", ...sessionSnapshot() },
            });
          }
          return sendJson({
            response,
            statusCode: 422,
            body: {
              ok: false,
              reason: "refused",
              refusals: outcome.refusals,
              staging: outcome.staging,
              ...sessionSnapshot(),
            },
          });
        }

        // ---- the session journal (ADR-0111): history + restore ----
        if (url.pathname === "/api/editor/history" && request.method === "GET") {
          await ensureEditorSessionLoaded();
          const limitParam = Number(url.searchParams.get("limit") ?? EDITOR_SESSION_HISTORY_DEPTH);
          const limit = Number.isFinite(limitParam)
            ? Math.min(Math.max(1, Math.floor(limitParam)), EDITOR_SESSION_HISTORY_DEPTH)
            : EDITOR_SESSION_HISTORY_DEPTH;
          const entries = await editorSessionHistory({ limit });
          return sendJson({
            response,
            statusCode: 200,
            body: {
              entries: entries.map((entry) => ({
                version: entry.version,
                additions: entry.state.additions,
              })),
            },
          });
        }

        if (url.pathname === "/api/editor/restore" && request.method === "POST") {
          await ensureEditorSessionLoaded();
          const body = JSON.parse((await readRequestBody({ request })) || "{}") as {
            version?: unknown;
            baseVersion?: unknown;
          };
          if (typeof body?.version !== "number" || typeof body?.baseVersion !== "number") {
            return sendJson({
              response,
              statusCode: 400,
              body: { erreur: 'corps JSON attendu : { "version": 1, "baseVersion": 2 }' },
            });
          }
          const entries = await editorSessionHistory({ limit: EDITOR_SESSION_HISTORY_DEPTH });
          const target = entries.find((entry) => entry.version === body.version);
          if (target === undefined) {
            return sendJson({
              response,
              statusCode: 404,
              body: { erreur: "version inconnue dans le journal : " + body.version },
            });
          }
          // the restore is re-judged by the same staging as a gesture
          // and becomes a NEW version — never a silent rewind
          const outcome = editorSession().restore({
            additions: target.state.additions,
            baseVersion: body.baseVersion,
          });
          if (outcome.ok) {
            await persistEditorSession();
            broadcastEditorState();
            return sendJson({
              response,
              statusCode: 200,
              body: { ok: true, restoredVersion: body.version, ...sessionSnapshot() },
            });
          }
          if (outcome.reason === "conflict") {
            return sendJson({
              response,
              statusCode: 409,
              body: { ok: false, reason: "conflict", ...sessionSnapshot() },
            });
          }
          return sendJson({
            response,
            statusCode: 422,
            body: {
              ok: false,
              reason: "refused",
              refusals: outcome.refusals,
              staging: outcome.staging,
              ...sessionSnapshot(),
            },
          });
        }

        return sendJson({
          response,
          statusCode: 404,
          body: { erreur: "route inconnue : " + request.method + " " + url.pathname },
        });
      }

      // ---- the static build, when it exists ----
      if (request.method === "GET") {
        if (!existsSync(DIST_DIRECTORY)) {
          return sendJson({
            response,
            statusCode: 404,
            body: { erreur: "dist/ absent — npm run build pour construire l'atelier" },
          });
        }
        const requestedPath = url.pathname === "/" ? "index.html" : url.pathname;
        let filePath = join(DIST_DIRECTORY, requestedPath);
        if (!existsSync(filePath)) filePath = join(DIST_DIRECTORY, "index.html");
        const mimeTypes: Record<string, string> = {
          ".html": "text/html; charset=utf-8",
          ".js": "text/javascript",
          ".css": "text/css",
          ".svg": "image/svg+xml",
          ".json": "application/json",
        };
        const body = readFileSync(filePath);
        response.writeHead(200, {
          "Content-Type": mimeTypes[extname(filePath)] ?? "application/octet-stream",
        });
        return response.end(body);
      }

      return sendJson({ response, statusCode: 404, body: { erreur: "route inconnue" } });
    } catch (error) {
      return sendJson({
        response,
        statusCode: 500,
        body: { erreur: String((error as Error)?.message ?? error) },
      });
    }
  });
}
