// ============================================================
// Layered Data — the stores composition (issue #109, ADR-0111)
//
// The server's two persistent stores, selected by the environment:
// PostgreSQL when DATABASE_URL is set (production, several
// instances behind a proxy), disk otherwise (dev, tests). init()
// verifies each store can serve — the boot fails fast on the first
// unavailable one, never a silent disk fallback.
// ============================================================
import {
  DATABASE_URL,
  USERS_DIRECTORY,
  EDITOR_SESSION_FILE,
  EDITOR_SESSION_HISTORY_DEPTH,
} from "./config.ts";
import { createUserLayerStore, type UserLayerStore } from "./userLayerStore.ts";
import {
  createEditorSessionStore,
  type EditorSessionStore,
} from "./editorSessionStore.ts";
import { createPostgresUserStore, createNullUserStore, type UserStore } from "./userStore.ts";

/** The server's persistent stores. */
export interface QuarryStores {
  userLayers: UserLayerStore;
  editorSession: EditorSessionStore;
  users: UserStore;
}

/** The stores selected by the environment (config.ts). */
export function createQuarryStoresFromEnv(): QuarryStores {
  return {
    userLayers: createUserLayerStore({
      databaseUrl: DATABASE_URL,
      usersDirectory: USERS_DIRECTORY,
    }),
    editorSession: createEditorSessionStore({
      databaseUrl: DATABASE_URL,
      editorSessionFile: EDITOR_SESSION_FILE,
      historyDepth: EDITOR_SESSION_HISTORY_DEPTH,
    }),
    users: DATABASE_URL
      ? createPostgresUserStore({ databaseUrl: DATABASE_URL })
      : createNullUserStore(),
  };
}

/** Verify every store can serve (and create the schema if needed).
 * Throws StoreUnavailableError on the first unavailable one. */
export async function initQuarryStores({ stores }: { stores: QuarryStores }): Promise<void> {
  await stores.userLayers.init();
  await stores.editorSession.init();
  await stores.users.init();
}
