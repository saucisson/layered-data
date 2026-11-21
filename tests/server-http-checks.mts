// The HTTP integration checks of the quarry server (server/): the
// server boots on an ephemeral port against throwaway directories
// (LD_USERS_DIRECTORY / LD_DATA_DIRECTORY), and every route family
// is exercised over real HTTP — auth, the layers API, the bedrock
// guard, the editor session (SSE + CAS gestures) and the geologist
// refusal without a key. The Mistral client is never called.
//
//     node tests/server-http-checks.mts   (exit 1 on any failure)

import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
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

// ---- boot the server against throwaway directories ------------------

const sandbox = mkdtempSync(join(tmpdir(), "ld-server-test-"));
process.env.LD_USERS_DIRECTORY = join(sandbox, "users");
process.env.LD_DATA_DIRECTORY = join(sandbox, "data");
// an empty string counts as set: .env must not reintroduce a real key
process.env.MISTRAL_API_KEY = "";
// same isolation for the stores: this harness runs on the disk stores
process.env.DATABASE_URL = "";

const { createQuarryServer } = await import("../server/routes.ts");
const { createAuthService, authConfigFromEnv } = await import("../server/auth/service.ts");
// The CRUD checks run with AUTH_DISABLED=1 (local mode without IdP,
// milestone Auth v1): the session/JWT/PAT paths and the 401s are
// covered by tests/auth-flow-checks.mts.
const server: Server = createQuarryServer({
  authService: createAuthService({
    config: { ...authConfigFromEnv({ env: {} }), disabled: true },
  }),
});
await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
const port = (server.address() as AddressInfo).port;
const base = "http://127.0.0.1:" + port;
const auth = {};

try {
  // ---- auth (AUTH_DISABLED=1 in this harness; the 401 paths live in
  // tests/auth-flow-checks.mts) ----
  let response = await fetch(base + "/api/whoami");
  check("whoami without credentials is 200 in AUTH_DISABLED mode", response.status === 200);
  const whoamiBody = (await response.json()) as { utilisateur: string; identity: string };
  check(
    "whoami resolves to the dev user (milestone Auth v1)",
    whoamiBody.utilisateur === "développeur-local" && whoamiBody.identity === "dev-user",
  );
  response = await fetch(base + "/api/layers");
  check("layers without credentials is 200 in AUTH_DISABLED mode", response.status === 200);
  // Admin routes require an admin user (issue #142): the dev user is
  // not an admin, so 403.
  response = await fetch(base + "/api/admin/users");
  check("admin users list without an admin user is 403", response.status === 403);
  response = await fetch(base + "/api/admin/users/revoke", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id: 1 }),
  });
  check("admin revoke without an admin user is 403", response.status === 403);
  // Account creation (issue #141): without DATABASE_URL the null
  // user store refuses creation with a 500 typed error.
  response = await fetch(base + "/api/users", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ displayName: "test", accessCode: "long-enough-code" }),
  });
  check("account creation without DATABASE_URL fails (no user store)", response.status === 500);
  response = await fetch(base + "/api/users", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ displayName: "", accessCode: "short" }),
  });
  check("account creation with invalid body is 400", response.status === 400);

  // ---- qualified formalism identifiers (issue #143, ADR-0115) ----
  const { asFormalismId } = await import("../server/layerStore.ts");
  const qualified = asFormalismId({ candidate: "@alice/petri" });
  check(
    "@alice/petri is a valid formalism id",
    "formalismId" in qualified && qualified.user === "alice" && qualified.formalism === "petri",
  );
  check("a bare name is not a formalism id", !("formalismId" in asFormalismId({ candidate: "petri" })));
  check("three segments are not a formalism id", !("formalismId" in asFormalismId({ candidate: "@a/b/c" })));
  check("uppercase is refused", !("formalismId" in asFormalismId({ candidate: "@Alice/petri" })));

  // ---- semver parsing and bare-name resolution rules (issue #148, ADR-0116) ----
  const { parseSemVer, compareSemVer } = await import("../server/formalismVersionStore.ts");
  check(
    "parseSemVer reads 2.1.0",
    JSON.stringify(parseSemVer({ semver: "2.1.0" })) === '{"major":2,"minor":1,"patch":0}',
  );
  check("parseSemVer refuses garbage", parseSemVer({ semver: "v2" }) === null);
  check(
    "compareSemVer orders by major then minor then patch",
    compareSemVer(parseSemVer({ semver: "2.0.0" })!, parseSemVer({ semver: "10.0.0" })!) < 0 &&
      compareSemVer(parseSemVer({ semver: "1.9.0" })!, parseSemVer({ semver: "1.10.0" })!) < 0,
  );

  // ---- the security header baseline (issue #84) ----
  response = await fetch(base + "/api/whoami", { headers: auth });
  check("X-Content-Type-Options is nosniff", response.headers.get("x-content-type-options") === "nosniff");
  check("X-Frame-Options is DENY", response.headers.get("x-frame-options") === "DENY");
  check("Referrer-Policy is no-referrer", response.headers.get("referrer-policy") === "no-referrer");
  response = await fetch(base + "/api/whoami");
  check("the baseline is present even on a 401", response.headers.get("x-frame-options") === "DENY");

  // ---- the layers API ----
  response = await fetch(base + "/api/layers", { headers: auth });
  const layersBody = (await response.json()) as {
    layers: { name: string; builtIn: boolean }[];
  };
  check(
    "layers lists the kernel as builtIn",
    response.status === 200 && layersBody.layers.some((l) => l.builtIn && l.name === "record"),
  );

  response = await fetch(base + "/api/layers/record", { headers: auth });
  const recordBody = (await response.json()) as {
    name: string;
    builtIn: boolean;
    source: string;
  };
  check(
    "GET a kernel layer returns its source",
    response.status === 200 && recordBody.builtIn && recordBody.source.includes("layer record"),
  );

  response = await fetch(base + "/api/layers/http-test-demo", {
    method: "PUT",
    headers: { ...auth, "Content-Type": "application/json" },
    body: JSON.stringify({
      source: "layer http-test-demo refines @record\n  x = 1\n",
    }),
  });
  check("PUT a user layer is 201", response.status === 201);

  // ---- freeze a formalism (issue #155, ADR-0116) ----
  response = await fetch(base + "/api/formalisms/http-test-demo/freeze", {
    method: "POST",
    headers: auth,
  });
  const freezeBody = (await response.json()) as { name: string; semver: string; status: string };
  check(
    "POST freeze stamps the first publication 1.0.0",
    response.status === 201 && freezeBody.semver === "1.0.0" && freezeBody.status === "frozen",
  );
  response = await fetch(base + "/api/formalisms/record/freeze", {
    method: "POST",
    headers: auth,
  });
  check("freezing a bedrock layer is refused", response.status === 403);
  response = await fetch(base + "/api/formalisms/unknown-layer/freeze", {
    method: "POST",
    headers: auth,
  });
  check("freezing an unknown formalism is 404", response.status === 404);
  response = await fetch(base + "/api/layers/http-test-demo", {
    headers: auth,
  });
  check(
    "GET the written layer reads it back",
    response.status === 200 && ((await response.json()) as { source: string }).source.includes("http-test-demo"),
  );
  response = await fetch(base + "/api/layers/http-test-demo", {
    method: "PUT",
    headers: { ...auth, "Content-Type": "application/json" },
    body: JSON.stringify({
      source: "layer http-test-demo refines @record\n  x = 2\n",
    }),
  });
  check("PUT again is 200 (not created)", response.status === 200);
  response = await fetch(base + "/api/layers/record", {
    method: "PUT",
    headers: { ...auth, "Content-Type": "application/json" },
    body: JSON.stringify({ source: "layer record\n" }),
  });
  check("PUT on the bedrock is 403", response.status === 403);
  response = await fetch(base + "/api/layers/never-written-layer", {
    headers: auth,
  });
  check("GET an unknown layer is 404", response.status === 404);

  // ---- the editor session: SSE + CAS gestures ----
  const sseResponse = await fetch(base + "/api/editor/session", {
    headers: auth,
  });
  check(
    "the session stream is SSE",
    sseResponse.status === 200 && (sseResponse.headers.get("content-type") ?? "").includes("text/event-stream"),
  );
  const reader = sseResponse.body!.getReader();
  const decoder = new TextDecoder();
  let sseText = "";
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline && !(sseText.includes("event: hello") && sseText.includes("event: state"))) {
    const { value, done } = await reader.read();
    if (done) break;
    sseText += decoder.decode(value, { stream: true });
  }
  await reader.cancel();
  check("the stream opens with hello then state", sseText.includes("event: hello") && sseText.includes("event: state"));
  const helloMatch = /event: hello\ndata: (\{[^}]*\})/.exec(sseText);
  const clientId = helloMatch === null ? "" : (JSON.parse(helloMatch[1] ?? "") as { clientId: string }).clientId;
  check("hello carries a clientId", clientId.length > 0);

  // presence while the stream is still open (closing it drops the client)
  response = await fetch(base + "/api/editor/presence", {
    method: "POST",
    headers: { ...auth, "Content-Type": "application/json" },
    body: JSON.stringify({ clientId, focus: "pn-philosophers-5" }),
  });
  check("presence of a known client is 200", response.status === 200);
  await reader.cancel();

  response = await fetch(base + "/api/editor/gesture", {
    method: "POST",
    headers: { ...auth, "Content-Type": "application/json" },
    body: JSON.stringify({
      source: "layer http-gesture refines @record\n  y = 1\n",
      baseVersion: 0,
    }),
  });
  const gestureBody = (await response.json()) as {
    ok: boolean;
    version?: number;
  };
  check(
    "an accepted gesture is 200 with the new version",
    response.status === 200 && gestureBody.ok === true && typeof gestureBody.version === "number",
  );

  response = await fetch(base + "/api/editor/gesture", {
    method: "POST",
    headers: { ...auth, "Content-Type": "application/json" },
    body: JSON.stringify({
      source: "layer http-gesture-2 refines @record\n  y = 2\n",
      baseVersion: 0,
    }),
  });
  check("a stale baseVersion is 409 conflict", response.status === 409);

  response = await fetch(base + "/api/editor/gesture", {
    method: "POST",
    headers: { ...auth, "Content-Type": "application/json" },
    body: JSON.stringify({
      source: "layer broken refines @no-such-layer\n",
      baseVersion: gestureBody.version ?? 1,
    }),
  });
  check(
    "a refused gesture is 422 with verdicts",
    response.status === 422 && ((await response.json()) as { reason: string }).reason === "refused",
  );

  // ---- the geologist without a key refuses locally ----
  response = await fetch(base + "/api/generate", {
    method: "POST",
    headers: { ...auth, "Content-Type": "application/json" },
    body: JSON.stringify({ prompt: "une couche de test" }),
  });
  check(
    "generate without MISTRAL_API_KEY is 500 and speaks",
    response.status === 500 && (await response.text()).includes("MISTRAL_API_KEY"),
  );

  // ---- unknown route ----
  response = await fetch(base + "/api/nope", { headers: auth });
  check("an unknown api route is 404", response.status === 404);

  // ---- static hosting (#292–#295) ----
  // The server job never builds, so dist/ is absent in CI: plant a
  // fixture build, exercise it over real HTTP, remove it. On a dev
  // machine with a real dist/ the section is skipped (never clobber).
  const distDirectory = join(import.meta.dirname, "..", "dist");
  const distExisted = existsSync(distDirectory);
  if (!distExisted) {
    mkdirSync(join(distDirectory, "assets"), { recursive: true });
    mkdirSync(join(distDirectory, "logos"), { recursive: true });
    writeFileSync(join(distDirectory, "index.html"), "<!doctype html><title>t</title>");
    writeFileSync(join(distDirectory, "assets", "app-abc123.js"), "console.log(1);");
    writeFileSync(join(distDirectory, "logos", "logo.png"), Buffer.from([0x89, 0x50, 0x4e, 0x47]));
    writeFileSync(join(distDirectory, "robots.txt"), "User-agent: *\n");
    writeFileSync(join(distDirectory, "layered-data.vsix"), "PK");
  }
  try {
    if (!distExisted) {
      response = await fetch(base + "/");
      check(
        "GET / is 200 text/html with no-cache",
        response.status === 200 &&
          (response.headers.get("content-type") ?? "").includes("text/html") &&
          response.headers.get("cache-control") === "no-cache",
      );
      const headRoot = await fetch(base + "/", { method: "HEAD" });
      check(
        "HEAD / is 200 with the same headers and no body (#292)",
        headRoot.status === 200 &&
          (headRoot.headers.get("content-type") ?? "").includes("text/html") &&
          Number(headRoot.headers.get("content-length")) > 0 &&
          (await headRoot.text()) === "",
      );
      response = await fetch(base + "/assets/app-abc123.js");
      check(
        "a hashed asset is immutable for a year (#295)",
        response.status === 200 &&
          (response.headers.get("content-type") ?? "").includes("text/javascript") &&
          response.headers.get("cache-control") === "public, max-age=31536000, immutable",
      );
      const headAsset = await fetch(base + "/assets/app-abc123.js", { method: "HEAD" });
      check("HEAD on an asset is 200 without a body", headAsset.status === 200 && (await headAsset.text()) === "");
      response = await fetch(base + "/logos/logo.png");
      check("a PNG is image/png, not octet-stream (#294)", response.headers.get("content-type") === "image/png");
      response = await fetch(base + "/layered-data.vsix");
      check(
        "the .vsix is octet-stream with an attachment disposition (#294)",
        response.headers.get("content-type") === "application/octet-stream" &&
          (response.headers.get("content-disposition") ?? "").includes("attachment"),
      );
      response = await fetch(base + "/robots.txt");
      check(
        "robots.txt is served as its real file, not the SPA fallback",
        response.status === 200 && (await response.text()).includes("User-agent"),
      );
      response = await fetch(base + "/assets/missing-xyz.js");
      check("a missing asset is a real 404, not 200 HTML (#293)", response.status === 404);
      response = await fetch(base + "/missing.txt");
      check("a missing file with an extension is 404 too", response.status === 404);
      response = await fetch(base + "/workshop");
      check(
        "an extensionless navigation path falls back to index.html (#293)",
        response.status === 200 && (response.headers.get("content-type") ?? "").includes("text/html"),
      );
      response = await fetch(base + "/%2e%2e/package.json");
      check("an encoded traversal stays a 404", response.status === 404);
    }
  } finally {
    if (!distExisted) rmSync(distDirectory, { recursive: true, force: true });
  }
} finally {
  server.close();
  rmSync(sandbox, { recursive: true, force: true });
}

console.log("server http checks: " + assertions + " assertions, " + failures.length + " failure(s)");
for (const failure of failures) console.log("FAIL " + failure);
if (failures.length > 0) process.exit(1);
