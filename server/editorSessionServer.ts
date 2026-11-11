// ============================================================
// Layered Data — the shared editor session over SSE (ADR-0110)
//
// The graphical editor's living additions, kept as ONE versioned
// state: every gesture is a layer source judged by the same staging
// as the browser (the pure store lives in the application layer),
// accepted under optimistic locking (baseVersion), persisted through
// the EditorSessionStore (disk in dev, PostgreSQL in production —
// ADR-0111) and broadcast to every connected editor over SSE.
// Presence is transport-level: the connected editors, each with the
// model it is editing (its focus).
// ============================================================
import type { ServerResponse } from "node:http";

import {
  createEditorSession,
  type EditorSession,
  type EditorSessionState,
} from "../src/application/editorSession.ts";
import { KERNEL_LAYER_NAMES as CANONICAL_LAYER_NAMES } from "../src/application/corpus.ts";
import { KERNEL_LAYER_SOURCES } from "./layerStore.ts";
import {
  createEditorSessionStore,
  type EditorSessionHistoryEntry,
  type EditorSessionStore,
} from "./editorSessionStore.ts";
import {
  DATABASE_URL,
  EDITOR_SESSION_FILE,
  EDITOR_SESSION_HISTORY_DEPTH,
} from "./config.ts";

// ---- the store and the session it backs -------------------------

let store: EditorSessionStore = createEditorSessionStore({
  databaseUrl: DATABASE_URL,
  editorSessionFile: EDITOR_SESSION_FILE,
  historyDepth: EDITOR_SESSION_HISTORY_DEPTH,
});
let session: EditorSession = createEditorSession({
  kernelLayerSources: KERNEL_LAYER_SOURCES,
  kernelLayerNames: [...CANONICAL_LAYER_NAMES],
});
let loaded = false;

/** Swap the store (composition root) — the session reloads lazily. */
export function setEditorSessionStore({
  editorSessionStore,
}: {
  editorSessionStore: EditorSessionStore;
}): void {
  store = editorSessionStore;
  loaded = false;
}

/** Init the store and load the persisted state into a fresh session.
 * Throws StoreUnavailableError when the store cannot serve. */
export async function initializeEditorSession(): Promise<void> {
  await store.init();
  const initial = await store.load();
  session = createEditorSession({
    kernelLayerSources: KERNEL_LAYER_SOURCES,
    kernelLayerNames: [...CANONICAL_LAYER_NAMES],
    initial,
  });
  loaded = true;
}

/** Load on first use when the composition root did not (tests). */
export async function ensureEditorSessionLoaded(): Promise<void> {
  if (!loaded) await initializeEditorSession();
}

export function editorSession(): EditorSession {
  return session;
}

/** Persist the accepted state — the durable path of the session. */
export async function persistEditorSession(): Promise<void> {
  await store.save({ state: session.readState() });
}

/** The journal, newest first — the base of undo/redo after a reload. */
export async function editorSessionHistory({
  limit,
}: {
  limit: number;
}): Promise<EditorSessionHistoryEntry[]> {
  return store.history({ limit });
}

// ---- the connected editors (transport-level presence) -----------

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
export function sendEvent({
  response,
  event,
  data,
}: {
  response: ServerResponse;
  event: string;
  data: unknown;
}): void {
  response.write("event: " + event + "\ndata: " + JSON.stringify(data) + "\n\n");
}

/** The full state, with presence, as every client receives it. */
export function sessionSnapshot(): EditorSessionState & {
  presence: { id: string; focus: string | null }[];
} {
  return { ...session.readState(), presence: presenceList() };
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
