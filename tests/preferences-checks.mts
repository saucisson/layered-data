// The preferences checks (LD-8, milestone Web v1, ADR-0120 §3): the
// personal Mistral token contract, pinned on the source — stored
// browser-side only, sent solely as the x-mistral-api-token header on
// the generation call, never in a URL, never logged, never echoed in
// a response; the server gives the header token precedence over the
// dev-only env key, keeps a refused token a 401 (never a 502), and
// answers 401 clearly when no token is present; the env key is ignored
// in production; the deployment files no longer carry it.
//
//     node tests/preferences-checks.mts   (exit 1 on any failure)

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

// ---- the assertion ledger ------------------------------------------

const failures: string[] = [];
let assertions = 0;

function check(label: string, condition: boolean): void {
  assertions++;
  if (!condition) failures.push(label);
}

// ---- the sources ----------------------------------------------------

const rootDirectory = join(import.meta.dirname, "..");
const readSource = (relativePath: string) => readFileSync(join(rootDirectory, relativePath), "utf8");

const tokenSource = readSource("src/infrastructure/mistralToken.ts");
const clientSource = readSource("src/infrastructure/wardrobeClient.ts");
const preferencesSource = readSource("src/pages/PreferencesPage.tsx");
const routerSource = readSource("src/components/Router.tsx");
const appSource = readSource("src/App.tsx");
const composerSource = readSource("src/presentation/addFormalism.tsx");
const serverRoutesSource = readSource("server/routes.ts");
const mistralClientSource = readSource("server/mistralClient.ts");
const configSource = readSource("server/config.ts");
const composeSource = readSource("docker-compose.yml");
const envExampleSource = readSource(".env.example");

// =====================================================================
// (a) the token lives browser-side only: localStorage, its own key,
//     no URL, no log, no cookie
// =====================================================================

check(
  '(a) the token module stores it in localStorage under "ld-mistral-api-token"',
  tokenSource.includes('MISTRAL_TOKEN_STORAGE_KEY = "ld-mistral-api-token"') &&
    tokenSource.includes("localStorage.getItem") &&
    tokenSource.includes("localStorage.setItem"),
);
check(
  "(a) the token module never logs and never touches a URL or a cookie",
  !tokenSource.includes("console.") &&
    !tokenSource.includes("document.cookie") &&
    !/fetch\(|XMLHttpRequest|location\./.test(tokenSource),
);

// =====================================================================
// (b) the header is set ONLY on the generation call — never on the
//     generic apiFetch, never in a URL, never logged
// =====================================================================

function functionBlockOf(source: string, functionName: string): string {
  const start = source.indexOf("export async function " + functionName);
  if (start === -1) return "";
  // crude but sufficient: up to the next top-level export
  const rest = source.slice(start + 1);
  const nextExport = rest.indexOf("\nexport ");
  return nextExport === -1 ? rest : rest.slice(0, nextExport);
}

const streamGenerateBlock = functionBlockOf(clientSource, "streamGenerate");
const apiFetchBlock = functionBlockOf(clientSource, "apiFetch");

check(
  "(b) streamGenerate posts to api/generate and adds the x-mistral-api-token header",
  streamGenerateBlock.includes('"api/generate"') &&
    streamGenerateBlock.includes('headers["x-mistral-api-token"]'),
);
check(
  "(b) the generic apiFetch never carries the token header",
  !apiFetchBlock.includes("x-mistral-api-token"),
);
check(
  "(b) the token header is SET nowhere else in src/ (only the generation call sets it)",
  readdirSync(join(rootDirectory, "src"), { recursive: true })
    .filter((entry) => String(entry).endsWith(".ts") || String(entry).endsWith(".tsx"))
    .map((entry) => join("src", String(entry)))
    .filter((path) => readSource(path).includes('headers["x-mistral-api-token"]'))
    .join(",") === "src/infrastructure/wardrobeClient.ts",
);
check(
  "(b) no source puts the token in a URL (no query-string token anywhere)",
  readdirSync(join(rootDirectory, "src"), { recursive: true })
    .filter((entry) => String(entry).endsWith(".ts") || String(entry).endsWith(".tsx"))
    .every((entry) => !/token=|[?&]api[-_]token/i.test(readSource(join("src", String(entry))))),
);
check(
  "(b) the client sources never log the token",
  !/console\.(log|info|warn|error)[\s\S]{0,120}mistralToken/.test(clientSource) &&
    !/console\.(log|info|warn|error)[\s\S]{0,120}MISTRAL_TOKEN_STORAGE_KEY/.test(tokenSource),
);

// =====================================================================
// (c) the page and the router: #preferences exists, the plume is
//     disabled without a token and says so, a 401 means an invalid token
// =====================================================================

check(
  '(c) the router declares the "preferences" page',
  routerSource.includes('"preferences"'),
);
check(
  "(c) App.tsx renders the PreferencesPage on that route",
  appSource.includes("PreferencesPage") && appSource.includes('case "preferences"'),
);
check(
  "(c) the preferences page edits the token in a password field, with save and clear",
  preferencesSource.includes('type="password"') &&
    preferencesSource.includes("writeMistralToken") &&
    preferencesSource.includes("clearMistralToken"),
);
check(
  "(c) the preferences page is bilingual FR/EN",
  /fr: "[^"]+"/.test(preferencesSource),
);
check(
  "(c) the plume reads the token and disables the AI button without it, with an explicit message",
  composerSource.includes("readMistralToken()") &&
    composerSource.includes("disabled={busy || mistralToken === null}") &&
    composerSource.includes("no Mistral API token"),
);
check(
  "(c) the plume maps a 401 to an invalid-token message",
  composerSource.includes("error.statusCode === 401") &&
    composerSource.includes("invalid Mistral API token (401)"),
);
check(
  "(c) the LIVE SSE path maps a 401 error event to the invalid-token message too (not only the non-stream catch)",
  /case "error":[\s\S]*?event\.statusCode === 401[\s\S]*?invalid Mistral API token \(401\)/.test(
    composerSource,
  ),
);
check(
  "(c) a session_required 401 is never blamed on the Mistral token",
  composerSource.includes('error.body.includes("session_required")') &&
    composerSource.includes("session required — sign in again"),
);
check(
  "(c) the invalid-token message is bilingual FR/EN (on both the SSE and the non-stream path)",
  (composerSource.match(/invalid Mistral API token \(401\)[\s\S]{0,120}?fr: "token API Mistral invalide/g) ?? [])
    .length === 2,
);

// =====================================================================
// (d) the server: the header token wins, a refused token stays a 401,
//     no token at all is a clear 401 — and the token is never logged
// =====================================================================

check(
  "(d) the route reads the x-mistral-api-token header exactly once, on /api/generate",
  (serverRoutesSource.match(/x-mistral-api-token/g) ?? []).length === 1 &&
    serverRoutesSource.indexOf("x-mistral-api-token") >
      serverRoutesSource.indexOf('"/api/generate"'),
);
check(
  "(d) the route passes the token to selectLayers and to both generateLayer calls",
  (serverRoutesSource.match(/apiToken,/g) ?? []).length === 3,
);
check(
  "(d) the header token takes precedence over the env key",
  mistralClientSource.includes("const bearerToken = apiToken ?? MISTRAL_API_KEY;"),
);
check(
  "(d) no token at all answers a clear 401 (never a 500/502)",
  /if \(!bearerToken\) \{\s*throw new PenInfraFailure\(\{\s*statusCode: 401/.test(mistralClientSource),
);
check(
  "(d) an upstream 401 stays a 401 with a fixed body (no echo that could leak the token)",
  /upstreamResponse\.status === 401[\s\S]*?statusCode: 401/.test(mistralClientSource) &&
    mistralClientSource.includes("token Mistral refusé par l’amont (401)"),
);
check(
  "(d) the token is never logged server-side",
  !/console\.(log|info|warn|error)\([^)]*(apiToken|bearerToken|mistralToken)/i.test(
    serverRoutesSource + mistralClientSource,
  ),
);

// =====================================================================
// (e) the production guard: the env key is ignored with
//     NODE_ENV=production, like AUTH_DISABLED is forbidden there
// =====================================================================

check(
  "(e) config.ts ignores MISTRAL_API_KEY when NODE_ENV=production",
  configSource.includes('process.env.NODE_ENV === "production" ? "" : (process.env.MISTRAL_API_KEY ?? "")'),
);

// =====================================================================
// (f) the deployment no longer carries a server-side key
// =====================================================================

check(
  "(f) docker-compose.yml no longer passes MISTRAL_API_KEY",
  !composeSource.includes("MISTRAL_API_KEY="),
);
check(
  "(f) .env.example keeps MISTRAL_API_KEY commented out, marked dev-only",
  envExampleSource.includes("#MISTRAL_API_KEY=") &&
    !envExampleSource.split("\n").some((line) => line.startsWith("MISTRAL_API_KEY=")),
);

// ---- the report ----------------------------------------------------

console.log("preferences checks: " + assertions + " assertions, " + failures.length + " failure(s)");
if (failures.length > 0) {
  for (const failure of failures) console.log("  ÉCHEC: " + failure);
  process.exit(1);
}
