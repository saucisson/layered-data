// ============================================================
// Layered Data — the users store (issue #140, ADR-0114)
//
// Lookup by hashed access code, creation, listing, revocation.
// PostgreSQL only — without DATABASE_URL there are no personal
// accounts, the shared code is the only identity (dev/tests).
// ============================================================
import type { Pool } from "pg";

/** A user profile as the API returns it. */
export interface UserProfile {
  id: number;
  displayName: string;
  role: "user" | "admin";
  createdAt: string;
}

/** The users store cannot serve: no DATABASE_URL (dev/tests) or the
 * database is unreachable. Typed so the HTTP layer can map it. */
export class UserStoreUnavailableError extends Error {
  constructor({ cause }: { cause?: unknown } = {}) {
    super(
      "user store indisponible" +
        (cause !== undefined ? " : " + String((cause as Error)?.message ?? cause) : ""),
    );
    this.name = "UserStoreUnavailableError";
  }
}

/** A user creation failed: no row came back from the INSERT. */
export class UserCreationError extends Error {
  constructor() {
    super("la création de l'utilisateur a échoué — aucune ligne retournée");
    this.name = "UserCreationError";
  }
}

/** The users store: the personal accounts behind the access codes. */
export interface UserStore {
  /** Verify the store can serve and create the schema if needed. */
  init(): Promise<void>;
  /** Look a user up by the SHA-256 hash of their access code. */
  findByAccessCodeHash({ accessCodeHash }: { accessCodeHash: string }): Promise<UserProfile | null>;
  /** Create a user with a personal access code (already hashed). */
  create({
    displayName,
    accessCodeHash,
    role,
  }: {
    displayName: string;
    accessCodeHash: string;
    role?: "user" | "admin";
  }): Promise<UserProfile>;
  /** List all users (admin route, issue #142). */
  list(): Promise<UserProfile[]>;
  /** Revoke a user by id (admin route, issue #142). */
  revoke({ id }: { id: number }): Promise<{ existed: boolean }>;
}

/** A no-op store for dev/tests without DATABASE_URL: no personal
 * accounts exist, every lookup misses. */
export function createNullUserStore(): UserStore {
  return {
    async init() {},
    async findByAccessCodeHash() {
      return null;
    },
    async create() {
      throw new UserStoreUnavailableError();
    },
    async list() {
      return [];
    },
    async revoke() {
      return { existed: false };
    },
  };
}

/** The PostgreSQL users store (production, DATABASE_URL). */
export function createPostgresUserStore({ databaseUrl }: { databaseUrl: string }): UserStore {
  let pool: Pool | null = null;
  async function getPool(): Promise<Pool> {
    if (pool === null) {
      const { Pool } = await import("pg");
      pool = new Pool({ connectionString: databaseUrl });
    }
    return pool;
  }
  function rowToProfile(row: {
    id: number;
    display_name: string;
    role: string;
    created_at: Date | string;
  }): UserProfile {
    return {
      id: row.id,
      displayName: row.display_name,
      role: row.role === "admin" ? "admin" : "user",
      createdAt: typeof row.created_at === "string" ? row.created_at : row.created_at.toISOString(),
    };
  }
  return {
    async init() {
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
    },
    async findByAccessCodeHash({ accessCodeHash }) {
      const result = await (await getPool()).query(
        "SELECT id, display_name, role, created_at FROM users WHERE access_code_hash = $1",
        [accessCodeHash],
      );
      const rows = result.rows as Parameters<typeof rowToProfile>[0][];
      return rows.length > 0 && rows[0] !== undefined ? rowToProfile(rows[0]) : null;
    },
    async create({ displayName, accessCodeHash, role = "user" }) {
      const result = await (await getPool()).query(
        `INSERT INTO users (display_name, access_code_hash, role)
         VALUES ($1, $2, $3)
         RETURNING id, display_name, role, created_at`,
        [displayName, accessCodeHash, role],
      );
      const rows = result.rows as Parameters<typeof rowToProfile>[0][];
      if (rows.length === 0 || rows[0] === undefined) {
        throw new UserCreationError();
      }
      return rowToProfile(rows[0]);
    },
    async list() {
      const result = await (await getPool()).query(
        "SELECT id, display_name, role, created_at FROM users ORDER BY created_at",
      );
      return (result.rows as Parameters<typeof rowToProfile>[0][]).map(rowToProfile);
    },
    async revoke({ id }) {
      const result = await (await getPool()).query("DELETE FROM users WHERE id = $1", [id]);
      return { existed: (result.rowCount ?? 0) > 0 };
    },
  };
}
