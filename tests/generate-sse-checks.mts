// The two-pass geologist over HTTP (issue #279): POST /api/generate
// with Accept: text/event-stream streams its steps — selection,
// questions, round, refusal, draft, refused, error — while a mock
// upstream plays the survey model and the pen model. Without the
// Accept header the route keeps its documented plain-text behavior.
//
//     node tests/generate-sse-checks.mts   (exit 1 on any failure)

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";

// ---- the assertion ledger ------------------------------------------

const failures: string[] = [];
let assertions = 0;

function check(label: string, condition: boolean): void {
  assertions++;
  if (!condition) failures.push(label);
}

// ---- a mock Mistral upstream -----------------------------------------

// The survey answer is switched per scenario; the pen always answers
// the annex A fixture, accepted by the real staging in one attempt.
let surveyAnswer = "@dag\n@kahn-scheme\n";
let penScript: string[] | null = null;
let penCall = 0;
const modelCalls: string[] = [];

const booleanCircuitFixture = `layer boolean-circuit refines @dag
  extend specification
    gate_type refines @boolean-circuit/specification/vertex_type
      extend specification
        extend record
          override abstract identifier
          abstract function
    port_type refines @boolean-circuit/specification/vertex_type
      extend specification
        extend record
          override abstract identifier
          abstract direction
    wire_type refines @boolean-circuit/edge_type
      extend specification
        extend record
          override abstract identifier
          extend source
            override container = @boolean-circuit/vertices
          extend target
            override container = @boolean-circuit/vertices
  gates refines @collection
    extend specification
      extend collection
        override type = @boolean-circuit/specification/gate_type
  ports refines @collection
    extend specification
      extend collection
        override type = @boolean-circuit/specification/port_type
  wires refines @collection
    extend specification
      extend collection
        override type = @boolean-circuit/specification/wire_type
  extend vertices refines @boolean-circuit/gates then @boolean-circuit/ports
  extend edges refines @boolean-circuit/wires

layer bc-half-adder refines @boolean-circuit
  extend gates
    xorg refines @boolean-circuit/specification/gate_type
      identifier = 1
      function = "xor"
    andg refines @boolean-circuit/specification/gate_type
      identifier = 2
      function = "and"
  extend ports
    a refines @boolean-circuit/specification/port_type
      identifier = 1
      direction = "in"
    b refines @boolean-circuit/specification/port_type
      identifier = 2
      direction = "in"
    s refines @boolean-circuit/specification/port_type
      identifier = 3
      direction = "out"
    c refines @boolean-circuit/specification/port_type
      identifier = 4
      direction = "out"
  extend wires
    w1 refines @boolean-circuit/specification/wire_type
      identifier = 1
      source = @bc-half-adder/ports/a
      target = @bc-half-adder/gates/xorg
    w2 refines @boolean-circuit/specification/wire_type
      identifier = 2
      source = @bc-half-adder/ports/b
      target = @bc-half-adder/gates/xorg
    w3 refines @boolean-circuit/specification/wire_type
      identifier = 3
      source = @bc-half-adder/ports/a
      target = @bc-half-adder/gates/andg
    w4 refines @boolean-circuit/specification/wire_type
      identifier = 4
      source = @bc-half-adder/ports/b
      target = @bc-half-adder/gates/andg
    w5 refines @boolean-circuit/specification/wire_type
      identifier = 5
      source = @bc-half-adder/gates/xorg
      target = @bc-half-adder/ports/s
    w6 refines @boolean-circuit/specification/wire_type
      identifier = 6
      source = @bc-half-adder/gates/andg
      target = @bc-half-adder/ports/c
  tests
    expect gates/xorg/function = "xor"
    expect ports/a/direction = "in"
    expect wires/w1/source = @bc-half-adder/ports/a
    expect ports/s/direction = "out"`;

const mockUpstream: Server = createServer((request, response) => {
  let body = "";
  request.on("data", (chunk) => (body += chunk));
  request.on("end", () => {
    const parsed = JSON.parse(body) as { model?: string };
    modelCalls.push(parsed.model ?? "?");
    const isSurvey = parsed.model === "mistral-small-latest";
    const content = isSurvey
      ? surveyAnswer
      : penScript !== null
        ? (penScript[penCall++] ?? booleanCircuitFixture)
        : booleanCircuitFixture;
    response.writeHead(200, { "Content-Type": "application/json" });
    response.end(
      JSON.stringify({
        choices: [{ message: { content } }],
      }),
    );
  });
});
await new Promise<void>((resolve) => mockUpstream.listen(0, "127.0.0.1", resolve));
const mockPort = (mockUpstream.address() as AddressInfo).port;

// ---- boot the real server against the mock upstream ------------------

const sandbox = mkdtempSync(join(tmpdir(), "ld-sse-test-"));
process.env.LD_USERS_DIRECTORY = join(sandbox, "users");
process.env.LD_DATA_DIRECTORY = join(sandbox, "data");
process.env.MISTRAL_API_KEY = "test-key";
process.env.MISTRAL_MODEL = "mistral-large-4";
process.env.SURVEY_MODEL = "mistral-small-latest";
process.env.MISTRAL_URL = "http://127.0.0.1:" + mockPort + "/v1/chat/completions";
process.env.DATABASE_URL = "";

const { createQuarryServer } = await import("../server/routes.ts");
const { createAuthService, authConfigFromEnv } = await import("../server/auth/service.ts");
// AUTH_DISABLED=1: the SSE checks exercise the geologist, not the auth
// (the session/JWT/PAT paths live in tests/auth-flow-checks.mts).
const server: Server = createQuarryServer({
  authService: createAuthService({
    config: { ...authConfigFromEnv({ env: {} }), disabled: true },
  }),
});
await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
const base = "http://127.0.0.1:" + (server.address() as AddressInfo).port;
const auth = {};

/** POST /api/generate as SSE and collect the events until the stream
 * closes. */
async function collectGenerateEvents({
  prompt,
  answers,
}: {
  prompt: string;
  answers?: string[];
}): Promise<{ events: { event: string; data: Record<string, unknown> }[]; raw: string }> {
  const response = await fetch(base + "/api/generate", {
    method: "POST",
    headers: { ...auth, "Content-Type": "application/json", Accept: "text/event-stream" },
    body: JSON.stringify(answers ? { prompt, answers } : { prompt }),
  });
  const raw = await response.text();
  const events: { event: string; data: Record<string, unknown> }[] = [];
  let event = "";
  for (const block of raw.split("\n\n")) {
    let data = "";
    for (const line of block.split("\n")) {
      if (line.startsWith("event: ")) event = line.slice(7).trim();
      else if (line.startsWith("data: ")) data += line.slice(6);
    }
    if (event && data) events.push({ event, data: JSON.parse(data) as Record<string, unknown> });
  }
  return { events, raw };
}

try {
  // ---- (1) the happy path: selection → round → draft ----------------
  surveyAnswer = "@dag\n@kahn-scheme\n";
  modelCalls.length = 0;
  const happy = await collectGenerateEvents({ prompt: "a combinational boolean circuit" });
  check(
    "(1) the stream content-type is text/event-stream",
    happy.raw.length > 0 && happy.events.length > 0,
  );
  const happyOrder = happy.events.map((entry) => entry.event);
  check(
    "(1) selection arrives before round before draft",
    JSON.stringify(happyOrder) === JSON.stringify(["selection", "round", "draft"]),
  );
  const selection = happy.events[0]?.data as {
    selected?: string[];
    closure?: string[];
    fallback?: boolean;
  };
  check(
    "(1) the selection carries the survey's ground, its closure, no fallback",
    selection.selected?.join(",") === "dag,kahn-scheme" &&
      selection.closure?.includes("multidigraph") === true &&
      selection.fallback === false,
  );
  const draft = happy.events[2]?.data as { source?: string };
  check(
    "(1) the draft is the staged, accepted layer",
    typeof draft.source === "string" && draft.source.includes("layer bc-half-adder"),
  );
  check(
    "(1) the survey model was called once, the pen model once",
    modelCalls.filter((model) => model === "mistral-small-latest").length === 1 &&
      modelCalls.filter((model) => model === "mistral-large-4").length === 1,
  );

  // ---- (2) the survey asks questions: no call to the pen model -------
  surveyAnswer = "QUESTION: are the flows directed (arcs) or crossed (transitions)?\n";
  modelCalls.length = 0;
  const asked = await collectGenerateEvents({ prompt: "flows and shared resources" });
  check(
    "(2) a QUESTION: answer streams only a questions event",
    asked.events.length === 1 && asked.events[0]?.event === "questions",
  );
  check(
    "(2) the questions travel to the client",
    ((asked.events[0]?.data.questions as string[] | undefined) ?? []).some((question) =>
      question.includes("directed"),
    ),
  );
  check(
    "(2) the pen model is NOT called when the survey asks",
    modelCalls.filter((model) => model === "mistral-large-4").length === 0,
  );

  // ---- (3) answers come back in a new POST ---------------------------
  surveyAnswer = "@dag\n";
  modelCalls.length = 0;
  const answered = await collectGenerateEvents({
    prompt: "flows and shared resources",
    answers: ["directed arcs, discrete time"],
  });
  check(
    "(3) with answers the flow resumes: selection then round then draft",
    JSON.stringify(answered.events.map((entry) => entry.event)) ===
      JSON.stringify(["selection", "round", "draft"]),
  );

  // ---- (4) an unusable survey answer falls back to the monolith ------
  surveyAnswer = "I do not know what to choose\n";
  modelCalls.length = 0;
  const fallback = await collectGenerateEvents({ prompt: "something vague" });
  const fallbackSelection = fallback.events[0]?.data as { fallback?: boolean };
  check(
    "(4) an empty selection streams selection with fallback: true, then the loop runs",
    fallback.events[0]?.event === "selection" &&
      fallbackSelection.fallback === true &&
      JSON.stringify(fallback.events.map((entry) => entry.event)) ===
        JSON.stringify(["selection", "round", "draft"]),
  );

  // ---- (5) without the Accept header: plain text, as documented -------
  surveyAnswer = "@dag\n";
  const plain = await fetch(base + "/api/generate", {
    method: "POST",
    headers: { ...auth, "Content-Type": "application/json" },
    body: JSON.stringify({ prompt: "a combinational boolean circuit" }),
  });
  const plainBody = await plain.text();
  check(
    "(5) without Accept: text/event-stream the route answers plain text 200 with the draft",
    plain.status === 200 &&
      (plain.headers.get("content-type") ?? "").includes("text/plain") &&
      plainBody.includes("layer bc-half-adder"),
  );

  // ---- (6) a refusal streams refusal events before the next round -----
  // the pen answers a betrayed expectation first, then the fixture
  const betrayed = booleanCircuitFixture.replace(
    'expect gates/xorg/function = "xor"',
    'expect gates/xorg/function = "nand"',
  );
  penCall = 0;
  penScript = [betrayed, booleanCircuitFixture];
  modelCalls.length = 0;
  const refused = await collectGenerateEvents({ prompt: "a combinational boolean circuit" });
  const refusedOrder = refused.events.map((entry) => entry.event);
  check(
    "(6) a refused proposal streams round, refusal, round, draft in order",
    JSON.stringify(refusedOrder) === JSON.stringify(["selection", "round", "refusal", "round", "draft"]),
  );
  const refusalEvent = refused.events[2]?.data as { verdicts?: string[] };
  check(
    "(6) the refusal carries the verdict vocabulary",
    (refusalEvent.verdicts ?? []).includes("attendu-trahi"),
  );
} finally {
  server.close();
  mockUpstream.close();
  rmSync(sandbox, { recursive: true, force: true });
}

console.log(
  "generate sse checks: " + assertions + " assertions, " + failures.length + " failure(s)",
);
for (const failure of failures) console.log("FAIL " + failure);
if (failures.length > 0) process.exit(1);
