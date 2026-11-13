// The PostgreSQL integration checks (issue #109, ADR-0111): the
// UserLayerStore and the EditorSessionStore against a REAL PostgreSQL,
// over real HTTP — layer CRUD, the editor session with two SSE
// clients, the journal (history) and the restore.
//
// Without DATABASE_URL these checks SKIP (CI stays green). Run them
// locally against the compose stack:
//
//     POSTGRES_USER=u POSTGRES_PASSWORD=p docker compose up -d postgres
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
  console.log("SKIP postgres-store-checks : DATABASE_URL absent — run with docker compose up -d postgres");
  rmSync(sandbox, { recursive: true, force: true });
  process.exit(0);
}

const { Pool } = await import("pg");
const pool = new Pool({ connectionString: DATABASE_URL });
const { createQuarryStoresFromEnv, initQuarryStores } = await import("../server/stores.ts");
const { createQuarryServer } = await import("../server/routes.ts");

// ---- a tiny SSE client ----------------------------------------------

interface SseEvent {
  event: string;
  data: any;
}

function connectSse({
  url,
  headers,
  signal,
}: {
  url: string;
  headers: Record<string, string>;
  signal: AbortSignal;
}) {
  const queue: SseEvent[] = [];
  const done = fetch(url, { headers, signal })
    .then(async (response) => {
    const reader = (response.body as ReadableStream<Uint8Array>).getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    for (;;) {
      const { value, done: streamDone } = await reader.read();
      if (streamDone) break;
      buffer += decoder.decode(value, { stream: true });
      const parts = buffer.split("\n\n");
      buffer = parts.pop() ?? "";
      for (const raw of parts) {
        const eventLine = raw.split("\n").find((line) => line.startsWith("event: "));
        const dataLine = raw.split("\n").find((line) => line.startsWith("data: "));
        if (eventLine && dataLine) {
          queue.push({ event: eventLine.slice(7), data: JSON.parse(dataLine.slice(6)) });
        }
      }
    }
    })
    .catch(() => undefined); // aborted at teardown
  return {
    done,
    async next({ event, timeoutMs = 5000 }: { event: string; timeoutMs?: number }): Promise<any> {
      const deadline = Date.now() + timeoutMs;
      for (;;) {
        const index = queue.findIndex((entry) => entry.event === event);
        if (index >= 0) return queue.splice(index, 1)[0]?.data;
        if (Date.now() > deadline) throw new Error("SSE timeout waiting for event " + event);
        await new Promise((resolve) => setTimeout(resolve, 25));
      }
    },
  };
}

// ---- boot against the real PostgreSQL --------------------------------

const stores = createQuarryStoresFromEnv();
await initQuarryStores({ stores });

// clean slate — after init, so the schema exists even on a fresh volume
await pool.query("DELETE FROM editor_session_events");
await pool.query("DELETE FROM editor_session");
await pool.query("DELETE FROM formalism_versions");
await pool.query("DELETE FROM user_layers");

// ---- the users schema (issue #139, ADR-0114) ----
{
  const usersTable = await pool.query(
    "SELECT table_name FROM information_schema.tables WHERE table_name = 'users'",
  );
  check("the users table exists", usersTable.rowCount === 1);
  const ownerColumn = await pool.query(
    "SELECT column_name FROM information_schema.columns WHERE table_name = 'user_layers' AND column_name = 'owner'",
  );
  check("user_layers.owner exists", ownerColumn.rowCount === 1);
  const statusColumn = await pool.query(
    "SELECT column_name FROM information_schema.columns WHERE table_name = 'user_layers' AND column_name = 'status'",
  );
  check("user_layers.status exists", statusColumn.rowCount === 1);
  const ownerNullable = await pool.query(
    "SELECT is_nullable FROM information_schema.columns WHERE table_name = 'user_layers' AND column_name = 'owner'",
  );
  check(
    "user_layers.owner is nullable (legacy layers keep NULL)",
    (ownerNullable.rows[0] as { is_nullable: string }).is_nullable === "YES",
  );
  await pool.query(
    "INSERT INTO users (display_name, access_code_hash, role) VALUES ($1, $2, $3) ON CONFLICT (access_code_hash) DO NOTHING",
    ["pg-test-user", "hash-pg-test-user", "user"],
  );
  const userRow = await pool.query("SELECT id, role FROM users WHERE access_code_hash = $1", [
    "hash-pg-test-user",
  ]);
  check("a user row can be inserted and read back", userRow.rowCount === 1);
  const userId = (userRow.rows[0] as { id: number }).id;

  // owner stamping through the store (issue #139)
  await stores.userLayers.write({
    name: "pg-owned-layer" as never,
    source: "layer pg-owned-layer refines @record\n  value = 42",
    ownerId: userId,
  });
  const ownedRow = await pool.query(
    "SELECT owner FROM user_layers WHERE name = $1",
    ["pg-owned-layer"],
  );
  check(
    "write with ownerId stamps the row",
    (ownedRow.rows[0] as { owner: number }).owner === userId,
  );
  const ownedNames = await stores.userLayers.listNames({ ownerId: userId });
  check(
    "listNames({ ownerId }) returns only that owner's layers",
    ownedNames.includes("pg-owned-layer"),
  );
  const allNames = await stores.userLayers.listNames();
  check(
    "listNames() without ownerId returns all layers",
    allNames.includes("pg-owned-layer"),
  );

  await pool.query("DELETE FROM user_layers WHERE owner = $1", [userId]);
  await pool.query("DELETE FROM users WHERE id = $1", [userId]);
}

// ---- the formalism_versions schema (issue #148, ADR-0116) ----
{
  const versionsTable = await pool.query(
    "SELECT table_name FROM information_schema.tables WHERE table_name = 'formalism_versions'",
  );
  check("the formalism_versions table exists", versionsTable.rowCount === 1);
  const fingerprintColumn = await pool.query(
    "SELECT column_name FROM information_schema.columns WHERE table_name = 'formalism_versions' AND column_name = 'dump_fingerprint'",
  );
  check("formalism_versions.dump_fingerprint exists", fingerprintColumn.rowCount === 1);
}

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

  response = await fetch(base + "/api/layers/pg-test-layer", { headers: auth });
  check("GET the written layer is 200", response.status === 200);
  response = await fetch(base + "/api/layers/never-written-layer", { headers: auth });
  check("GET an unknown layer is 404", response.status === 404);

  // ---- the editor session: two SSE clients, journal, restore ----
  const sseController = new AbortController();
  const clientA = connectSse({ url: base + "/api/editor/session", headers: auth, signal: sseController.signal });
  const clientB = connectSse({ url: base + "/api/editor/session", headers: auth, signal: sseController.signal });
  await clientA.next({ event: "hello" });
  await clientB.next({ event: "hello" });
  const initialA = await clientA.next({ event: "state" });
  await clientB.next({ event: "state" });
  check("the session starts at version 0", initialA.version === 0);

  response = await fetch(base + "/api/editor/gesture", {
    method: "POST",
    headers: { ...auth, "Content-Type": "application/json" },
    body: JSON.stringify({
      source: "layer pn-demo refines @petrinet-scheme then @positions-grid",
      baseVersion: 0,
    }),
  });
  const gestureBody = (await response.json()) as { ok: boolean; version: number };
  check("the gesture is accepted (200, version 1)", response.status === 200 && gestureBody.version === 1);

  const broadcast = await clientB.next({ event: "state" });
  check(
    "the second SSE client received the broadcast state",
    broadcast.version === 1 &&
      broadcast.additions.some((addition: { name: string }) => addition.name === "pn-demo"),
  );

  // BIGINT columns come back from pg as strings — compare as numbers
  const journalRows = await pool.query("SELECT version FROM editor_session_events ORDER BY version");
  check(
    "the journal row is in PostgreSQL",
    journalRows.rows.some((row) => Number((row as { version: unknown }).version) === 1),
  );
  const snapshotRows = await pool.query("SELECT version FROM editor_session WHERE id = 1");
  check(
    "the snapshot row is in PostgreSQL",
    Number((snapshotRows.rows[0] as { version: unknown } | undefined)?.version) === 1,
  );

  response = await fetch(base + "/api/editor/history", { headers: auth });
  const historyBody = (await response.json()) as { entries: { version: number }[] };
  check(
    "GET /api/editor/history lists version 1",
    response.status === 200 && historyBody.entries.some((entry) => entry.version === 1),
  );

  response = await fetch(base + "/api/editor/restore", {
    method: "POST",
    headers: { ...auth, "Content-Type": "application/json" },
    body: JSON.stringify({ version: 1, baseVersion: 1 }),
  });
  const restoreBody = (await response.json()) as { ok: boolean; version: number; restoredVersion: number };
  check(
    "restore to version 1 becomes version 2",
    response.status === 200 && restoreBody.ok && restoreBody.version === 2 && restoreBody.restoredVersion === 1,
  );

  response = await fetch(base + "/api/editor/history", { headers: auth });
  const historyAfter = (await response.json()) as { entries: { version: number }[] };
  check(
    "the journal now holds versions 1 and 2",
    historyAfter.entries.some((entry) => entry.version === 1) &&
      historyAfter.entries.some((entry) => entry.version === 2),
  );

  response = await fetch(base + "/api/editor/gesture", {
    method: "POST",
    headers: { ...auth, "Content-Type": "application/json" },
    body: JSON.stringify({ source: "layer pn-demo refines @petrinet-scheme", baseVersion: 0 }),
  });
  check("a stale baseVersion is a 409 conflict", response.status === 409);

  response = await fetch(base + "/api/editor/restore", {
    method: "POST",
    headers: { ...auth, "Content-Type": "application/json" },
    body: JSON.stringify({ version: 999, baseVersion: 2 }),
  });
  check("restore to an unknown version is 404", response.status === 404);

  sseController.abort();
  await clientA.done;
  await clientB.done;
} finally {
  server.close();
  await pool.end();
  rmSync(sandbox, { recursive: true, force: true });
}

console.log(assertions + " assertions, " + failures.length + " échec(s)");
for (const failure of failures) console.log("FAIL " + failure);
process.exit(failures.length === 0 ? 0 : 1);
