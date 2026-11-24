// ============================================================
// Layered Data — HTTP helpers: JSON/text answers, access code,
// request bodies
// ============================================================
import { createHash } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";

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

/** An RFC 7807 problem detail (ADR-0120 §2): the workshop API answers
 * a session-less call with `401 application/problem+json` carrying a
 * machine-readable `reason` — the front reads it and shows its sign-in
 * page instead of a raw error. */
export function sendProblem({
  response,
  statusCode,
  reason,
  title,
}: {
  response: ServerResponse;
  statusCode: number;
  reason: string;
  title: string;
}): void {
  const text = JSON.stringify({ type: "about:blank", title, status: statusCode, reason });
  response.writeHead(statusCode, {
    "Content-Type": "application/problem+json; charset=utf-8",
    "Content-Length": Buffer.byteLength(text),
  });
  response.end(text);
}

/** SHA-256 of a personal access code — the value stored in
 * users.access_code_hash. The clear code never persists, never logs. */
export function hashAccessCode({ code }: { code: string }): string {
  return createHash("sha256").update(code).digest("hex");
}

/** The rate-limit key of a request (issue #140, Auth v1): keyed per
 * session cookie, per bearer token or per access code when present —
 * hashed, never stored raw — per client address otherwise. */
export function rateLimitKeyOf({ request }: { request: IncomingMessage }): string {
  const cookieHeader = request.headers.cookie;
  if (typeof cookieHeader === "string") {
    const match = cookieHeader.match(/(?:^|;\s*)sid=([^;]+)/);
    if (match !== null && match[1] !== undefined) {
      return "session:" + createHash("sha256").update(match[1]).digest("hex").slice(0, 16);
    }
  }
  const authorization = request.headers.authorization;
  if (typeof authorization === "string" && authorization !== "") {
    return "bearer:" + createHash("sha256").update(authorization).digest("hex").slice(0, 16);
  }
  const workshopHeader = request.headers["x-access-code"];
  if (typeof workshopHeader === "string" && workshopHeader.trim() !== "") {
    return "code:" + hashAccessCode({ code: workshopHeader.trim() }).slice(0, 16);
  }
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
