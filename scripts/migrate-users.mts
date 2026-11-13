// ============================================================
// Layered Data — migrate the schema to user accounts
// (issue #139, ADR-0114)
//
//     DATABASE_URL=postgres://user:password@host:5432/db \
//       node scripts/migrate-users.mts
//
// Idempotent: creates the users table and adds the owner column
// to user_layers when missing. Existing layers keep owner = NULL
// (they belong to the shared access code, porteur-du-code).
// Non-destructive: no row is modified or deleted.
// ============================================================
import { DATABASE_URL } from "../server/config.ts";

if (!DATABASE_URL) {
  console.error("DATABASE_URL est requis — aucune migration sans base PostgreSQL");
  process.exit(1);
}

const { Pool } = await import("pg");
const pool = new Pool({ connectionString: DATABASE_URL });

try {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      display_name TEXT NOT NULL,
      access_code_hash TEXT NOT NULL UNIQUE,
      role TEXT NOT NULL CHECK (role IN ('user', 'admin')),
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
  await pool.query(`
    ALTER TABLE user_layers
    ADD COLUMN IF NOT EXISTS owner INTEGER REFERENCES users(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published'))
  `);
  const { rows } = await pool.query(
    "SELECT column_name FROM information_schema.columns WHERE table_name = 'user_layers' AND column_name IN ('owner', 'status')",
  );
  if (rows.length < 2) {
    throw new Error("les colonnes owner et status n'ont pas été créées sur user_layers");
  }
  console.log("OK — table users et colonnes user_layers.owner / user_layers.status en place");
} finally {
  await pool.end();
}
