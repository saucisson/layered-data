// ============================================================
// Layered Data — the editor session store (issue #109, ADR-0111)
//
// The shared editor session (ADR-0110) behind one interface: disk
// in dev/tests (data/editor-session.json, unchanged behavior),
// PostgreSQL in production (DATABASE_URL). In PostgreSQL the
// session is ONE snapshot row plus an append-only journal — one row
// per accepted version — trimmed to the last `historyDepth` versions
// on every write, so undo/redo survives a reload.
// ============================================================
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import type { Pool } from "pg";

import {
  parseEditorSession,
  serializeEditorSession,
  type EditorSessionState,
} from "../src/application/editorSession.ts";
import { StoreUnavailableError } from "./userLayerStore.ts";

/** One journal entry: a version and the state it carried. */
export interface EditorSessionHistoryEntry {
  version: number;
  state: EditorSessionState;
}

/** The persistence of the shared editor session. */
export interface EditorSessionStore {
  /** Verify the store can serve and create the schema if needed.
   * Throws StoreUnavailableError when it cannot. */
  init(): Promise<void>;
  /** The persisted state, reloaded at boot — a missing or malformed
   * one is an empty session, never a crash. */
  load(): Promise<EditorSessionState | undefined>;
  /** Persist an accepted state: the durable path of the session. */
  save({ state }: { state: EditorSessionState }): Promise<void>;
  /** The journal, newest first, capped at `limit` entries. */
  history({ limit }: { limit: number }): Promise<EditorSessionHistoryEntry[]>;
}

// ------------------------------------------------------------
// The disk store — dev and tests: one JSON file, as before
// ------------------------------------------------------------

export function createDiskEditorSessionStore({
  editorSessionFile,
}: {
  editorSessionFile: string;
}): EditorSessionStore {
  async function load(): Promise<EditorSessionState | undefined> {
    if (!existsSync(editorSessionFile)) return undefined;
    return parseEditorSession({ text: readFileSync(editorSessionFile, "utf8") }) ?? undefined;
  }
  return {
    async init() {
      mkdirSync(dirname(editorSessionFile), { recursive: true });
    },
    load,
    async save({ state }) {
      writeFileSync(editorSessionFile, serializeEditorSession({ state }));
    },
    async history() {
      // the disk file keeps no journal: the history is the current state
      const current = await load();
      return current === undefined ? [] : [{ version: current.version, state: current }];
    },
  };
}

// ------------------------------------------------------------
// The PostgreSQL store — production: snapshot + journal
// ------------------------------------------------------------

export function createPostgresEditorSessionStore({
  databaseUrl,
  historyDepth,
}: {
  databaseUrl: string;
  historyDepth: number;
}): EditorSessionStore {
  let pool: Pool | null = null;
  async function getPool(): Promise<Pool> {
    if (pool === null) {
      const { Pool } = await import("pg");
      pool = new Pool({ connectionString: databaseUrl });
    }
    return pool;
  }
  function parseState({ raw }: { raw: unknown }): EditorSessionState | null {
    if (typeof raw !== "object" || raw === null) return null;
    return parseEditorSession({ text: JSON.stringify(raw) });
  }
  return {
    async init() {
      try {
        const clientPool = await getPool();
        await clientPool.query("SELECT 1");
        await clientPool.query(`
          CREATE TABLE IF NOT EXISTS editor_session (
            id INTEGER PRIMARY KEY CHECK (id = 1),
            version BIGINT NOT NULL,
            state JSONB NOT NULL,
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
          )
        `);
        await clientPool.query(`
          CREATE TABLE IF NOT EXISTS editor_session_events (
            version BIGINT PRIMARY KEY,
            state JSONB NOT NULL,
            at TIMESTAMPTZ NOT NULL DEFAULT now()
          )
        `);
      } catch (error) {
        throw new StoreUnavailableError({ store: "editor_session (PostgreSQL)", cause: error });
      }
    },
    async load() {
      const result = await (await getPool()).query(
        "SELECT state FROM editor_session WHERE id = 1",
      );
      const rows = result.rows as { state: unknown }[];
      const state = rows.length > 0 && rows[0] !== undefined ? parseState({ raw: rows[0].state }) : null;
      return state ?? undefined;
    },
    async save({ state }) {
      const clientPool = await getPool();
      const client = await clientPool.connect();
      try {
        await client.query("BEGIN");
        await client.query(
          `INSERT INTO editor_session (id, version, state) VALUES (1, $1, $2)
           ON CONFLICT (id) DO UPDATE SET version = EXCLUDED.version, state = EXCLUDED.state, updated_at = now()`,
          [state.version, JSON.stringify(state)],
        );
        await client.query(
          "INSERT INTO editor_session_events (version, state) VALUES ($1, $2) ON CONFLICT (version) DO NOTHING",
          [state.version, JSON.stringify(state)],
        );
        // retention: keep only the last historyDepth versions
        await client.query(
          `DELETE FROM editor_session_events WHERE version NOT IN (
             SELECT version FROM editor_session_events ORDER BY version DESC LIMIT $1
           )`,
          [historyDepth],
        );
        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK").catch(() => undefined);
        throw error;
      } finally {
        client.release();
      }
    },
    async history({ limit }) {
      const result = await (await getPool()).query(
        "SELECT version, state FROM editor_session_events ORDER BY version DESC LIMIT $1",
        [Math.max(1, limit)],
      );
      const entries: EditorSessionHistoryEntry[] = [];
      for (const row of result.rows as { version: string | number; state: unknown }[]) {
        const state = parseState({ raw: row.state });
        // BIGINT comes back as a string from pg — the version is a number
        if (state !== null) entries.push({ version: Number(row.version), state });
      }
      return entries;
    },
  };
}

/** The store selected by the environment: PostgreSQL when
 * DATABASE_URL is set, disk otherwise. */
export function createEditorSessionStore({
  databaseUrl,
  editorSessionFile,
  historyDepth,
}: {
  databaseUrl: string;
  editorSessionFile: string;
  historyDepth: number;
}): EditorSessionStore {
  return databaseUrl
    ? createPostgresEditorSessionStore({ databaseUrl, historyDepth })
    : createDiskEditorSessionStore({ editorSessionFile });
}
