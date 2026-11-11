// The PostgreSQL integration checks for the visitors' layer store
// (issue #109, ADR-0111): the UserLayerStore against a REAL
// PostgreSQL, over real HTTP — layer CRUD, with the rows verified in
// the database.
//
// Without DATABASE_URL these checks SKIP (CI stays green). Run them
// locally against a PostgreSQL:
//
//     DATABASE_URL=postgres://u:p@127.0.0.1:5432/layered_data \
//       node tests/postgres-store-checks.mts   (exit 1 on any failure)

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";

// ---- the assertion ledger ------------------------------------------

const failures: string[] = [];
let assertions = 0;

function check(label: string, condition: boolean): void {
  assertions++;
  if (!condition) failures.push(label);
}

// ---- sandbox the disk side, then read the config --------------------

const sandbox = mkdtempSync(join(tmpdir(), "ld-pg-test-"));
process.env.LD_USERS_DIRECTORY = join(sandbox, "users");
process.env.LD_DATA_DIRECTORY = join(sandbox, "data");
process.env.API_TOKEN = "test-token";
process.env.MISTRAL_API_KEY = "";

const { DATABASE_URL } = await import("../server/config.ts");

if (!DATABASE_URL) {
  console.log("SKIP postgres-store-checks : DATABASE_URL absent — run against a real PostgreSQL");
  rmSync(sandbox, { recursive: true, force: true });
  process.exit(0);
}

const { Pool } = await import("pg");
const pool = new Pool({ connectionString: DATABASE_URL });
const { createQuarryStoresFromEnv, initQuarryStores } = await import("../server/stores.ts");
const { createQuarryServer } = await import("../server/routes.ts");

// ---- boot against the real PostgreSQL --------------------------------

await pool.query("DELETE FROM user_layers");

const stores = createQuarryStoresFromEnv();
await initQuarryStores({ stores });
const server: Server = createQuarryServer({ stores });
await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
const port = (server.address() as AddressInfo).port;
const base = "http://127.0.0.1:" + port;
const auth = { "x-access-code": "test-token" };

try {
  // ---- the layer store over HTTP ----
  let response = await fetch(base + "/api/layers/pg-test-layer", {
    method: "PUT",
    headers: { ...auth, "Content-Type": "application/json" },
    body: JSON.stringify({ source: "layer pg-test-layer refines @record\n  value = 1" }),
  });
  check("PUT a new layer is 201", response.status === 201);

  let dbRows = await pool.query("SELECT name, source FROM user_layers WHERE name = $1", [
    "pg-test-layer",
  ]);
  check(
    "the layer is in PostgreSQL",
    dbRows.rowCount === 1 &&
      (dbRows.rows[0] as { source: string }).source.includes("layer pg-test-layer"),
  );

  response = await fetch(base + "/api/layers/pg-test-layer", { headers: auth });
  const layerBody = (await response.json()) as { builtIn: boolean; source: string };
  check(
    "GET the layer reads it from PostgreSQL",
    response.status === 200 && !layerBody.builtIn && layerBody.source.includes("value = 1"),
  );

  response = await fetch(base + "/api/layers", { headers: auth });
  const layersBody = (await response.json()) as {
    layers: { name: string; builtIn: boolean }[];
  };
  check(
    "GET /api/layers lists the user layer as not builtIn",
    layersBody.layers.some((layer) => layer.name === "pg-test-layer" && !layer.builtIn),
  );

  response = await fetch(base + "/api/layers/pg-test-layer", {
    method: "PUT",
    headers: { ...auth, "Content-Type": "application/json" },
    body: JSON.stringify({ source: "layer pg-test-layer refines @record\n  value = 2" }),
  });
  check("PUT an existing layer is 200 (upsert)", response.status === 200);
  dbRows = await pool.query("SELECT source FROM user_layers WHERE name = $1", ["pg-test-layer"]);
  check(
    "the upsert updated the row in PostgreSQL",
    (dbRows.rows[0] as { source: string }).source.includes("value = 2"),
  );

  response = await fetch(base + "/api/formalismes/pg-test-layer", { method: "DELETE", headers: auth });
  check("DELETE the layer is 200", response.status === 200);
  dbRows = await pool.query("SELECT name FROM user_layers WHERE name = $1", ["pg-test-layer"]);
  check("the row is gone from PostgreSQL", dbRows.rowCount === 0);
  response = await fetch(base + "/api/layers/pg-test-layer", { headers: auth });
  check("GET the deleted layer is 404", response.status === 404);
  response = await fetch(base + "/api/formalismes/pg-test-layer", { method: "DELETE", headers: auth });
  check("DELETE the deleted layer is 404", response.status === 404);
} finally {
  server.close();
  await pool.end();
  rmSync(sandbox, { recursive: true, force: true });
}

console.log(assertions + " assertions, " + failures.length + " échec(s)");
for (const failure of failures) console.log("FAIL " + failure);
process.exit(failures.length === 0 ? 0 : 1);
