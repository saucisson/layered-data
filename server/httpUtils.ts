// ============================================================
// Layered Data — HTTP helpers: JSON/text answers, access code,
// request bodies
// ============================================================
import type { IncomingMessage, ServerResponse } from "node:http";

import { API_TOKEN } from "./config.ts";

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
