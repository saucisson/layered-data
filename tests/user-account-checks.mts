// The user account UI checks (issue #141, ADR-0114): the optional
// personal account form — creation, login, logout, local-first
// fallback — and its storage contract. Like the access-code consent
// harness, this pins the contract on the source: the browser storage
// node cannot provide is not available here.
//
//     node tests/user-account-checks.mts   (exit 1 on any failure)

import { readFileSync } from "node:fs";
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
const formSource = readFileSync(
  join(rootDirectory, "src/presentation/userAccountForm.tsx"),
  "utf8",
);
const containerSource = readFileSync(
  join(rootDirectory, "src/WorkshopContainer.tsx"),
  "utf8",
);
const packageSource = readFileSync(join(rootDirectory, "package.json"), "utf8");

// ---- the component contract -----------------------------------------

check(
  "the form calls POST api/users for account creation",
  formSource.includes('endpoint: "api/users"') && formSource.includes('method: "POST"'),
);
check(
  "the form calls api/whoami for login verification",
  formSource.includes('endpoint: "api/whoami"'),
);
check(
  "the form stores the connected user in localStorage",
  formSource.includes("atelier-user-profile"),
);
check(
  "the form reads the connected user from localStorage",
  formSource.includes("readConnectedUser"),
);
check(
  "the form writes the access code on login (x-access-code header)",
  formSource.includes("writeAccessCode"),
);
check(
  "the form has a logout path that clears the profile",
  formSource.includes("writeConnectedUser({ user: null })"),
);
check(
  "the form handles 409 (code taken) on creation",
  formSource.includes("response.status === 409"),
);
check(
  "the form handles 400 (invalid body) on creation",
  formSource.includes("response.status === 400"),
);
check(
  "the form falls back to local-first when no server is reachable",
  formSource.includes("no server reachable"),
);
check(
  "the form distinguishes personal-code from shared-code on login",
  formSource.includes('body.identity === "personal-code"'),
);
check(
  "the form uses say() for every user-facing string (i18n inline)",
  (formSource.match(/say\(\{ language/g) ?? []).length >= 10,
);
check(
  "the form has no console.* call",
  !/console\.(log|warn|error)/.test(formSource),
);
check(
  "the form is a named export (no default export)",
  formSource.includes("export function UserAccountForm") && !formSource.includes("export default"),
);

// ---- the integration in the workshop container ----------------------

check(
  "WorkshopContainer imports UserAccountForm",
  containerSource.includes('import { UserAccountForm } from "./presentation/userAccountForm.tsx"'),
);
check(
  "WorkshopContainer renders UserAccountForm next to AccessCodeForm",
  containerSource.includes("<UserAccountForm language={language} />"),
);

// ---- the package wiring ---------------------------------------------

check(
  "the test harness is registered in package.json",
  packageSource.includes("user-account-checks"),
);

console.log("user account checks: " + assertions + " assertions, " + failures.length + " failure(s)");
for (const failure of failures) console.log("FAIL " + failure);
process.exit(failures.length === 0 ? 0 : 1);
