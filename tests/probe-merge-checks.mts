// The probe-merge checks: the N5 local dry run of ADR-0008 (per-commit
// greenness, H5) replays the branch onto a base in a throwaway
// worktree and probes every replayed commit on the fast fronts. The
// harness pins the walk, the refusals (dirty tree, unresolvable base,
// empty range, replay conflict - all exit 1), the protocol failures
// (exit 2), the per-commit bail out at the first red step, the
// walk-continues-after-a-red-commit verdict, and the install policy
// (first commit always, then only when the lock file changed) - with
// a scripted runner, no git and no npm involved.
//
//     node tests/probe-merge-checks.mts   (exit 1 on any failure)

import { rmSync } from "node:fs";

import {
  DEFAULT_BASE_REF,
  failureOutputLines,
  lockChanged,
  parseCommitLines,
  run,
  verdictLine,
} from "../scripts/commands/probe-merge.mjs";
import type { Runner, TryCommandResult } from "../scripts/commands/probe-merge.mjs";

// ---- the assertion ledger ------------------------------------------

const failures: string[] = [];
let assertions = 0;

function check(label: string, condition: boolean): void {
  assertions++;
  if (!condition) failures.push(label);
}

// ---- the scripted runner ---------------------------------------------

interface ScriptedResult {
  pattern: RegExp;
  stdout?: string;
  stderr?: string;
  returncode?: number;
}

/** A runner whose every command is scripted: each call records itself
 * and consumes the earliest unconsumed rule matching its argument
 * line. The lock-file reads come from a separate queue, in walk
 * order. The worktree-remove rule also deletes the real throwaway
 * directory the driver created. */
function createScriptedRunner(
  rules: ScriptedResult[],
  readQueue: string[],
): RunnerWithCommands {
  const commands: string[] = [];
  const remaining = [...rules];
  const reads = [...readQueue];
  return {
    commands,
    tryCommand({ args }): TryCommandResult {
      const line = args.join(" ");
      commands.push(line);
      const index = remaining.findIndex((rule) => rule.pattern.test(line));
      if (index === -1) {
        return { returncode: 99, stdout: "", stderr: `unscripted command: ${line}` };
      }
      const rule = remaining.splice(index, 1)[0] as ScriptedResult;
      if (line.startsWith("git worktree remove --force") && (rule.returncode ?? 0) === 0) {
        rmSync(args[args.length - 1] as string, { recursive: true, force: true });
      }
      return { returncode: rule.returncode ?? 0, stdout: rule.stdout ?? "", stderr: rule.stderr ?? "" };
    },
    readFile(): string {
      const next = reads.shift();
      if (next === undefined) throw new Error("read queue exhausted");
      return next;
    },
  };
}

interface RunnerWithCommands extends Runner {
  commands: string[];
}

// ---- pure helpers ------------------------------------------------------

check(
  "parse: rev-list output becomes the oldest-first walk",
  JSON.stringify(parseCommitLines({ output: "aaa\nbbb\n\n" })) === JSON.stringify(["aaa", "bbb"]),
);
check("lock: the first commit always installs", lockChanged({ lockFileText: "LOCK", previousLockFileText: null }));
check("lock: an unchanged lock does not install", !lockChanged({ lockFileText: "LOCK", previousLockFileText: "LOCK" }));
check("lock: a changed lock installs", lockChanged({ lockFileText: "LOCK-2", previousLockFileText: "LOCK" }));
check("default base: the instance probes against origin/daily", DEFAULT_BASE_REF === "origin/daily");

const passVerdict = { commit: "abcdefabcdef789", subject: "feat: a thing", failingFront: null, failureOutput: "" };
check(
  "verdict: a green commit renders with its short SHA",
  verdictLine({ verdict: passVerdict }) === "  abcdefabcdef feat: a thing - PASS",
);
const failVerdict = {
  commit: "abcdefabcdef789",
  subject: "feat: a thing",
  failingFront: "typecheck",
  failureOutput: Array.from({ length: 40 }, (_, index) => `line ${index}`).join("\n"),
};
check(
  "verdict: a red commit names its failing front",
  verdictLine({ verdict: failVerdict }) === "  abcdefabcdef feat: a thing - FAIL (typecheck)",
);
const outputLines = failureOutputLines({ verdict: failVerdict });
check("verdict: the failing output is capped at 30 lines", outputLines.length === 30);
check("verdict: the failing output is indented", outputLines[0] === "      line 0");
check("verdict: a green commit prints no output", failureOutputLines({ verdict: passVerdict }).length === 0);

// ---- the scripted walks ----------------------------------------------

// Common prefix: clean tree, resolvable refs, two commits, a prepared
// worktree, a clean replay. The worktree directory is a real mkdtemp
// path the rules cannot predict, hence the regular expressions.
function commonRules(): ScriptedResult[] {
  return [
    { pattern: /^git status --porcelain$/, stdout: "" },
    { pattern: /^git rev-parse --verify origin\/daily\^\{commit\}$/, stdout: "base123\n" },
    { pattern: /^git rev-parse --verify HEAD\^\{commit\}$/, stdout: "head789\n" },
    { pattern: /^git rev-list --reverse base123\.\.head789$/, stdout: "aa11\nbb22\n" },
    { pattern: /^git worktree add --detach \S+ head789$/, stdout: "" },
    { pattern: /checkout -B probe-merge\/\d+ head789$/, stdout: "" },
    { pattern: /rebase base123$/, stdout: "" },
    { pattern: /rev-list --reverse base123\.\.probe-merge\/\d+$/, stdout: "r11\nr22\n" },
  ];
}

// The driver's per-commit order: checkout, subject (git show), lock
// read (separate queue), install when the lock changed, then the three
// fronts. The scripted runner consumes the earliest unconsumed match,
// so each rule lands at the call it was written for.
function greenWalkRules(): ScriptedResult[] {
  const rules = commonRules();
  // commit r11: first commit, install, then the three fronts
  rules.push({ pattern: /checkout --detach r11$/, stdout: "" });
  rules.push({ pattern: /^git show -s --format=%s r11$/, stdout: "feat: the first\n" });
  rules.push({ pattern: /^npm ci$/, stdout: "" });
  rules.push({ pattern: /^npm run typecheck$/, stdout: "" });
  rules.push({ pattern: /^npm run check:structure$/, stdout: "" });
  rules.push({ pattern: /^npm run lint$/, stdout: "" });
  // commit r22: same lock -> no install; a second ci rule exists for
  // the changed-lock walk and stays unconsumed here
  rules.push({ pattern: /checkout --detach r22$/, stdout: "" });
  rules.push({ pattern: /^git show -s --format=%s r22$/, stdout: "feat: the second\n" });
  rules.push({ pattern: /^npm ci$/, stdout: "" });
  rules.push({ pattern: /^npm run typecheck$/, stdout: "" });
  rules.push({ pattern: /^npm run check:structure$/, stdout: "" });
  rules.push({ pattern: /^npm run lint$/, stdout: "" });
  rules.push({ pattern: /worktree remove --force/, stdout: "" });
  rules.push({ pattern: /^git branch -D probe-merge\/\d+$/, stdout: "" });
  return rules;
}

const greenRunner = createScriptedRunner(greenWalkRules(), ["LOCK", "LOCK"]);
check("walk: an all-green branch exits 0", run({ args: [], runner: greenRunner }) === 0);
check(
  "walk: npm ci runs once for two commits with the same lock",
  greenRunner.commands.filter((command) => command === "npm ci").length === 1,
);
check(
  "walk: the worktree is removed at the end",
  greenRunner.commands.some((command) => command.startsWith("git worktree remove --force")),
);
check(
  "walk: the probe branch is deleted at the end",
  greenRunner.commands.some((command) => command.startsWith("git branch -D probe-merge/")),
);

const changedLockRunner = createScriptedRunner(greenWalkRules(), ["LOCK", "LOCK-2"]);
check("walk: a changed lock re-installs", run({ args: [], runner: changedLockRunner }) === 0);
check(
  "walk: the changed lock installs twice",
  changedLockRunner.commands.filter((command) => command === "npm ci").length === 2,
);

// ---- one red commit: the fronts after it are not run, the walk continues ---

function redWalkRules(): ScriptedResult[] {
  const rules = commonRules();
  rules.push({ pattern: /checkout --detach r11$/, stdout: "" });
  rules.push({ pattern: /^git show -s --format=%s r11$/, stdout: "feat: the first\n" });
  rules.push({ pattern: /^npm ci$/, stdout: "" });
  rules.push({ pattern: /^npm run typecheck$/, stdout: "" });
  rules.push({ pattern: /^npm run check:structure$/, stdout: "" });
  rules.push({ pattern: /^npm run lint$/, stdout: "" });
  rules.push({ pattern: /checkout --detach r22$/, stdout: "" });
  rules.push({ pattern: /^git show -s --format=%s r22$/, stdout: "feat: the second\n" });
  rules.push({ pattern: /^npm run typecheck$/, stdout: "", stderr: "TS2304 one type error\n", returncode: 1 });
  rules.push({ pattern: /worktree remove --force/, stdout: "" });
  rules.push({ pattern: /^git branch -D probe-merge\/\d+$/, stdout: "" });
  return rules;
}

const redRunner = createScriptedRunner(redWalkRules(), ["LOCK", "LOCK"]);
check("walk: one red commit exits 1", run({ args: [], runner: redRunner }) === 1);
check(
  "walk: the fronts after the first red one are not run",
  redRunner.commands.filter((command) => command === "npm run lint").length === 1,
);
check(
  "walk: the worktree is removed even on a red walk",
  redRunner.commands.some((command) => command.startsWith("git worktree remove --force")),
);

// ---- a red install bails before every front, the walk continues ------

function installFailureRules(): ScriptedResult[] {
  const rules = commonRules();
  rules.push({ pattern: /checkout --detach r11$/, stdout: "" });
  rules.push({ pattern: /^git show -s --format=%s r11$/, stdout: "feat: the first\n" });
  rules.push({ pattern: /^npm ci$/, stdout: "", stderr: "npm ERR! lock out of sync\n", returncode: 1 });
  // no front rule before r22: any front call on r11 would consume the
  // r22 front rules below and break the r22 assertions
  rules.push({ pattern: /checkout --detach r22$/, stdout: "" });
  rules.push({ pattern: /^git show -s --format=%s r22$/, stdout: "feat: the second\n" });
  rules.push({ pattern: /^npm ci$/, stdout: "" });
  rules.push({ pattern: /^npm run typecheck$/, stdout: "" });
  rules.push({ pattern: /^npm run check:structure$/, stdout: "" });
  rules.push({ pattern: /^npm run lint$/, stdout: "" });
  rules.push({ pattern: /worktree remove --force/, stdout: "" });
  rules.push({ pattern: /^git branch -D probe-merge\/\d+$/, stdout: "" });
  return rules;
}

const installFailureRunner = createScriptedRunner(installFailureRules(), ["LOCK", "LOCK"]);
check("walk: a red npm ci fails the branch (exit 1)", run({ args: [], runner: installFailureRunner }) === 1);
{
  const ciPosition = installFailureRunner.commands.indexOf("npm ci");
  const nextCheckoutPosition = installFailureRunner.commands.findIndex(
    (command, index) => index > ciPosition && command.includes("checkout --detach r22"),
  );
  check(
    "walk: no front runs between the red install and the next commit",
    installFailureRunner.commands
      .slice(ciPosition + 1, nextCheckoutPosition)
      .every((command) => !command.startsWith("npm run")),
  );
  check(
    "walk: the walk continues after a red install",
    installFailureRunner.commands.filter((command) => command === "npm run typecheck").length === 1,
  );
}

// ---- refusals (exit 1) ---------------------------------------------------

const dirtyRunner = createScriptedRunner([{ pattern: /^git status --porcelain$/, stdout: "M file\n" }], []);
check("refusal: a dirty tree exits 1", run({ args: [], runner: dirtyRunner }) === 1);
check(
  "refusal: a dirty tree never prepares a worktree",
  !dirtyRunner.commands.some((command) => command.startsWith("git worktree add")),
);

const unresolvableBaseRunner = createScriptedRunner(
  [
    { pattern: /^git status --porcelain$/, stdout: "" },
    { pattern: /^git rev-parse --verify origin\/daily\^\{commit\}$/, stdout: "", stderr: "fatal: bad ref\n", returncode: 128 },
  ],
  [],
);
check("refusal: an unresolvable base ref exits 1", run({ args: [], runner: unresolvableBaseRunner }) === 1);
check(
  "refusal: an unresolvable base ref never prepares a worktree",
  !unresolvableBaseRunner.commands.some((command) => command.startsWith("git worktree add")),
);

const emptyRangeRunner = createScriptedRunner(
  [
    { pattern: /^git status --porcelain$/, stdout: "" },
    { pattern: /^git rev-parse --verify origin\/daily\^\{commit\}$/, stdout: "base123\n" },
    { pattern: /^git rev-parse --verify HEAD\^\{commit\}$/, stdout: "head789\n" },
    { pattern: /^git rev-list --reverse base123\.\.head789$/, stdout: "" },
  ],
  [],
);
check("refusal: a head at the base exits 1", run({ args: [], runner: emptyRangeRunner }) === 1);
check(
  "refusal: a head at the base never prepares a worktree",
  !emptyRangeRunner.commands.some((command) => command.startsWith("git worktree add")),
);

const conflictRunner = createScriptedRunner(
  [
    { pattern: /^git status --porcelain$/, stdout: "" },
    { pattern: /^git rev-parse --verify origin\/daily\^\{commit\}$/, stdout: "base123\n" },
    { pattern: /^git rev-parse --verify HEAD\^\{commit\}$/, stdout: "head789\n" },
    { pattern: /^git rev-list --reverse base123\.\.head789$/, stdout: "aa11\nbb22\n" },
    { pattern: /^git worktree add --detach \S+ head789$/, stdout: "" },
    { pattern: /checkout -B probe-merge\/\d+ head789$/, stdout: "" },
    { pattern: /rebase base123$/, stdout: "", stderr: "CONFLICT\n", returncode: 1 },
    { pattern: /rebase --abort$/, stdout: "" },
    { pattern: /worktree remove --force/, stdout: "" },
    { pattern: /^git branch -D probe-merge\/\d+$/, stdout: "" },
  ],
  [],
);
check("refusal: a replay conflict exits 1", run({ args: [], runner: conflictRunner }) === 1);
check(
  "refusal: the conflicted rebase is aborted",
  conflictRunner.commands.some((command) => command.endsWith("rebase --abort")),
);
check(
  "refusal: the conflicted worktree is cleaned up",
  conflictRunner.commands.some((command) => command.startsWith("git worktree remove --force")),
);

// ---- protocol failures (exit 2) --------------------------------------------

const brokenGitRunner = createScriptedRunner(
  [{ pattern: /^git status --porcelain$/, stdout: "", stderr: "fatal: not a git repository\n", returncode: 128 }],
  [],
);
check("protocol: a failing git status exits 2", run({ args: [], runner: brokenGitRunner }) === 2);

// ---- report ----------------------------------------------------------------

console.log(`probe-merge checks: ${assertions} assertions, ${failures.length} failure(s)`);
if (failures.length > 0) {
  for (const failure of failures) console.log("  FAIL: " + failure);
  process.exit(1);
}
