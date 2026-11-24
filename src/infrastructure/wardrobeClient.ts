// The infrastructure of the shared formalisms: the disk quarry
// (the server's formalism files) — never the workshop itself, which
// lives alone in the browser.
//
// Authentication (milestone Auth v1): the browser holds only the
// httpOnly `sid` session cookie, sent automatically with every
// same-origin call — no token, no access code ever lives in the page,
// in localStorage or in a header built by hand.

/** Default bound on one API call: time-to-response. A hanging server
 * aborts after this delay, the caller's catch shows its error state —
 * no infinite spinner (issue #200). The timer is cleared as soon as
 * the response headers arrive, so a long-lived stream (the editor's
 * SSE session) stays open once connected. */
export const API_TIMEOUT_MS = 10_000;

import { readMistralToken } from "./mistralToken.ts";

/** One call to the proxy API. The session cookie travels with the
 * request (same-origin credentials are the fetch default); the wait is
 * bounded by `timeoutMs` (default API_TIMEOUT_MS, 0 disables): on
 * expiry the fetch aborts and rejects with an AbortError, which
 * callers surface as their error state. */
export async function apiFetch({
  endpoint,
  options = {},
  timeoutMs = API_TIMEOUT_MS,
}: {
  endpoint: string;
  options?: RequestInit;
  timeoutMs?: number;
}): Promise<Response> {
  const headers: Record<string, string> = {
    ...((options.headers as Record<string, string>) ?? {}),
  };
  if (!timeoutMs) return fetch(endpoint, { ...options, headers });
  const controller = new AbortController();
  const callerSignal = options.signal;
  if (callerSignal !== null && callerSignal !== undefined) {
    if (callerSignal.aborted) controller.abort();
    else callerSignal.addEventListener("abort", () => controller.abort(), { once: true });
  }
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(endpoint, { ...options, headers, signal: controller.signal });
    // Auth v1 contract (ADR-0120 §2): a workshop route without a session
    // answers 401 application/problem+json with reason "session_required"
    // — the front shows its sign-in page instead of a raw error.
    if (response.status === 401) {
      void response
        .clone()
        .json()
        .then((body: unknown) => {
          if (
            typeof body === "object" &&
            body !== null &&
            (body as { reason?: unknown }).reason === "session_required"
          ) {
            window.dispatchEvent(new CustomEvent("ld:session-required"));
          }
        })
        .catch(() => {
          // not a problem+json body: plain 401, no sign-in page
        });
    }
    return response;
  } finally {
    clearTimeout(timer);
  }
}

// ------------------------------------------------------------
// The geologist's stream (issue #279): POST /api/generate answers
// text/event-stream — one event per step of the two-pass loop.
// ------------------------------------------------------------

/** One event of the /api/generate stream. */
export type GenerateStreamEvent =
  | { event: "questions"; questions: string[] }
  | { event: "selection"; selected: string[]; closure: string[]; fallback: boolean }
  | { event: "round"; attempt: number }
  | { event: "refusal"; attempt: number; step: string; verdicts: string[]; feedback: string }
  | { event: "draft"; source: string }
  | { event: "refused"; attempts: number; feedback: string }
  | { event: "error"; statusCode: number; body: string };

/** A non-stream answer of /api/generate (error status, or a server
 * that predates the stream): the caller surfaces it like today's
 * plain-text refusals. */
export class GenerateHttpError {
  readonly statusCode: number;
  readonly body: string;

  constructor({ statusCode, body }: { statusCode: number; body: string }) {
    this.statusCode = statusCode;
    this.body = body;
  }
}

/** Read the /api/generate stream: fetch + ReadableStream + a minimal
 * SSE parser (blocks split on blank lines, `event:`/`data:` lines).
 * The wait is an INACTIVITY timeout — reset at each event — plus a
 * total cap; a healthy large-model call is never aborted for being
 * slow, only for going mute. */
export async function streamGenerate({
  intention,
  answers = [],
  onEvent,
  inactivityTimeoutMs = 120_000,
  maxDurationMs = 600_000,
}: {
  intention: string;
  answers?: readonly string[];
  onEvent: (event: GenerateStreamEvent) => void;
  inactivityTimeoutMs?: number;
  maxDurationMs?: number;
}): Promise<void> {
  const headers: Record<string, string> = {
    "content-type": "application/json",
    accept: "text/event-stream",
  };
  // LD-8 (ADR-0120 §3): the personal Mistral token travels ONLY on the
  // generation call, as its own header — never in a URL, never logged.
  const mistralToken = readMistralToken();
  if (mistralToken !== null) headers["x-mistral-api-token"] = mistralToken;
  const controller = new AbortController();
  let inactivityTimer: ReturnType<typeof setTimeout> | null = null;
  const armInactivity = () => {
    if (inactivityTimer !== null) clearTimeout(inactivityTimer);
    inactivityTimer = setTimeout(() => controller.abort(), inactivityTimeoutMs);
  };
  armInactivity();
  const totalTimer = setTimeout(() => controller.abort(), maxDurationMs);
  try {
    const response = await fetch("api/generate", {
      method: "POST",
      headers,
      body: JSON.stringify({ prompt: intention, answers: [...answers] }),
      signal: controller.signal,
    });
    if (!response.ok || !response.body) {
      throw new GenerateHttpError({
        statusCode: response.status,
        body: (await response.text()).trim(),
      });
    }
    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.includes("text/event-stream")) {
      // a server without the stream answers plain text: the draft
      // itself, or a refusal the caller surfaces
      const text = (await response.text()).trim();
      if (response.ok && text.length > 0) {
        onEvent({ event: "draft", source: text });
        return;
      }
      throw new GenerateHttpError({ statusCode: response.status, body: text });
    }
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      // the inactivity bound restarts from the last received bytes
      armInactivity();
      buffer += decoder.decode(value, { stream: true });
      let separator = buffer.indexOf("\n\n");
      while (separator !== -1) {
        const block = buffer.slice(0, separator);
        buffer = buffer.slice(separator + 2);
        const parsed = parseSseBlock({ block });
        if (parsed !== null) onEvent(parsed);
        separator = buffer.indexOf("\n\n");
      }
    }
  } finally {
    if (inactivityTimer !== null) clearTimeout(inactivityTimer);
    clearTimeout(totalTimer);
  }
}

/** One SSE block (`event: …\ndata: {…}`) parsed into a typed event —
 * comment lines (`: ping`) and malformed blocks are ignored. */
function parseSseBlock({ block }: { block: string }): GenerateStreamEvent | null {
  let event = "message";
  const dataLines: string[] = [];
  for (const line of block.split("\n")) {
    if (line.startsWith("event: ")) event = line.slice(7).trim();
    else if (line.startsWith("data: ")) dataLines.push(line.slice(6));
  }
  if (dataLines.length === 0) return null;
  let data: unknown;
  try {
    data = JSON.parse(dataLines.join("\n"));
  } catch {
    return null;
  }
  switch (event) {
    case "questions":
      return { event, questions: (data as { questions?: unknown }).questions as string[] };
    case "selection":
      return {
        event,
        selected: (data as { selected?: unknown }).selected as string[],
        closure: (data as { closure?: unknown }).closure as string[],
        fallback: (data as { fallback?: unknown }).fallback as boolean,
      };
    case "round":
      return { event, attempt: (data as { attempt?: unknown }).attempt as number };
    case "refusal":
      return {
        event,
        attempt: (data as { attempt?: unknown }).attempt as number,
        step: (data as { step?: unknown }).step as string,
        verdicts: (data as { verdicts?: unknown }).verdicts as string[],
        feedback: (data as { feedback?: unknown }).feedback as string,
      };
    case "draft":
      return { event, source: (data as { source?: unknown }).source as string };
    case "refused":
      return {
        event,
        attempts: (data as { attempts?: unknown }).attempts as number,
        feedback: (data as { feedback?: unknown }).feedback as string,
      };
    case "error":
      return {
        event,
        statusCode: (data as { statusCode?: unknown }).statusCode as number,
        body: (data as { body?: unknown }).body as string,
      };
    default:
      return null;
  }
}
