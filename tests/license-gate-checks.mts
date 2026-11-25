// The license gate checks: the N2 front of ADR-0008 fails closed on the
// licenses of the installed graph. The harness pins the SPDX
// expression evaluation (OR, AND, parentheses, WITH, case), the
// metadata precedence and the fail-closed verdict on synthetic
// package trees - nested copies and scoped packages included.
//
//     node tests/license-gate-checks.mts   (exit 1 on any failure)

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  expressionIsAllowed,
  licenseViolation,
  run,
  scanInstalledGraph,
  splitOutsideParentheses,
} from "../scripts/commands/license-gate.mjs";

// ---- the assertion ledger ------------------------------------------

const failures: string[] = [];
let assertions = 0;

function check(label: string, condition: boolean): void {
  assertions++;
  if (!condition) failures.push(label);
}

// ---- SPDX expressions ------------------------------------------------

check("expression: OR passes when one operand is allowed", expressionIsAllowed({ expression: "MIT OR Apache-2.0" }));
check("expression: OR fails when no operand is allowed", !expressionIsAllowed({ expression: "GPL-3.0-only OR AGPL-3.0-only" }));
check("expression: AND fails when one operand is off-list", !expressionIsAllowed({ expression: "MIT AND GPL-3.0-only" }));
check("expression: AND passes when every operand is allowed", expressionIsAllowed({ expression: "MIT AND Apache-2.0" }));
check("expression: parentheses bind before OR and AND apply", expressionIsAllowed({ expression: "GPL-3.0-only OR (MIT AND Apache-2.0)" }));
check("expression: parentheses bind on the failing side too", !expressionIsAllowed({ expression: "(MIT OR Apache-2.0) AND GPL-3.0-only" }));
check("expression: a WITH exception binds to the operand before it", expressionIsAllowed({ expression: "Apache-2.0 WITH LLVM-exception" }));
check("expression: identifiers compare casefolded", expressionIsAllowed({ expression: "mit" }));
check("expression: an off-list exception never passes", !expressionIsAllowed({ expression: "GPL-3.0-only WITH Classpath-exception-2.0" }));

const split = splitOutsideParentheses({ text: "(MIT OR Apache-2.0) AND GPL-3.0-only", separator: " AND " });
check(
  "split: the separator splits outside parentheses only",
  split !== null && split.length === 2 && split[0] === "(MIT OR Apache-2.0)",
);
check("split: no depth-zero separator yields null", splitOutsideParentheses({ text: "(A OR B)", separator: " AND " }) === null);

// ---- metadata precedence and the fail-closed verdict -----------------

check(
  "metadata: a present expression decides first",
  licenseViolation({ license: "GPL-3.0-only", licenses: [{ type: "MIT License" }] }) === "GPL-3.0-only",
);
check(
  "metadata: an allowed expression passes with unreadable classifiers",
  licenseViolation({ license: "MIT", licenses: [{ type: "GPL License" }] }) === null,
);
check(
  "metadata: classifier names pass when one is allowed",
  licenseViolation({ license: undefined, licenses: [{ type: "MIT License" }, { type: "GPL License" }] }) === null,
);
check(
  "metadata: the legacy free-form field passes on a known name",
  licenseViolation({ license: "MIT License" }) === null,
);
check(
  "metadata: a custom EULA text in the legacy field is the evidence",
  licenseViolation({ license: "Some custom EULA text" }) === "Some custom EULA text",
);
check(
  "metadata: no expression, no classifier, no field fails closed",
  licenseViolation({ license: "", licenses: [] }) === "no license metadata at all",
);
check(
  "metadata: a non-string license field is the evidence",
  typeof licenseViolation({ license: { Commercial: "ask the vendor" } }) === "string",
);

// ---- the installed graph ----------------------------------------------

function writePackage(directory: string, manifest: Record<string, unknown>): void {
  mkdirSync(directory, { recursive: true });
  writeFileSync(join(directory, "package.json"), JSON.stringify(manifest));
}

const graph = mkdtempSync(join(tmpdir(), "license-gate-checks-"));
try {
  writePackage(join(graph, "node_modules", "pkg-mit"), { name: "pkg-mit", version: "1.0.0", license: "MIT" });
  writePackage(join(graph, "node_modules", "@scope", "pkg-isc"), { name: "@scope/pkg-isc", version: "2.0.0", license: "ISC" });
  writePackage(join(graph, "node_modules", "pkg-offender"), { name: "pkg-offender", version: "1.0.0", license: "GPL-3.0-only" });
  writePackage(join(graph, "node_modules", "pkg-mit", "node_modules", "pkg-silent"), { name: "pkg-silent", version: "0.1.0" });
  writePackage(join(graph, "node_modules", ".bin"), { name: "never-listed", version: "0.0.0" });

  const offenders = scanInstalledGraph({ nodeModulesPath: join(graph, "node_modules") });
  check("graph: the off-list package is an offender", offenders.some((line) => line.startsWith("pkg-offender@1.0.0: GPL-3.0-only")));
  check("graph: the package without metadata fails closed", offenders.some((line) => line.includes("pkg-silent@0.1.0: no license metadata at all")));
  check("graph: the allowed packages stay silent", offenders.every((line) => !line.includes("pkg-mit@") && !line.includes("pkg-isc@")));
  check("graph: the .bin directory never lists a package", offenders.every((line) => !line.includes("never-listed")));

  check("graph: the run on the offending tree exits 1", run({ root: graph }) === 1);

  const cleanGraph = mkdtempSync(join(tmpdir(), "license-gate-clean-"));
  try {
    writePackage(join(cleanGraph, "node_modules", "pkg-mit"), { name: "pkg-mit", version: "1.0.0", license: "MIT OR Apache-2.0" });
    check("graph: the run on a clean tree exits 0", run({ root: cleanGraph }) === 0);
  } finally {
    rmSync(cleanGraph, { recursive: true, force: true });
  }

  const empty = mkdtempSync(join(tmpdir(), "license-gate-empty-"));
  try {
    check("graph: no node_modules at all exits 2", run({ root: empty }) === 2);
  } finally {
    rmSync(empty, { recursive: true, force: true });
  }
} finally {
  rmSync(graph, { recursive: true, force: true });
}

// ---- report ------------------------------------------------------------

console.log(`license gate checks: ${assertions} assertions, ${failures.length} failure(s)`);
if (failures.length > 0) {
  for (const failure of failures) console.log("  FAIL: " + failure);
  process.exit(1);
}
