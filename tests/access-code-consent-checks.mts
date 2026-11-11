// The access-code consent checks (issue #87): the code persists in
// localStorage ONLY behind an explicit consent with an expiry — an
// expired consent forgets the code — and otherwise lives in
// sessionStorage, dying with the tab. wardrobeClient touches browser
// storage node cannot provide, so this harness pins the contract on
// the source, the same way the pages harness reads .tsx data.
//
//     node tests/access-code-consent-checks.mts   (exit 1 on any failure)

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
const clientSource = readFileSync(join(rootDirectory, "src/infrastructure/wardrobeClient.ts"), "utf8");
const formSource = readFileSync(join(rootDirectory, "src/presentation/accessForm.tsx"), "utf8");
const packageSource = readFileSync(join(rootDirectory, "package.json"), "utf8");

// ---- the storage contract -------------------------------------------

check("a consent key with an expiry exists", clientSource.includes("ACCESS_CODE_CONSENT_KEY"));
check("the consent duration is a named constant", /ACCESS_CODE_CONSENT_DAYS = 30/.test(clientSource));
check("readAccessCode checks the consent expiry", /Date\.parse\(consent\)/.test(clientSource));
check("an expired consent removes the stored code", /localStorage\.removeItem\(ACCESS_CODE_STORAGE_KEY\)/.test(clientSource));
check("without consent the code falls back to sessionStorage", clientSource.includes("sessionStorage.getItem(SESSION_ACCESS_CODE_KEY)"));
check("writeAccessCode takes an explicit remember flag", /writeAccessCode\(\{\s*accessCode,\s*remember,/.test(clientSource));
check("the localStorage write happens only in the remember branch", /if \(remember\) \{[\s\S]*localStorage\.setItem\(ACCESS_CODE_STORAGE_KEY/.test(clientSource));
check("hasValidAccessCodeConsent is exported for the checkbox", /export function hasValidAccessCodeConsent/.test(clientSource));

// ---- the form wiring -------------------------------------------------

check("the form has a remember checkbox", /type="checkbox"[\s\S]*checked=\{remember\}/.test(formSource));
check("the form passes remember to writeAccessCode", /writeAccessCode\(\{ accessCode, remember \}\)/.test(formSource));
check("the checkbox label states the 30-day expiry", /30 days/.test(formSource) && /tab only/.test(formSource));

// ---- the harness is registered ---------------------------------------

check("package.json runs this harness", packageSource.includes("test:access-code-consent"));

// ---- report ----------------------------------------------------------

console.log(
  `access-code consent checks: ${assertions - failures.length}/${assertions} passed, ${failures.length} failed`,
);
for (const failure of failures) {
  console.log("FAIL " + failure);
}
process.exit(failures.length > 0 ? 1 : 0);
