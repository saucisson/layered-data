#!/usr/bin/env node
// probe-merge driver: replay this branch onto a base and verify every
// commit (ADR-0008 N5, H5).
//
// The local dry run of N5 (`make probe-merge`, never a pull request)
// and the per-commit greenness gate of H5: the commits of the current
// branch are replayed onto the base inside a throwaway worktree, and
// every replayed commit must be green on the fast fronts (typecheck,
// structure, lint - the three gates `npm run verify` runs before the
// harnesses and the build). What lands on the target branch after a
// rebase merge is the branch's own commits (I3) - so the probe
// verifies those commits, one by one, not only the tip. Bisectability
// is the point: a green tip over a red middle commit poisons
// `git bisect` for every future agent.
//
// Nothing outside the worktree moves: no branch is touched, no push
// happens, `main` and `daily` are never written. The probe reports and
// exits; it never repairs. A replay conflict is a refusal (exit 1,
// never a protocol failure): conflicts escalate (I1) - the branch is
// rebased by hand and probed again.
//
// Dependencies install per commit, not per run: `npm ci` runs before
// the first commit and again only when package-lock.json changed since
// the previously probed commit; an unchanged lock reuses the installed
// graph, and a lock out of sync with the tree is itself caught by the
// fronts.
//
// Exit codes: 0 every commit green, 1 refused or a red commit
// (nothing was written), 2 protocol failure.

import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export const DEFAULT_BASE_REF = 'origin/daily';
const PROBE_BRANCH_PREFIX = 'probe-merge/';
const COMMIT_SHA_LENGTH = 12;
const FAILING_FRONT_OUTPUT_LINES = 30;
const LOCK_FILE_NAME = 'package-lock.json';

// The fast fronts of H5 - the cheap deterministic oracles that must
// pass on EVERY replayed commit, not only on the tip. Same commands
// as the npm scripts the CI runs, one process per front, output
// captured for the report; the fronts after the first red one are not
// run.
const FAST_FRONT_COMMANDS = [
  { name: 'typecheck', args: ['npm', 'run', 'typecheck'] },
  { name: 'structure', args: ['npm', 'run', 'check:structure'] },
  { name: 'lint', args: ['npm', 'run', 'lint'] },
];

const EXIT_CODE_SUCCESS = 0;
const EXIT_CODE_CRITERIA_UNMET = 1;
const EXIT_CODE_PROTOCOL_FAILURE = 2;

/** A refusal or a protocol failure, carried to the entry point as the
 * exit code; nothing outside the worktree was written either way. */
class ProbeDecision extends Error {
  constructor({ code, message }) {
    super(message);
    this.code = code;
  }
}

function refuse({ message }) {
  throw new ProbeDecision({ code: EXIT_CODE_CRITERIA_UNMET, message });
}

function protocolFailure({ message }) {
  throw new ProbeDecision({ code: EXIT_CODE_PROTOCOL_FAILURE, message });
}

function log(message) {
  console.log(`[probe-merge] ${message}`);
}

// ---- the runner: every git, npm and file read goes through it ------

/** Run one command, returning its exit and output instead of throwing;
 * the caller decides which failures are refusals and which are
 * protocol. */
function realTryCommand({ args, cwd }) {
  const completed = spawnSync(args[0], args.slice(1), {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  return {
    returncode: completed.status ?? EXIT_CODE_PROTOCOL_FAILURE,
    stdout: completed.stdout ?? '',
    stderr: completed.stderr ?? '',
  };
}

/** The default runner: real processes, real files. A harness injects
 * its own scripted runner to pin the walk without git or npm. */
export function createRealRunner() {
  return {
    tryCommand: realTryCommand,
    readFile({ path }) {
      return readFileSync(path, 'utf8');
    },
  };
}

/** git that must succeed; a bare git failure is a protocol failure. */
function runGit({ runner, args }) {
  if (args[0] !== 'git') {
    protocolFailure({ message: `internal: runGit called with ${JSON.stringify(args)}` });
  }
  const completed = runner.tryCommand({ args });
  if (completed.returncode !== EXIT_CODE_SUCCESS) {
    protocolFailure({ message: `git ${args.slice(1).join(' ')} failed: ${completed.stderr.trim()}` });
  }
  return completed.stdout;
}

// ---- the steps, in walk order -----------------------------------------

/** Refuse to probe over a dirty tree; it would never replay. */
function ensureCleanWorkTree({ runner }) {
  const completed = runner.tryCommand({ args: ['git', 'status', '--porcelain'] });
  if (completed.returncode !== EXIT_CODE_SUCCESS) {
    protocolFailure({ message: 'git status failed; cannot probe.' });
  }
  if (completed.stdout.trim() !== '') {
    refuse({
      message:
        'the working tree has uncommitted changes - commit or stash them first;' +
        ' the probe replays commits, not the working tree.',
    });
  }
}

/** Resolve a commit-ish; unresolvable is a refusal, not a failure. */
function resolveCommit({ runner, commitish }) {
  const completed = runner.tryCommand({ args: ['git', 'rev-parse', '--verify', `${commitish}^{commit}`] });
  if (completed.returncode !== EXIT_CODE_SUCCESS) {
    refuse({ message: `cannot resolve ${commitish} - fetch the base ref first (git fetch origin).` });
  }
  return completed.stdout.trim();
}

/** Parse a rev-list output into the commit walk, oldest first. */
export function parseCommitLines({ output }) {
  return output
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '');
}

/** base..head, oldest first: the walk order of the probe. */
function listCommits({ runner, baseCommit, headCommit }) {
  return parseCommitLines({
    output: runGit({ runner, args: ['git', 'rev-list', '--reverse', `${baseCommit}..${headCommit}`] }),
  });
}

/** A commit's subject line - its declared contract (H5). */
function commitSubject({ runner, commit }) {
  return runGit({ runner, args: ['git', 'show', '-s', '--format=%s', commit] }).trim();
}

/** Install only when the lock changed since the previously probed
 * commit (or when there is none yet): an unchanged dependency graph is
 * reused across checkouts. */
export function lockChanged({ lockFileText, previousLockFileText }) {
  return previousLockFileText === null || lockFileText !== previousLockFileText;
}

/** Add a throwaway worktree at the head, on a probe branch. */
function prepareWorktree({ runner, headCommit }) {
  const directory = mkdtempSync(join(tmpdir(), 'probe-merge-'));
  const probeBranch = `${PROBE_BRANCH_PREFIX}${process.pid}`;
  const context = { directory, probeBranch };
  const worktreeAdd = runner.tryCommand({ args: ['git', 'worktree', 'add', '--detach', directory, headCommit] });
  if (worktreeAdd.returncode !== EXIT_CODE_SUCCESS) {
    cleanupWorktree({ runner, context });
    protocolFailure({ message: `git worktree add failed: ${worktreeAdd.stderr.trim()}` });
  }
  const checkout = runner.tryCommand({ args: ['git', '-C', directory, 'checkout', '-B', probeBranch, headCommit] });
  if (checkout.returncode !== EXIT_CODE_SUCCESS) {
    cleanupWorktree({ runner, context });
    protocolFailure({ message: `the probe branch checkout failed: ${checkout.stderr.trim()}` });
  }
  return context;
}

/** Rebase the probe branch onto the base inside the worktree; a
 * replay conflict is a refusal - resolving it is a human decision
 * (I1). */
function replayOntoBase({ runner, context, baseCommit }) {
  const replay = runner.tryCommand({ args: ['git', '-C', context.directory, 'rebase', baseCommit] });
  if (replay.returncode !== EXIT_CODE_SUCCESS) {
    runner.tryCommand({ args: ['git', '-C', context.directory, 'rebase', '--abort'] });
    refuse({
      message:
        `replaying onto ${baseCommit} conflicts - a conflict escalates (I1):` +
        ' rebase the branch onto the base yourself, then probe again.',
    });
  }
}

/** The replayed commits, oldest first (new SHAs, replay order). */
function replayedCommits({ runner, context, baseCommit }) {
  return parseCommitLines({
    output: runGit({
      runner,
      args: ['git', '-C', context.directory, 'rev-list', '--reverse', `${baseCommit}..${context.probeBranch}`],
    }),
  });
}

/** Check out one replayed commit and run the fast fronts on it. The
 * lock file read happens after the checkout, so it is this commit's
 * dependency state that decides the install; `npm ci` runs on the
 * first commit and again only when the lock changed since the
 * previously probed commit. The first red step (install or front) is
 * the verdict; the steps after it are not run. */
function probeSingleCommit({ runner, context, commit, previousLockFileText }) {
  const checkout = runner.tryCommand({ args: ['git', '-C', context.directory, 'checkout', '--detach', commit] });
  if (checkout.returncode !== EXIT_CODE_SUCCESS) {
    protocolFailure({ message: `cannot check out ${commit} in the probe worktree: ${checkout.stderr.trim()}` });
  }
  const subject = commitSubject({ runner, commit });
  let lockFileText = null;
  try {
    lockFileText = runner.readFile({ path: join(context.directory, LOCK_FILE_NAME) });
  } catch {
    lockFileText = null; // a tree without the lock file simply never re-installs
  }
  if (lockChanged({ lockFileText, previousLockFileText })) {
    const installed = runner.tryCommand({ args: ['npm', 'ci'], cwd: context.directory });
    if (installed.returncode !== EXIT_CODE_SUCCESS) {
      return { verdict: { commit, subject, failingFront: 'install', failureOutput: `${installed.stdout}${installed.stderr}`.trim() }, lockFileText };
    }
  }
  for (const front of FAST_FRONT_COMMANDS) {
    const completed = runner.tryCommand({ args: front.args, cwd: context.directory });
    if (completed.returncode !== EXIT_CODE_SUCCESS) {
      return { verdict: { commit, subject, failingFront: front.name, failureOutput: `${completed.stdout}${completed.stderr}`.trim() }, lockFileText };
    }
  }
  return { verdict: { commit, subject, failingFront: null, failureOutput: '' }, lockFileText };
}

/** Remove the probe worktree and branch; warned, never fatal. */
function cleanupWorktree({ runner, context }) {
  const removal = runner.tryCommand({ args: ['git', 'worktree', 'remove', '--force', context.directory] });
  if (removal.returncode !== EXIT_CODE_SUCCESS) {
    log(`warning: could not remove the probe worktree ${context.directory}: ${removal.stderr.trim()}`);
    return;
  }
  const branchDeletion = runner.tryCommand({ args: ['git', 'branch', '-D', context.probeBranch] });
  if (branchDeletion.returncode !== EXIT_CODE_SUCCESS) {
    log(`warning: could not delete the probe branch ${context.probeBranch}: ${branchDeletion.stderr.trim()}`);
  }
}

/** One commit's verdict line, PASS or the failing front. */
export function verdictLine({ verdict }) {
  const shortCommit = verdict.commit.slice(0, COMMIT_SHA_LENGTH);
  if (verdict.failingFront === null) {
    return `  ${shortCommit} ${verdict.subject} - PASS`;
  }
  return `  ${shortCommit} ${verdict.subject} - FAIL (${verdict.failingFront})`;
}

/** The failing front's output, first lines only, indented. */
export function failureOutputLines({ verdict }) {
  if (verdict.failingFront === null || verdict.failureOutput === '') return [];
  return verdict.failureOutput
    .split('\n')
    .slice(0, FAILING_FRONT_OUTPUT_LINES)
    .map((line) => `      ${line}`);
}

function parseArguments({ args }) {
  const baseRefIndex = args.indexOf('--base-ref');
  if (baseRefIndex === -1 || baseRefIndex + 1 >= args.length) return { baseRef: DEFAULT_BASE_REF };
  return { baseRef: args[baseRefIndex + 1] };
}

/** Entry point: replay, probe every commit, report per-commit
 * greenness. Exit 0 green, 1 refused or red, 2 protocol failure. */
export function run({ args = [], runner = createRealRunner() } = {}) {
  try {
    const { baseRef } = parseArguments({ args });
    ensureCleanWorkTree({ runner });
    const baseCommit = resolveCommit({ runner, commitish: baseRef });
    const headCommit = resolveCommit({ runner, commitish: 'HEAD' });
    const commits = listCommits({ runner, baseCommit, headCommit });
    if (commits.length === 0) {
      log(`refused: HEAD is at ${baseRef}; nothing to probe.`);
      return EXIT_CODE_CRITERIA_UNMET;
    }
    log(`probing ${commits.length} commit(s) onto ${baseRef} (rebase replay in a throwaway worktree).`);
    const context = prepareWorktree({ runner, headCommit });
    try {
      replayOntoBase({ runner, context, baseCommit });
      const replayed = replayedCommits({ runner, context, baseCommit });
      let previousLockFileText = null;
      const verdicts = [];
      for (const commit of replayed) {
        const { verdict, lockFileText } = probeSingleCommit({ runner, context, commit, previousLockFileText });
        verdicts.push(verdict);
        previousLockFileText = lockFileText;
      }
      for (const verdict of verdicts) {
        console.log(verdictLine({ verdict }));
        for (const line of failureOutputLines({ verdict })) console.log(line);
      }
      const greenCommitCount = verdicts.filter((verdict) => verdict.failingFront === null).length;
      if (greenCommitCount === verdicts.length) {
        log(`verdict: ${verdicts.length}/${verdicts.length} commit(s) green on the fast fronts.`);
        return EXIT_CODE_SUCCESS;
      }
      log(
        `verdict: ${greenCommitCount}/${verdicts.length} commit(s) green -` +
          ' fix the red commit(s), squash in the branch (I3) and probe again.',
      );
      return EXIT_CODE_CRITERIA_UNMET;
    } finally {
      cleanupWorktree({ runner, context });
    }
  } catch (error) {
    if (error instanceof ProbeDecision) {
      console.error(
        `[probe-merge] ${error.code === EXIT_CODE_CRITERIA_UNMET ? 'refused:' : 'protocol failure:'} ${error.message}`,
      );
      return error.code;
    }
    throw error;
  }
}
