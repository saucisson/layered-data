// The english-only front checks: the mechanical front of ADR-0008 N4
// (G4) keeps the dev artifact layer English. The harness pins the
// Markdown stripping, the source splitting (comments, strings,
// identifiers, with file lines), the three signals (accents,
// stop-words, stems), the commit-subject shape of the hook, and the
// whole-scope verdict on a synthetic tree - without scanning this
// harness itself (tests are product data, out of scope).
//
//     node tests/english-checks.mts   (exit 1 on any failure)

import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  frenchStemInIdentifier,
  listScope,
  renderOffender,
  run,
  scanFile,
  scanRepository,
  scanSegment,
  scanSubject,
  splitSource,
  stripMarkdown,
} from "../scripts/commands/english.mjs";

// Accented characters are built from code points: this test file
// itself stays accent-free, like the front it verifies.
const E_ACUTE = String.fromCharCode(0xe9);
const E_GRAVE = String.fromCharCode(0xe8);

// ---- the assertion ledger ------------------------------------------

const failures: string[] = [];
let assertions = 0;

function check(label: string, condition: boolean): void {
  assertions++;
  if (!condition) failures.push(label);
}

// ---- Markdown: code fences and inline spans are skipped -------------

const stripped = stripMarkdown({ text: "# Title\n\n```text\nle defaut\n```\n\nUse `serialiser` here.\n" });
check("markdown: fenced blocks are skipped", !stripped.includes("defaut"));
check("markdown: inline spans are skipped", !stripped.includes("serialiser"));
check("markdown: the prose stays", stripped.includes("Use") && stripped.includes("here."));

// ---- sources: comments, strings, identifiers, with file lines ------

const corpora = splitSource({
  text: 'const a = "line one";\n// le defaut\nconst b = `chaine ${a.length}`;\nreturn "l\'accent est " + "l" + E_ACUTE;\n',
});
check("sources: strings carry their opening line", corpora.strings.some((s) => s.line === 1));
check(
  "sources: string contents land in the string corpus with the quote",
  corpora.strings.some((s) => s.text.includes("line one")),
);
check("sources: comments carry their opening line", corpora.comments.some((c) => c.line === 2 && c.text.includes("le defaut")));
check(
  "sources: template substitution text lands in the string corpus",
  corpora.strings.some((s) => s.text.includes("chaine")),
);
check(
  "sources: an apostrophe inside a double-quoted string does not split it",
  corpora.strings.some((s) => s.text.includes("l'accent est")),
);
check("sources: identifiers land with their line", corpora.identifiers.some((i) => i.name === "const" && i.line === 3));

// ---- the three signals ----------------------------------------------

const accented = scanSegment({ text: "clean text caf" + E_ACUTE, startLine: 1, withStopWords: false });
check("signal: an accented character is a finding", accented !== null && accented.evidence.startsWith("accented character"));

const middleLine = scanSegment({ text: "clean text\nclean text caf" + E_ACUTE, startLine: 1, withStopWords: false });
check("signal: the finding line counts within the segment", middleLine !== null && middleLine.line === 2);

const stopWord = scanSegment({ text: "the default value le mode", startLine: 1, withStopWords: true });
check("signal: a French stop-word is a whole-word finding", stopWord !== null && stopWord.evidence === "French stop-word: le");
check("signal: a stop-word inside a word is not a finding", scanSegment({ text: "the template value", startLine: 1, withStopWords: true }) === null);

check("signal: a snake French identifier is flagged", frenchStemInIdentifier({ identifier: "defaut_value" }));
check("signal: a camel French identifier is flagged", frenchStemInIdentifier({ identifier: "SerialiseMode" }));
check("signal: an English identifier passes", !frenchStemInIdentifier({ identifier: "upgrade" }));

// ---- file-level scan on synthetic sources ---------------------------

check(
  "file: a comment stop-word in a source is a finding",
  scanFile({ relative: "x.mjs", text: "value = 1; // le flux\n" }) !== null,
);
check(
  "file: an accent inside a string is a finding",
  scanFile({ relative: "x.mjs", text: 'value = "le probl' + E_GRAVE + 'me";\n' }) !== null,
);
check(
  "file: accent-free French inside a string is not a finding (strings carry data)",
  scanFile({ relative: "x.mjs", text: 'value = "le defaut";\n' }) === null,
);
check(
  "file: a French identifier in code is a finding",
  scanFile({ relative: "x.mjs", text: "const donnees = 1;\n" }) !== null,
);
check("file: a clean English source passes", scanFile({ relative: "x.mjs", text: "const value = upgrade(1);\n" }) === null);
check(
  "file: Markdown prose is scanned for accents",
  scanFile({ relative: "x.md", text: "Bienvenue caf" + E_ACUTE + "\n" }) !== null,
);
check("file: clean Markdown passes", scanFile({ relative: "x.md", text: "Welcome to the workshop.\n" }) === null);

// ---- rendering -------------------------------------------------------

check(
  "render: a located offender renders as path:line: evidence",
  renderOffender({ offender: { file: "a/b.md", line: 3, evidence: "French stop-word: le" } }) ===
    "a/b.md:3: French stop-word: le",
);

// ---- the commit-subject shape ----------------------------------------

check(
  "subject: an accented French subject is a finding",
  scanSubject({ subject: "fix: corrige le probl" + E_GRAVE + "me" }) !== null,
);
check("subject: an accent-free French subject is caught by the stop-word", scanSubject({ subject: "fix: corrige le defaut" }) !== null);
check("subject: an English subject passes", scanSubject({ subject: "fix: probe refuses a dirty tree" }) === null);

// ---- the whole-scope verdict on a synthetic tree --------------------

const tree = mkdtempSync(join(tmpdir(), "english-checks-"));
try {
  writeFileSync(join(tree, "README.md"), "Welcome to the workshop.\n");
  mkdirSync(join(tree, "docs", "decisions"), { recursive: true });
  mkdirSync(join(tree, "scripts", "commands"), { recursive: true });
  writeFileSync(join(tree, "docs", "decisions", "adr-0100-order-as-semantics.md"), "L'" + E_ACUTE + "tat de l'art.\n");
  mkdirSync(join(tree, "docs", "deep"), { recursive: true });
  writeFileSync(join(tree, "docs", "deep", "french.md"), "caf" + E_ACUTE + "\n");
  writeFileSync(
    join(tree, "scripts", "commands", "driver.mjs"),
    'console.log("le r' + E_ACUTE + 'sultat de la chaine");\n',
  );
  writeFileSync(join(tree, "package.json"), '{"workflows": "data, never scanned"}\n');

  const scope = listScope({ root: tree });
  check("scope: root Markdown is listed", scope.includes("README.md"));
  check("scope: docs are walked recursively", scope.includes("docs/deep/french.md"));
  check("scope: the allowed ADR file is listed before filtering", scope.includes("docs/decisions/adr-0100-order-as-semantics.md"));
  check("scope: script sources are listed", scope.includes("scripts/commands/driver.mjs"));
  check("scope: package.json never scans", !scope.includes("package.json"));

  const scan = scanRepository({ root: tree });
  const files = scan.offenders.map((offender) => offender.file);
  check("scope: the allowed exact debt file is not reported", !files.includes("docs/decisions/adr-0100-order-as-semantics.md"));
  check("scope: the recursive doc offender is reported with its line", files.includes("docs/deep/french.md"));
  check("scope: the driver string accent is reported", files.includes("scripts/commands/driver.mjs"));
  check("scope: the clean root Markdown is not reported", !files.includes("README.md"));
  check(
    "scope: the whole-scope run exits 1 with offenders",
    run({ args: [], root: tree }) === 1,
  );

  const cleanTree = mkdtempSync(join(tmpdir(), "english-checks-clean-"));
  try {
    writeFileSync(join(cleanTree, "README.md"), "Welcome.\n");
    check("scope: a clean tree exits 0", run({ args: [], root: cleanTree }) === 0);
  } finally {
    rmSync(cleanTree, { recursive: true, force: true });
  }
} finally {
  rmSync(tree, { recursive: true, force: true });
}

// ---- the hook shape --------------------------------------------------

const subjectFile = join(tmpdir(), "english-checks-subject");
try {
  writeFileSync(subjectFile, "docs: ajoute le front\n\nbody line\n");
  check("hook: a French subject exits 1", run({ args: ["--subject-file", subjectFile] }) === 1);
  writeFileSync(subjectFile, "docs: add the front\n");
  check("hook: an English subject exits 0", run({ args: ["--subject-file", subjectFile] }) === 0);
  check("hook: an unreadable subject file exits 2", run({ args: ["--subject-file", subjectFile + "-missing"] }) === 2);
} finally {
  rmSync(subjectFile, { force: true });
}

// ---- report ----------------------------------------------------------

console.log(`english checks: ${assertions} assertions, ${failures.length} failure(s)`);
if (failures.length > 0) {
  for (const failure of failures) console.log("  FAIL: " + failure);
  process.exit(1);
}
