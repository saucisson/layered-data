// ============================================================
// Layered Data — HTTP helpers: JSON/text answers, access code,
// request bodies
// ============================================================
import type { IncomingMessage, ServerResponse } from "node:http";

import { API_TOKEN } from "./config.ts";

export function sendJson({ response, statusCode, body }: { response: ServerResponse; statusCode: number; body: unknown }): void {
  const text = JSON.stringify(body);
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(text),
  });
  response.end(text);
}

export function sendText({ response, statusCode, body }: { response: ServerResponse; statusCode: number; body: string }): void {
  response.writeHead(statusCode, { "Content-Type": "text/plain; charset=utf-8" });
  response.end(body);
}

/** The access code travels in the `x-access-code` header (the
 * workshop protocol) or as a Bearer token (compatibility) —
 * never in the URL, never in the page. */
export function isAccessGranted({ request }: { request: IncomingMessage }): boolean {
  const workshopHeader = request.headers["x-access-code"];
  if (typeof workshopHeader === "string" && workshopHeader.trim() !== "" && workshopHeader.trim() === API_TOKEN) {
    return true;
  }
  const authorizationHeader = request.headers["authorization"] ?? "";
  return authorizationHeader.startsWith("Bearer ") && authorizationHeader.slice(7) === API_TOKEN;
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
export function sourceOfRequestBody({ rawBody }: { rawBody: string }): { source: string } | { reason: string } {
  const body = JSON.parse(rawBody || "{}") as { source?: unknown };
  if (typeof body?.source === "string" && body.source.trim()) {
    return { source: body.source };
  }
  return { reason: "corps JSON attendu : { \"source\": \"…\" }" };
}
