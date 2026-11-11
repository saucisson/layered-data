// ============================================================
// Layered Data — the routes: quarry API, geologist, editor
// session (SSE), static host
//
// The quarry API exists in two vocabularies: `api/layers` (the
// workshop protocol — English keys, one shape for every client)
// and `api/formalismes` (the compatibility API — French keys,
// kept for the already-published geologist clients).
// ============================================================
import { createServer } from "node:http";
import { readFileSync, existsSync } from "node:fs";
import { join, extname } from "node:path";
import { randomUUID } from "node:crypto";

import { composeVerifiedLayerDraft } from "../src/application/penLoop.ts";
import {
  VERSION,
  DIST_DIRECTORY,
  USERS_DIRECTORY,
  MAX_PEN_ATTEMPTS,
  STRICT_CONFLICTS,
  STRICT_CHECKS,
} from "./config.ts";
import {
  KERNEL_LAYER_NAMES,
  KERNEL_LANGUAGE_SOURCE,
  asLayerName,
  listLayerNames,
  lookupLayer,
  writeUserLayer,
  deleteUserLayer,
  userLayerPath,
  type LayerName,
} from "./layerStore.ts";
import { PenInfraFailure, generateLayer } from "./mistralClient.ts";
import {
  editorSession,
  editorClients,
  persistEditorSession,
  sendEvent,
  sessionSnapshot,
  broadcastEditorState,
  broadcastEditorPresence,
} from "./editorSessionServer.ts";
import {
  applySecurityHeaders,
  sendJson,
  sendText,
  isAccessGranted,
  readRequestBody,
  sourceOfRequestBody,
} from "./httpUtils.ts";

export function createQuarryServer() {
  return createServer(async (request, response) => {
    applySecurityHeaders({ response });
    const url = new URL(request.url ?? "/", "http://" + (request.headers.host ?? "localhost"));
    const segments = url.pathname.split("/").filter(Boolean);

    try {
      // ---- the quarry and geologist API ----
      if (segments[0] === "api") {
        if (url.pathname === "/api/whoami") {
          if (!isAccessGranted({ request }))
            return sendJson({ response, statusCode: 401, body: { erreur: "code d'accès requis" } });
          return sendJson({
            response,
            statusCode: 200,
            body: { version: VERSION, utilisateur: "porteur-du-code" },
          });
        }
        if (!isAccessGranted({ request })) {
          return sendJson({ response, statusCode: 401, body: { erreur: "code d'accès requis" } });
        }

        // ---- the workshop protocol: api/layers ----
        if (request.method === "GET" && url.pathname === "/api/layers") {
          const layers = [
            ...KERNEL_LAYER_NAMES.map((name) => ({ name, builtIn: true })),
            ...listLayerNames({ directory: USERS_DIRECTORY }).map((name) => ({
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
            const lookup = lookupLayer({ name });
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
            const { created } = writeUserLayer({ name, source: bodyCheck.source });
            return sendJson({
              response,
              statusCode: created ? 201 : 200,
              body: { name, builtIn: false, écrit: true },
            });
          }
        }

        // ---- the compatibility API: api/formalismes ----
        if (request.method === "GET" && url.pathname === "/api/formalismes") {
          const userNames = listLayerNames({ directory: USERS_DIRECTORY });
          return sendJson({
            response,
            statusCode: 200,
            body: {
              version: VERSION,
              noyau: KERNEL_LAYER_NAMES,
              utilisateurs: userNames,
              total: KERNEL_LAYER_NAMES.length + userNames.length,
            },
          });
        }

        if (segments[1] === "formalismes" && segments[2]) {
          const nameCheck = asLayerName({ candidate: segments[2] });
          if ("reason" in nameCheck)
            return sendJson({ response, statusCode: 400, body: { erreur: nameCheck.reason } });
          const name = nameCheck.name;

          if (request.method === "GET") {
            const lookup = lookupLayer({ name });
            if (!lookup.found)
              return sendJson({
                response,
                statusCode: 404,
                body: { erreur: "couche inconnue : " + name },
              });
            return sendJson({
              response,
              statusCode: 200,
              body: { nom: name, origine: lookup.location, source: lookup.source },
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
            const { created } = writeUserLayer({ name, source: bodyCheck.source });
            return sendJson({
              response,
              statusCode: created ? 201 : 200,
              body: { nom: name, origine: "utilisateurs", écrit: true },
            });
          }

          if (request.method === "DELETE") {
            if (KERNEL_LAYER_NAMES.includes(name)) {
              return sendJson({
                response,
                statusCode: 403,
                body: { erreur: "le socle est en lecture seule : " + name },
              });
            }
            if (!existsSync(userLayerPath({ name }))) {
              return sendJson({
                response,
                statusCode: 404,
                body: { erreur: "couche inconnue : " + name },
              });
            }
            deleteUserLayer({ name });
            return sendJson({ response, statusCode: 200, body: { nom: name, effacé: true } });
          }
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
          // visitors' layers read at the call — a layer written
          // seconds ago stays refinable for the geologist.
          const userNames = listLayerNames({ directory: USERS_DIRECTORY });
          const previousAdditionSources = userNames.map((name) =>
            readFileSync(userLayerPath({ name: name as LayerName }), "utf8"),
          );
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
                const generated = await generateLayer({ instruction, feedback });
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
          const outcome = editorSession.applyGesture({
            source: body.source,
            baseVersion: body.baseVersion,
          });
          if (outcome.ok) {
            persistEditorSession();
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
