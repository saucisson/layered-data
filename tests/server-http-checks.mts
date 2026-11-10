// The HTTP integration checks of the quarry server (server/): the
// server boots on an ephemeral port against throwaway directories
// (LD_USERS_DIRECTORY / LD_DATA_DIRECTORY), and every route family
// is exercised over real HTTP — auth, the layers API, the bedrock
// guard, the editor session (SSE + CAS gestures) and the geologist
// refusal without a key. The Mistral client is never called.
//
//     node tests/server-http-checks.mts   (exit 1 on any failure)

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

// ---- boot the server against throwaway directories ------------------

const sandbox = mkdtempSync(join(tmpdir(), "ld-server-test-"));
process.env.LD_USERS_DIRECTORY = join(sandbox, "users");
process.env.LD_DATA_DIRECTORY = join(sandbox, "data");
process.env.API_TOKEN = "test-token";
// an empty string counts as set: .env must not reintroduce a real key
process.env.MISTRAL_API_KEY = "";

const { createQuarryServer } = await import("../server/routes.ts");
const server: Server = createQuarryServer();
await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
const port = (server.address() as AddressInfo).port;
const base = "http://127.0.0.1:" + port;
const auth = { "x-access-code": "test-token" };

try {
  // ---- auth ----
  let response = await fetch(base + "/api/whoami");
  check("whoami without token is 401", response.status === 401);
  response = await fetch(base + "/api/whoami", {
    headers: { "x-access-code": "wrong" },
  });
  check("whoami with a wrong token is 401", response.status === 401);
  response = await fetch(base + "/api/whoami", { headers: auth });
  check("whoami with the token is 200", response.status === 200);
  response = await fetch(base + "/api/layers");
  check("layers without token is 401", response.status === 401);

  // ---- the layers API ----
  response = await fetch(base + "/api/layers", { headers: auth });
  const layersBody = (await response.json()) as {
    layers: { name: string; builtIn: boolean }[];
  };
  check(
    "layers lists the kernel as builtIn",
    response.status === 200 &&
      layersBody.layers.some((l) => l.builtIn && l.name === "record"),
  );

  response = await fetch(base + "/api/layers/record", { headers: auth });
  const recordBody = (await response.json()) as {
    name: string;
    builtIn: boolean;
    source: string;
  };
  check(
    "GET a kernel layer returns its source",
    response.status === 200 &&
      recordBody.builtIn &&
      recordBody.source.includes("layer record"),
  );

  response = await fetch(base + "/api/layers/http-test-demo", {
    method: "PUT",
    headers: { ...auth, "Content-Type": "application/json" },
    body: JSON.stringify({
      source: "layer http-test-demo refines @record\n  x = 1\n",
    }),
  });
  check("PUT a user layer is 201", response.status === 201);
  response = await fetch(base + "/api/layers/http-test-demo", {
    headers: auth,
  });
  check(
    "GET the written layer reads it back",
    response.status === 200 &&
      ((await response.json()) as { source: string }).source.includes(
        "http-test-demo",
      ),
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
  response = await fetch(base + "/api/formalismes/http-test-demo", {
    method: "DELETE",
    headers: auth,
  });
  check("DELETE a user layer (compat API) is 200", response.status === 200);
  response = await fetch(base + "/api/layers/http-test-demo", {
    headers: auth,
  });
  check("GET a deleted layer is 404", response.status === 404);

  // ---- the editor session: SSE + CAS gestures ----
  const sseResponse = await fetch(base + "/api/editor/session", {
    headers: auth,
  });
  check(
    "the session stream is SSE",
    sseResponse.status === 200 &&
      (sseResponse.headers.get("content-type") ?? "").includes(
        "text/event-stream",
      ),
  );
  const reader = sseResponse.body!.getReader();
  const decoder = new TextDecoder();
  let sseText = "";
  const deadline = Date.now() + 5000;
  while (
    Date.now() < deadline &&
    !(sseText.includes("event: hello") && sseText.includes("event: state"))
  ) {
    const { value, done } = await reader.read();
    if (done) break;
    sseText += decoder.decode(value, { stream: true });
  }
  await reader.cancel();
  check(
    "the stream opens with hello then state",
    sseText.includes("event: hello") && sseText.includes("event: state"),
  );
  const helloMatch = /event: hello\ndata: (\{[^}]*\})/.exec(sseText);
  const clientId =
    helloMatch === null
      ? ""
      : (JSON.parse(helloMatch[1] ?? "") as { clientId: string }).clientId;
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
    response.status === 200 &&
      gestureBody.ok === true &&
      typeof gestureBody.version === "number",
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
    response.status === 422 &&
      ((await response.json()) as { reason: string }).reason === "refused",
  );

  // ---- the geologist without a key refuses locally ----
  response = await fetch(base + "/api/generate", {
    method: "POST",
    headers: { ...auth, "Content-Type": "application/json" },
    body: JSON.stringify({ prompt: "une couche de test" }),
  });
  check(
    "generate without MISTRAL_API_KEY is 500 and speaks",
    response.status === 500 &&
      (await response.text()).includes("MISTRAL_API_KEY"),
  );

  // ---- unknown route ----
  response = await fetch(base + "/api/nope", { headers: auth });
  check("an unknown api route is 404", response.status === 404);
} finally {
  server.close();
  rmSync(sandbox, { recursive: true, force: true });
}

console.log(
  "server http checks: " +
    assertions +
    " assertions, " +
    failures.length +
    " failure(s)",
);
for (const failure of failures) console.log("FAIL " + failure);
if (failures.length > 0) process.exit(1);
