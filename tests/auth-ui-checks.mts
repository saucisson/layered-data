// The auth UI checks (LD-4, milestone Auth v1): the sign-in panel
// replaces the old access-code form — it reads /auth/me (the httpOnly
// session cookie travels automatically), offers one button to
// /auth/login, shows the connected user and a logout link to
// /auth/logout. No access code, no token ever lives in the browser.
// Like the former consent harness, this pins the contract on the
// source: the browser storage node cannot provide is not available
// here.
//
//     node tests/auth-ui-checks.mts   (exit 1 on any failure)

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
const panelSource = readFileSync(join(rootDirectory, "src/presentation/authPanel.tsx"), "utf8");
const headerSource = readFileSync(join(rootDirectory, "src/components/SiteHeader.tsx"), "utf8");
const clientSource = readFileSync(join(rootDirectory, "src/infrastructure/wardrobeClient.ts"), "utf8");
const eventsSource = readFileSync(join(rootDirectory, "src/infrastructure/authEvents.ts"), "utf8");
const packageSource = readFileSync(join(rootDirectory, "package.json"), "utf8");

// ---- the panel contract ----------------------------------------------

check("the panel probes /auth/me on mount", panelSource.includes('endpoint: "auth/me"'));
check("a 401 means anonymous (sign-in offered)", panelSource.includes("response.status === 401"));
check("the sign-in button starts the OIDC round trip at /auth/login", panelSource.includes('"/auth/login?returnTo="'));
check("the returnTo is the current page", panelSource.includes("window.location.pathname"));
check("logout goes to /auth/logout", panelSource.includes('"/auth/logout"'));
check("the connected user is displayed", panelSource.includes("me.utilisateur"));
check("a session change is announced site-wide", panelSource.includes("notifyAuthChanged()"));
check("the panel stores nothing in localStorage", !panelSource.includes("localStorage"));
check("the panel sends no hand-built access header", !panelSource.includes("x-access-code"));

// ---- the header wiring ------------------------------------------------

check("the site header renders the auth panel", headerSource.includes("<AuthPanel"));
check("the header probes /auth/me for the lock state", headerSource.includes('endpoint: "auth/me"'));
check("the header no longer references the old access form", !headerSource.includes("AccessCodeForm"));
check("the header no longer references the old account form", !headerSource.includes("UserAccountForm"));

// ---- the client contract ----------------------------------------------

check("wardrobeClient no longer stores an access code", !clientSource.includes("ACCESS_CODE_STORAGE_KEY"));
check("wardrobeClient sends no x-access-code header", !clientSource.includes("x-access-code"));
check("apiFetch is still the single API entry point", /export async function apiFetch/.test(clientSource));

// ---- no trace of the old access-code UI anywhere in src/ --------------

const srcFiles: string[] = [];
function walk(directory: string): void {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) walk(path);
    else if (/\.(ts|tsx)$/.test(entry.name)) srcFiles.push(path);
  }
}
walk(join(rootDirectory, "src"));
const staleReferences = srcFiles.filter((path) => {
  const source = readFileSync(path, "utf8");
  return (
    source.includes("accessForm") ||
    source.includes("userAccountForm") ||
    source.includes("accessCodeEvents") ||
    source.includes("readAccessCode") ||
    source.includes("writeAccessCode") ||
    source.includes("code-acces-atelier")
  );
});
check(
  "no source file references the old access-code UI (" +
    staleReferences.map((p) => p.replace(rootDirectory + "/", "")).join(", ") +
    ")",
  staleReferences.length === 0,
);

// ---- the events module -------------------------------------------------

check(
  "authEvents exposes notifyAuthChanged / onAuthChanged",
  eventsSource.includes("notifyAuthChanged") && eventsSource.includes("onAuthChanged"),
);

// ---- the harness is registered -----------------------------------------

check("package.json runs this harness", packageSource.includes("test:auth-ui"));
check("the old consent harness is gone", !packageSource.includes("test:access-code-consent"));
check("the old account harness is gone", !packageSource.includes("test:user-account"));

// ---- the report --------------------------------------------------------

console.log("auth-ui-checks: " + assertions + " assertions, " + failures.length + " failure(s)");
if (failures.length > 0) {
  for (const failure of failures) console.log("  ÉCHEC: " + failure);
  process.exit(1);
}
