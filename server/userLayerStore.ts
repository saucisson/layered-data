// ============================================================
// Layered Data — the visitors' layer store (issue #109, ADR-0111)
//
// The writable quarry behind one interface, so the server can run
// several instances behind a proxy: disk in dev/tests
// (LD_USERS_DIRECTORY), PostgreSQL in production (DATABASE_URL).
// With DATABASE_URL set but the database unreachable, init() throws
// a StoreUnavailableError and the server fails fast at boot — never
// a silent disk fallback (that would be a split-brain).
// ============================================================
import { readFileSync, writeFileSync, unlinkSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import type { Pool } from "pg";

import {
  KERNEL_LAYER_NAMES,
  kernelLayerPath,
  listLayerNames,
  type LayerName,
} from "./layerStore.ts";

/** The store of the visitors' layers: list, read, write, delete. */
export interface UserLayerStore {
  /** Verify the store can serve and create the schema if needed.
   * Throws StoreUnavailableError when it cannot. */
  init(): Promise<void>;
  /** The layer names, sorted. */
  listNames(): Promise<string[]>;
  /** Read one layer's source. */
  read({ name }: { name: LayerName }): Promise<{ found: true; source: string } | { found: false }>;
  /** Write a layer (upsert). A trailing newline is added: every
   * layer ends with one. */
  write({ name, source }: { name: LayerName; source: string }): Promise<{ created: boolean }>;
  /** Delete a layer. */
  delete({ name }: { name: LayerName }): Promise<{ existed: boolean }>;
}

/** A store that cannot serve: DATABASE_URL set but PostgreSQL
 * unreachable, or the disk unwritable. The boot fails fast on it. */
export class StoreUnavailableError extends Error {
  constructor({ store, cause }: { store: string; cause: unknown }) {
    super(
      "store " + store + " indisponible : " + String((cause as Error)?.message ?? cause),
    );
    this.name = "StoreUnavailableError";
  }
}

/** What a lookup found: a layer's source and where it lives.
 * The user quarry wins over the kernel — a visitor may shadow
 * a read-only name with their own writing. */
export type LayerLookup =
  | { found: false }
  | { found: true; location: "kernel" | "users"; source: string };

/** Look a layer up in the user store first, then in the kernel. */
export async function lookupLayer({
  name,
  userLayerStore,
}: {
  name: LayerName;
  userLayerStore: UserLayerStore;
}): Promise<LayerLookup> {
  const userLayer = await userLayerStore.read({ name });
  if (userLayer.found) {
    return { found: true, location: "users", source: userLayer.source };
  }
  if (KERNEL_LAYER_NAMES.includes(name)) {
    return {
      found: true,
      location: "kernel",
      source: readFileSync(kernelLayerPath({ name }), "utf8"),
    };
  }
  return { found: false };
}

// ------------------------------------------------------------
// The disk store — dev and tests (LD_USERS_DIRECTORY)
// ------------------------------------------------------------

export function createDiskUserLayerStore({ directory }: { directory: string }): UserLayerStore {
  const filePath = ({ name }: { name: LayerName }): string => join(directory, name + ".ld");
  return {
    async init() {
      mkdirSync(directory, { recursive: true });
    },
    async listNames() {
      return listLayerNames({ directory });
    },
    async read({ name }) {
      if (!existsSync(filePath({ name }))) return { found: false };
      return { found: true, source: readFileSync(filePath({ name }), "utf8") };
    },
    async write({ name, source }) {
      const created = !existsSync(filePath({ name }));
      const normalized = source.endsWith("\n") ? source : source + "\n";
      writeFileSync(filePath({ name }), normalized);
      return { created };
    },
    async delete({ name }) {
      if (!existsSync(filePath({ name }))) return { existed: false };
      unlinkSync(filePath({ name }));
      return { existed: true };
    },
  };
}

// ------------------------------------------------------------
// The PostgreSQL store — production (DATABASE_URL)
// ------------------------------------------------------------

export function createPostgresUserLayerStore({
  databaseUrl,
}: {
  databaseUrl: string;
}): UserLayerStore {
  let pool: Pool | null = null;
  async function getPool(): Promise<Pool> {
    if (pool === null) {
      const { Pool } = await import("pg");
      pool = new Pool({ connectionString: databaseUrl });
    }
    return pool;
  }
  return {
    async init() {
      try {
        const clientPool = await getPool();
        await clientPool.query("SELECT 1");
        await clientPool.query(`
          CREATE TABLE IF NOT EXISTS users (
            id SERIAL PRIMARY KEY,
            display_name TEXT NOT NULL,
            access_code_hash TEXT NOT NULL UNIQUE,
            role TEXT NOT NULL CHECK (role IN ('user', 'admin')),
            created_at TIMESTAMPTZ NOT NULL DEFAULT now()
          )
        `);
        await clientPool.query(`
          CREATE TABLE IF NOT EXISTS user_layers (
            name TEXT PRIMARY KEY,
            source TEXT NOT NULL,
            owner INTEGER REFERENCES users(id) ON DELETE SET NULL,
            status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
          )
        `);
        await clientPool.query(`
          ALTER TABLE user_layers
          ADD COLUMN IF NOT EXISTS owner INTEGER REFERENCES users(id) ON DELETE SET NULL,
          ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published'));
        await clientPool.query(`
          CREATE TABLE IF NOT EXISTS formalism_versions (
            formalism_id TEXT NOT NULL REFERENCES user_layers(name) ON DELETE CASCADE,
            semver TEXT NOT NULL,
            source TEXT NOT NULL,
            status TEXT NOT NULL CHECK (status IN ('draft', 'frozen')),
            frozen_at TIMESTAMPTZ,
            dump_fingerprint TEXT,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            PRIMARY KEY (formalism_id, semver)
          )
        `);
      } catch (error) {
        throw new StoreUnavailableError({ store: "user_layers (PostgreSQL)", cause: error });
      }
    },
    async listNames() {
      const result = await (await getPool()).query("SELECT name FROM user_layers ORDER BY name");
      return (result.rows as { name: string }[]).map((row) => row.name);
    },
    async read({ name }) {
      const result = await (await getPool()).query(
        "SELECT source FROM user_layers WHERE name = $1",
        [name],
      );
      const rows = result.rows as { source: string }[];
      return rows.length > 0 && rows[0] !== undefined
        ? { found: true as const, source: rows[0].source }
        : { found: false as const };
    },
    async write({ name, source }) {
      const normalized = source.endsWith("\n") ? source : source + "\n";
      const clientPool = await getPool();
      const client = await clientPool.connect();
      try {
        await client.query("BEGIN");
        const existing = await client.query("SELECT 1 FROM user_layers WHERE name = $1", [name]);
        const created = existing.rowCount === 0;
        if (created) {
          await client.query("INSERT INTO user_layers (name, source) VALUES ($1, $2)", [
            name,
            normalized,
          ]);
        } else {
          await client.query(
            "UPDATE user_layers SET source = $2, updated_at = now() WHERE name = $1",
            [name, normalized],
          );
        }
        await client.query("COMMIT");
        return { created };
      } catch (error) {
        await client.query("ROLLBACK").catch(() => undefined);
        throw error;
      } finally {
        client.release();
      }
    },
    async delete({ name }) {
      const result = await (await getPool()).query("DELETE FROM user_layers WHERE name = $1", [
        name,
      ]);
      return { existed: (result.rowCount ?? 0) > 0 };
    },
  };
}

/** The store selected by the environment: PostgreSQL when
 * DATABASE_URL is set, disk otherwise. */
export function createUserLayerStore({
  databaseUrl,
  usersDirectory,
}: {
  databaseUrl: string;
  usersDirectory: string;
}): UserLayerStore {
  return databaseUrl
    ? createPostgresUserLayerStore({ databaseUrl })
    : createDiskUserLayerStore({ directory: usersDirectory });
}
