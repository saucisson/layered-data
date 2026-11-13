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
  const { asLayerName } = await import("../server/layerStore.ts");
  const ownedNameCheck = asLayerName({ candidate: "pg-owned-layer" });
  if ("reason" in ownedNameCheck) throw new Error("bad test layer name");
  await stores.userLayers.write({
    name: ownedNameCheck.name,
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
    ownedNames.includes("pg-owned-layer") && !ownedNames.includes("pg-test-layer"),
  );
  const allNames = await stores.userLayers.listNames();
  check(
    "listNames() without ownerId returns all layers",
    allNames.includes("pg-owned-layer"),
  );

  await pool.query("DELETE FROM user_layers WHERE owner = $1", [userId]);
  await pool.query("DELETE FROM users WHERE id = $1", [userId]);
}

// ---- the user store (issue #140, ADR-0114) ----
{
  const { hashAccessCode } = await import("../server/httpUtils.ts");
  const personalCode = "pg-personal-code-140";
  const hash = hashAccessCode({ code: personalCode });
  const created = await stores.users.create({
    displayName: "pg-user-140",
    accessCodeHash: hash,
    role: "user",
  });
  check("users.create returns a profile with an id", typeof created.id === "number");
  const found = await stores.users.findByAccessCodeHash({ accessCodeHash: hash });
  check(
    "users.findByAccessCodeHash finds the created user",
    found !== null && found.displayName === "pg-user-140" && found.role === "user",
  );
  const missing = await stores.users.findByAccessCodeHash({ accessCodeHash: "no-such-hash" });
  check("users.findByAccessCodeHash misses an unknown hash", missing === null);
  const all = await stores.users.list();
  check("users.list includes the created user", all.some((u) => u.id === created.id));
  const revoked = await stores.users.revoke({ id: created.id });
  check("users.revoke removes the user", revoked.existed);
  const afterRevoke = await stores.users.findByAccessCodeHash({ accessCodeHash: hash });
  check("the revoked user is no longer found", afterRevoke === null);
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

  // ---- per-user auth over HTTP (issue #140, ADR-0114) ----
  {
    const { hashAccessCode } = await import("../server/httpUtils.ts");
    const personalCode = "pg-http-personal-140";
    const profile = await stores.users.create({
      displayName: "pg-http-user",
      accessCodeHash: hashAccessCode({ code: personalCode }),
      role: "user",
    });
    const personalAuth = { "x-access-code": personalCode };

    response = await fetch(base + "/api/whoami", { headers: personalAuth });
    const whoamiBody = (await response.json()) as {
      utilisateur: string;
      identity: string;
      user?: { id: number; displayName: string; role: string };
    };
    check(
      "whoami with a personal code returns the user profile",
      response.status === 200 &&
        whoamiBody.identity === "personal-code" &&
        whoamiBody.user?.id === profile.id &&
        whoamiBody.user?.displayName === "pg-http-user",
    );

    // the personal code scopes the layers to its owner
    response = await fetch(base + "/api/layers/pg-personal-layer", {
      method: "PUT",
      headers: { ...personalAuth, "Content-Type": "application/json" },
      body: JSON.stringify({ source: "layer pg-personal-layer refines @record\n  v = 1" }),
    });
    check("PUT a layer with a personal code is 201", response.status === 201);
    const ownerRow = await pool.query("SELECT owner FROM user_layers WHERE name = $1", [
      "pg-personal-layer",
    ]);
    check(
      "the layer is stamped with the personal owner",
      (ownerRow.rows[0] as { owner: number }).owner === profile.id,
    );

    response = await fetch(base + "/api/layers", { headers: personalAuth });
    const personalLayers = (await response.json()) as {
      layers: { name: string; builtIn: boolean }[];
    };
    check(
      "GET /api/layers with a personal code lists only the owner's layers",
      personalLayers.layers.some((l) => l.name === "pg-personal-layer") &&
        !personalLayers.layers.some((l) => l.name === "pg-test-layer"),
    );

    // the shared code still sees all layers (no scoping)
    response = await fetch(base + "/api/layers", { headers: auth });
    const sharedLayers = (await response.json()) as {
      layers: { name: string; builtIn: boolean }[];
    };
    check(
      "GET /api/layers with the shared code lists all layers",
      sharedLayers.layers.some((l) => l.name === "pg-personal-layer") &&
        sharedLayers.layers.some((l) => l.name === "pg-test-layer"),
    );

    await pool.query("DELETE FROM user_layers WHERE owner = $1", [profile.id]);
    await stores.users.revoke({ id: profile.id });
  }

  // ---- admin routes over HTTP (issue #142, ADR-0114) ----
  {
    const { hashAccessCode } = await import("../server/httpUtils.ts");
    const adminCode = "pg-admin-code-142";
    const adminProfile = await stores.users.create({
      displayName: "pg-admin",
      accessCodeHash: hashAccessCode({ code: adminCode }),
      role: "admin",
    });
    const adminAuth = { "x-access-code": adminCode };

    response = await fetch(base + "/api/admin/users", { headers: adminAuth });
    const adminBody = (await response.json()) as {
      users: { id: number; displayName: string; role: string }[];
    };
    check(
      "GET /api/admin/users with an admin code lists users",
      response.status === 200 && adminBody.users.some((u) => u.id === adminProfile.id),
    );

    // a regular user is refused on admin routes
    const userCode = "pg-user-code-142";
    const userProfile = await stores.users.create({
      displayName: "pg-user-142",
      accessCodeHash: hashAccessCode({ code: userCode }),
      role: "user",
    });
    response = await fetch(base + "/api/admin/users", { headers: { "x-access-code": userCode } });
    check("GET /api/admin/users with a non-admin code is 403", response.status === 403);

    response = await fetch(base + "/api/admin/users/revoke", {
      method: "POST",
      headers: { ...adminAuth, "Content-Type": "application/json" },
      body: JSON.stringify({ id: userProfile.id }),
    });
    check("POST /api/admin/users/revoke with an admin code is 200", response.status === 200);
    const revokedCheck = await stores.users.findByAccessCodeHash({
      accessCodeHash: hashAccessCode({ code: userCode }),
    });
    check("the revoked user is gone", revokedCheck === null);

    response = await fetch(base + "/api/admin/users/revoke", {
      method: "POST",
      headers: { ...adminAuth, "Content-Type": "application/json" },
      body: JSON.stringify({ id: 999999 }),
    });
    check("revoke of an unknown id is 404", response.status === 404);

    await stores.users.revoke({ id: adminProfile.id });
  }

  // ---- account creation over HTTP (issue #141, ADR-0114) ----
  {
    response = await fetch(base + "/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ displayName: "pg-created-user", accessCode: "pg-created-code-141" }),
    });
    const createdBody = (await response.json()) as {
      id: number;
      displayName: string;
      role: string;
    };
    check(
      "POST /api/users creates a user (201)",
      response.status === 201 && createdBody.displayName === "pg-created-user" && createdBody.role === "user",
    );

    // the new personal code now authenticates
    response = await fetch(base + "/api/whoami", {
      headers: { "x-access-code": "pg-created-code-141" },
    });
    const whoamiCreated = (await response.json()) as { identity: string; user?: { id: number } };
    check(
      "the created user's code authenticates via whoami",
      response.status === 200 && whoamiCreated.identity === "personal-code" && whoamiCreated.user?.id === createdBody.id,
    );

    // duplicate access code is a 409
    response = await fetch(base + "/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ displayName: "other", accessCode: "pg-created-code-141" }),
    });
    check("POST /api/users with a taken code is 409", response.status === 409);

    // invalid body is a 400
    response = await fetch(base + "/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ displayName: "x", accessCode: "short" }),
    });
    check("POST /api/users with a short code is 400", response.status === 400);

    await stores.users.revoke({ id: createdBody.id });
  }

  // ---- cross-user visibility (issue #146, ADR-0114 addendum) ----
  {
    const { hashAccessCode } = await import("../server/httpUtils.ts");
    const aliceCode = "pg-alice-code-146";
    const bobCode = "pg-bob-code-146";
    const alice = await stores.users.create({
      displayName: "alice",
      accessCodeHash: hashAccessCode({ code: aliceCode }),
      role: "user",
    });
    const bob = await stores.users.create({
      displayName: "bob",
      accessCodeHash: hashAccessCode({ code: bobCode }),
      role: "user",
    });
    const aliceAuth = { "x-access-code": aliceCode };
    const bobAuth = { "x-access-code": bobCode };

    // alice writes a private layer
    response = await fetch(base + "/api/layers/alice-private", {
      method: "PUT",
      headers: { ...aliceAuth, "Content-Type": "application/json" },
      body: JSON.stringify({ source: "layer alice-private refines @record\n  v = 1" }),
    });
    check("alice PUT her private layer is 201", response.status === 201);

    // bob cannot see alice's private layer in the list
    response = await fetch(base + "/api/layers", { headers: bobAuth });
    const bobLayers = (await response.json()) as { layers: { name: string }[] };
    check(
      "bob does not see alice's private layer",
      !bobLayers.layers.some((l) => l.name === "alice-private"),
    );

    // alice publishes the layer
    response = await fetch(base + "/api/layers/alice-private/publish", {
      method: "POST",
      headers: aliceAuth,
    });
    check("alice publishes her layer (200)", response.status === 200);

    // bob now sees it
    response = await fetch(base + "/api/layers", { headers: bobAuth });
    const bobLayersAfter = (await response.json()) as { layers: { name: string }[] };
    check(
      "bob sees alice's public layer after publish",
      bobLayersAfter.layers.some((l) => l.name === "alice-private"),
    );

    // the shared code cannot publish (no personal account)
    response = await fetch(base + "/api/layers/alice-private/publish", {
      method: "POST",
      headers: auth,
    });
    check("publish with the shared code is 403", response.status === 403);

    await pool.query("DELETE FROM user_layers WHERE owner IN ($1, $2)", [alice.id, bob.id]);
    await stores.users.revoke({ id: alice.id });
    await stores.users.revoke({ id: bob.id });
  }

  // ---- frozen formalism edit guard (issue #157, ADR-0116) ----
  {
    // write a layer, freeze it, then try to PUT again — must be 409
    response = await fetch(base + "/api/layers/pg-frozen-layer", {
      method: "PUT",
      headers: { ...auth, "Content-Type": "application/json" },
      body: JSON.stringify({ source: "layer pg-frozen-layer refines @record\n  v = 1" }),
    });
    check("PUT the layer to freeze is 201", response.status === 201);

    response = await fetch(base + "/api/formalisms/pg-frozen-layer/freeze", {
      method: "POST",
      headers: auth,
    });
    check("freeze the layer is 201", response.status === 201);

    response = await fetch(base + "/api/layers/pg-frozen-layer", {
      method: "PUT",
      headers: { ...auth, "Content-Type": "application/json" },
      body: JSON.stringify({ source: "layer pg-frozen-layer refines @record\n  v = 2" }),
    });
    const frozenBody = (await response.json()) as { erreur: string; frozenSemver?: string };
    check(
      "PUT on a frozen formalism is 409 with the frozen semver",
      response.status === 409 && frozenBody.frozenSemver === "1.0.0",
    );

    // the frozen version stays readable
    response = await fetch(base + "/api/layers/pg-frozen-layer", { headers: auth });
    check("GET the frozen layer is still 200", response.status === 200);

    await pool.query("DELETE FROM formalism_versions WHERE formalism_id = $1", [
      "pg-frozen-layer",
    ]);
    await pool.query("DELETE FROM user_layers WHERE name = $1", ["pg-frozen-layer"]);
  }

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
