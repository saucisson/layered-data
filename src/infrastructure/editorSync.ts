// The shared editor session client (ADR-0028): connects to the
// server's SSE stream, sends gestures, reports presence. The stream
// is read over fetch — EventSource cannot carry the access-code
// header. When the server is unreachable or refuses the access code,
// the editor falls back to its local behavior: the workshop lives
// alone in the browser.

import { apiFetch } from "./wardrobeClient.ts";

/** The versioned state broadcast by the server, with presence. */
export interface SessionSnapshot {
  version: number;
  additions: { name: string; source: string }[];
  presence: { id: string; focus: string | null }[];
}

/** The answer of a gesture route: accepted (200), conflict (409) or
 * refused by the staging (422) — the body always carries the current
 * snapshot, so the client can re-sync from it. */
export interface GestureResponse {
  ok: boolean;
  reason?: string;
  refusals?: string[];
  version: number;
  additions: { name: string; source: string }[];
  presence: { id: string; focus: string | null }[];
}

export interface EditorSyncHandle {
  readonly mode: "shared";
  clientId: string | null;
  sendGesture({ source, baseVersion }: { source: string; baseVersion: number }): Promise<{ status: number; body: GestureResponse }>;
  setFocus({ focus }: { focus: string | null }): void;
  close(): void;
}

/** Connect to the shared session. Resolves to null when the server is
 * not there or the access code is refused — the caller then stays
 * local. The callbacks fire for every event until close(). */
export async function connectEditorSync({
  onState,
  onPresence,
  onEnd,
}: {
  onState: (snapshot: SessionSnapshot) => void;
  onPresence: (presence: { id: string; focus: string | null }[]) => void;
  onEnd: () => void;
}): Promise<EditorSyncHandle | null> {
  const controller = new AbortController();
  let response: Response;
  try {
    response = await apiFetch({
      endpoint: "/api/editor/session",
      options: { headers: { Accept: "text/event-stream" }, signal: controller.signal },
    });
  } catch {
    return null;
  }
  if (!response.ok || response.body === null) return null;

  const handle: EditorSyncHandle = {
    mode: "shared",
    clientId: null,
    async sendGesture({ source, baseVersion }) {
      const gestureResponse = await apiFetch({
        endpoint: "/api/editor/gesture",
        options: {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ source, baseVersion }),
          signal: controller.signal,
        },
      });
      const body = (await gestureResponse.json()) as GestureResponse;
      return { status: gestureResponse.status, body };
    },
    setFocus({ focus }) {
      if (handle.clientId === null) return;
      void apiFetch({
        endpoint: "/api/editor/presence",
        options: {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ clientId: handle.clientId, focus }),
          signal: controller.signal,
        },
      }).catch(() => {
        // presence is best-effort: a lost heartbeat never blocks an edition
      });
    },
    close() {
      controller.abort();
    },
  };

  // ---- the SSE read loop: parse `event:`/`data:` blocks off the stream ----
  const decoder = new TextDecoder();
  let buffer = "";
  void (async () => {
    try {
      const reader = response.body!.getReader();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let boundary = buffer.indexOf("\n\n");
        while (boundary >= 0) {
          const block = buffer.slice(0, boundary);
          buffer = buffer.slice(boundary + 2);
          let event = "message";
          const dataLines: string[] = [];
          for (const line of block.split("\n")) {
            if (line.startsWith("event:")) event = line.slice(6).trim();
            else if (line.startsWith("data:")) dataLines.push(line.slice(5).replace(/^ /, ""));
          }
          if (dataLines.length === 0) continue;
          const data = JSON.parse(dataLines.join("\n")) as Record<string, never>;
          if (event === "hello") {
            handle.clientId = data.clientId as unknown as string;
          } else if (event === "state") {
            onState(data as unknown as SessionSnapshot);
          } else if (event === "presence") {
            onPresence((data.presence ?? []) as { id: string; focus: string | null }[]);
          }
          boundary = buffer.indexOf("\n\n");
        }
      }
    } catch {
      // the stream broke or was aborted — the end callback speaks
    }
    onEnd();
  })();

  return handle;
}
