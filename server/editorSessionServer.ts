// ============================================================
// Layered Data — the shared editor session over SSE (ADR-0110)
//
// The graphical editor's living additions, kept as ONE versioned
// state: every gesture is a layer source judged by the same staging
// as the browser (the pure store lives in the application layer),
// accepted under optimistic locking (baseVersion), persisted as JSON
// and broadcast to every connected editor over SSE. Presence is
// transport-level: the connected editors, each with the model it is
// editing (its focus).
// ============================================================
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import type { ServerResponse } from "node:http";

import {
  createEditorSession,
  parseEditorSession,
  serializeEditorSession,
  type EditorSessionState,
} from "../src/application/editorSession.ts";
import { KERNEL_LAYER_NAMES as CANONICAL_LAYER_NAMES } from "../src/application/corpus.ts";
import { EDITOR_SESSION_FILE } from "./config.ts";
import { KERNEL_LAYER_SOURCES } from "./layerStore.ts";

/** The persisted state, reloaded at boot — a missing or malformed
 * file is an empty session, never a crash. */
function loadEditorSessionState(): EditorSessionState | undefined {
  if (!existsSync(EDITOR_SESSION_FILE)) return undefined;
  return parseEditorSession({ text: readFileSync(EDITOR_SESSION_FILE, "utf8") }) ?? undefined;
}

export const editorSession = createEditorSession({
  kernelLayerSources: KERNEL_LAYER_SOURCES,
  kernelLayerNames: [...CANONICAL_LAYER_NAMES],
  initial: loadEditorSessionState(),
});

/** Persist the accepted state — the durable path of the session. */
export function persistEditorSession(): void {
  writeFileSync(EDITOR_SESSION_FILE, serializeEditorSession({ state: editorSession.readState() }));
}

/** One connected editor: its SSE stream and the model it edits. */
export interface EditorClient {
  response: ServerResponse;
  focus: string | null;
}

export const editorClients = new Map<string, EditorClient>();

/** The presence list broadcast with every state change. */
export function presenceList(): { id: string; focus: string | null }[] {
  return [...editorClients.entries()].map(([id, client]) => ({ id, focus: client.focus }));
}

/** Write one SSE event to a client. */
export function sendEvent({ response, event, data }: { response: ServerResponse; event: string; data: unknown }): void {
  response.write("event: " + event + "\ndata: " + JSON.stringify(data) + "\n\n");
}

/** The full state, with presence, as every client receives it. */
export function sessionSnapshot(): EditorSessionState & { presence: { id: string; focus: string | null }[] } {
  return { ...editorSession.readState(), presence: presenceList() };
}

/** Broadcast the state to every connected editor. */
export function broadcastEditorState(): void {
  for (const client of editorClients.values()) {
    sendEvent({ response: client.response, event: "state", data: sessionSnapshot() });
  }
}

/** Broadcast the presence alone (a focus changed, a client left). */
export function broadcastEditorPresence(): void {
  for (const client of editorClients.values()) {
    sendEvent({ response: client.response, event: "presence", data: { presence: presenceList() } });
  }
}
