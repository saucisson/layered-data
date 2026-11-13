// ============================================================
// Layered Data — HTTP helpers: JSON/text answers, access code,
// request bodies
// ============================================================
import { createHash } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";

import { API_TOKEN } from "./config.ts";
import { clientKeyOf } from "./rateLimit.ts";

/** The conservative security header baseline (approved on issue #84):
 * every response carries it — API, SSE and static files alike. A full
 * CSP with nonces is a later chantier, delicate with the editor's SSE. */
export const SECURITY_HEADERS: Readonly<Record<string, string>> = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "no-referrer",
};

/** Set the security baseline on a response — call once per request,
 * before any writeHead; setHeader survives writeHead. */
export function applySecurityHeaders({ response }: { response: ServerResponse }): void {
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
    response.setHeader(name, value);
  }
}

export function sendJson({
  response,
  statusCode,
  body,
}: {
  response: ServerResponse;
  statusCode: number;
  body: unknown;
}): void {
  const text = JSON.stringify(body);
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(text),
  });
  response.end(text);
}

export function sendText({
  response,
  statusCode,
  body,
}: {
  response: ServerResponse;
  statusCode: number;
  body: string;
}): void {
  response.writeHead(statusCode, { "Content-Type": "text/plain; charset=utf-8" });
  response.end(body);
}

/** The access code travels in the `x-access-code` header (the
 * workshop protocol) — never in the URL, never in the page. */
export function isAccessGranted({ request }: { request: IncomingMessage }): boolean {
  const workshopHeader = request.headers["x-access-code"];
  return (
    typeof workshopHeader === "string" &&
    workshopHeader.trim() !== "" &&
    workshopHeader.trim() === API_TOKEN
  );
}

/** The resolved identity behind a request (ADR-0114, issue #140).
 * The legacy shared code maps to the shared identity; a personal
 * access code will resolve to its user row (hashed lookup in
 * `users`, when the database is wired). Without any code the
 * identity is anonymous-local. */
export type ResolvedIdentity =
  | { kind: "shared-code" }
  | { kind: "personal-code"; accessCodeHash: string }
  | { kind: "anonymous-local" };

export function resolveIdentity({ request }: { request: IncomingMessage }): ResolvedIdentity {
  const workshopHeader = request.headers["x-access-code"];
  if (typeof workshopHeader !== "string" || workshopHeader.trim() === "") {
    return { kind: "anonymous-local" };
  }
  const code = workshopHeader.trim();
  if (code === API_TOKEN) return { kind: "shared-code" };
  // A personal access code: the hash is the stable key — the clear
  // code never persists, never logs.
  return { kind: "personal-code", accessCodeHash: hashAccessCode({ code }) };
}

/** SHA-256 of an access code — the value stored in users.access_code_hash. */
export function hashAccessCode({ code }: { code: string }): string {
  return createHash("sha256").update(code).digest("hex");
}

/** The rate-limit key of a request (issue #140): keyed per resolved
 * user when a code is present, per client address otherwise. */
export function rateLimitKeyOf({ request }: { request: IncomingMessage }): string {
  const identity = resolveIdentity({ request });
  if (identity.kind === "shared-code") return "shared-code";
  if (identity.kind === "personal-code") return "user:" + identity.accessCodeHash;
  return clientKeyOf({ request });
}

/** Read a request body, refusing bodies over one megabyte — a
 * layer source is a few kilobytes; more is not a source. */
export function readRequestBody({ request }: { request: IncomingMessage }): Promise<string> {
  return new Promise((resolve) => {
    let accumulated = "";
    request.on("data", (chunk) => {
      accumulated += chunk;
      if (accumulated.length > 1_000_000) request.destroy();
    });
    request.on("end", () => resolve(accumulated));
  });
}

/** The source field of a JSON body, or why the body is refused. */
export function sourceOfRequestBody({
  rawBody,
}: {
  rawBody: string;
}): { source: string } | { reason: string } {
  const body = JSON.parse(rawBody || "{}") as { source?: unknown };
  if (typeof body?.source === "string" && body.source.trim()) {
    return { source: body.source };
  }
  return { reason: 'corps JSON attendu : { "source": "…" }' };
}
