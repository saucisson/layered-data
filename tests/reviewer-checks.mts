// The reviewer checks: the reviewer agent must analyze the PR diff
// CONTENT, not only meta-rules — new dependencies (escalation list,
// ADR-0011), console in src/, default exports, explicit any, layer
// boundary crossings, possible secrets. These harnesses pin the check
// functions of scripts/commands/review.mjs on synthetic diffs.
//
//     node tests/reviewer-checks.mts   (exit 1 on any failure)

import { checkDiffContent, checkNewDependencies, parseAddedLines } from "../scripts/commands/review.mjs";

// ---- the assertion ledger ------------------------------------------

const failures: string[] = [];
let assertions = 0;

function check(label: string, condition: boolean): void {
  assertions++;
  if (!condition) failures.push(label);
}

function rulesOf(findings: readonly { rule: string }[]): string[] {
  return findings.map((finding) => finding.rule);
}

// ---- synthetic diffs -------------------------------------------------

const diffAddingDependency = `diff --git a/package.json b/package.json
index 1111111..2222222 100644
--- a/package.json
+++ b/package.json
@@ -10,6 +10,7 @@
   "dependencies": {
     "i18next": "^27.1.0",
+    "left-pad": "^1.3.0",
     "react": "18.3.1"
   }
diff --git a/package-lock.json b/package-lock.json
index 3333333..4444444 100644
--- a/package-lock.json
+++ b/package-lock.json
@@ -100,6 +100,9 @@
     "node_modules/i18next": {
       "version": "27.1.0"
     },
+    "node_modules/left-pad": {
+      "version": "1.3.0"
+    },
     "node_modules/react": {
`;

const diffRemovingDependency = `diff --git a/package.json b/package.json
index 1111111..2222222 100644
--- a/package.json
+++ b/package.json
@@ -10,6 +10,5 @@
   "dependencies": {
     "i18next": "^27.1.0",
-    "left-pad": "^1.3.0",
     "react": "18.3.1"
   }
`;

const diffWithViolations = `diff --git a/src/domain/space.ts b/src/domain/space.ts
index 1111111..2222222 100644
--- a/src/domain/space.ts
+++ b/src/domain/space.ts
@@ -40,6 +40,10 @@
 import { readFileSync } from "node:fs";
+import { assembleLayeredDataKernel } from "../application/corpus.ts";
+export default function debugSpace(): any {
+  console.log("space", arguments);
+  const apiKey = "xxxxxxxx";
+  return null as any;
 }
`;

const diffClean = `diff --git a/src/domain/space.ts b/src/domain/space.ts
index 1111111..2222222 100644
--- a/src/domain/space.ts
+++ b/src/domain/space.ts
@@ -40,6 +40,7 @@
 import { readFileSync } from "node:fs";
+// the space is the single source of truth — no embedded copies
 export function readSpace(): void {}
`;

// ---- parseAddedLines: files and line numbers -------------------------

const added = parseAddedLines(diffWithViolations);
check("parseAddedLines finds the file", added.length > 0 && added[0]?.file === "src/domain/space.ts");
check(
  "parseAddedLines tracks new-file line numbers",
  added.some((line) => line.line === 41 && line.text.includes("../application/corpus.ts")),
);

// ---- checkNewDependencies --------------------------------------------

const addedDepFindings = checkNewDependencies(diffAddingDependency);
check(
  "a PR diff adding a dependency yields a new-dependency finding",
  rulesOf(addedDepFindings).includes("new-dependency"),
);
check(
  "the new-dependency finding is BLOCKING (escalation list, ADR-0011)",
  addedDepFindings.some((finding) => finding.rule === "new-dependency" && finding.severity === "BLOCKING"),
);
check(
  "the finding names the added dependency",
  addedDepFindings.some((finding) => finding.evidence.includes("left-pad")),
);

const removedDepFindings = checkNewDependencies(diffRemovingDependency);
check(
  "a removed dependency yields a removed-dependency suggestion",
  removedDepFindings.some((finding) => finding.rule === "removed-dependency" && finding.severity === "SUGGESTION"),
);

check("a diff without package changes yields no dependency finding", checkNewDependencies(diffClean).length === 0);

// ---- checkDiffContent --------------------------------------------------

const contentFindings = checkDiffContent(diffWithViolations);
check(
  "console in src/ is BLOCKING",
  contentFindings.some((f) => f.rule === "console-in-src" && f.severity === "BLOCKING"),
);
check(
  "default export in src/ is BLOCKING",
  contentFindings.some((f) => f.rule === "default-export" && f.severity === "BLOCKING"),
);
check(
  "explicit any in src/ is TO-FIX",
  contentFindings.some((f) => f.rule === "explicit-any" && f.severity === "TO-FIX"),
);
check(
  "import crossing a layer boundary is BLOCKING",
  contentFindings.some((f) => f.rule === "layer-boundary-violation" && f.severity === "BLOCKING"),
);
check(
  "a possible secret is BLOCKING",
  contentFindings.some((f) => f.rule === "possible-secret" && f.severity === "BLOCKING"),
);

check("a clean diff yields no content finding", checkDiffContent(diffClean).length === 0);

// ---- report ------------------------------------------------------------

console.log(`reviewer checks: ${assertions} assertions, ${failures.length} failure(s)`);
if (failures.length > 0) {
  for (const failure of failures) console.log("  FAIL: " + failure);
  process.exit(1);
}
