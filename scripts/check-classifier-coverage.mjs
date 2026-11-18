// Dedicated strict coverage gate for the version classifier
// (src/domain/versionClassifier.ts, issue #162): the classifier is
// safety-critical (ADR-0116 rule 1), so it carries its own line
// target on top of the global c8 gate. Reads the lcov report written
// by `npm run test:coverage` and fails when the classifier's line
// coverage drops below CLASSIFIER_MIN_LINES.

import { readFileSync } from "node:fs";

const CLASSIFIER_FILE = "src/domain/versionClassifier.ts";
const CLASSIFIER_MIN_LINES = 100;

const lcov = readFileSync("coverage/lcov.info", "utf8");
const blocks = lcov.split("end_of_record").map((block) => block.trim());
const entry = blocks.find((block) => block.includes("SF:" + CLASSIFIER_FILE));
if (!entry) {
  console.error("no lcov entry for " + CLASSIFIER_FILE + " — run npm run test:coverage first");
  process.exit(1);
}
const linesFound = Number(entry.match(/^LF:(\d+)$/m)?.[1] ?? 0);
const linesHit = Number(entry.match(/^LH:(\d+)$/m)?.[1] ?? 0);
const percent = linesFound === 0 ? 0 : (100 * linesHit) / linesFound;
console.log(
  "classifier coverage: " + linesHit + "/" + linesFound + " lines = " + percent.toFixed(2) + "% (gate >= " + CLASSIFIER_MIN_LINES + "%)",
);
if (percent < CLASSIFIER_MIN_LINES) {
  console.error("FAIL: versionClassifier.ts line coverage below the dedicated gate");
  process.exit(1);
}
