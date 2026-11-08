#!/usr/bin/env node
// sync-daily driver: reconcile `daily` with `origin/main` (ADR-0024).
//
// The merge flow is one-directional (ADR-0010): work lands in `daily`
// through reviewed pull requests, and the human merges `daily` into
// `main` at the end of the day. But `main` can also move WITHOUT
// passing through `daily`: a template sync the human commits on
// `main`, a hotfix, a release. The branches then diverge, and merging
// `main` into `daily` would write a merge commit (linear history
// forbids it), while a raw rebase rewrites a protected branch. This
// driver is the one sanctioned path (ADR-0024):
//
// - run it from a clean `daily` checkout, early in the day (right
//   after `make day-start`, before opening pull requests);
// - `daily` already contains `origin/main` -> exit 0, nothing written;
// - `daily` is strictly behind -> fast-forward, a normal push, no
//   rewrite at all;
// - diverged -> rebase `daily` onto `origin/main`, verify the replayed
//   `daily` contains `origin/main` and the same number of daily-only
//   commits, then push with `--force-with-lease`;
// - a rebase conflict aborts the rebase and refuses (exit 1): resolving
//   accepted `main` content against accepted `daily` work is a human
//   decision, never an unattended merge;
// - `main` is never rewritten, and unattended (night) sessions never
//   run this driver (ADR-0024).
//
// Exit codes: 0 synced (or nothing to do), 1 refused (wrong branch,
// dirty tree, conflict - nothing was written), 2 protocol failure
// (daily restored, remote untouched).

import { execFileSync } from 'node:child_process';

const DAILY_BRANCH_NAME = 'daily';
const MAIN_REMOTE_REFERENCE = 'origin/main';
const EXIT_CODE_SUCCESS = 0;
const EXIT_CODE_REFUSED = 1;
const EXIT_CODE_PROTOCOL_FAILURE = 2;

/** Run git, returning { returncode, stdout } instead of throwing. */
function tryGit({ args }) {
  try {
    const stdout = execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    return { returncode: 0, stdout };
  } catch (error) {
    return { returncode: error.status ?? 1, stdout: error.stdout ?? '' };
  }
}

/** Run git, throwing on failure (for steps that must succeed). */
function runGit({ args }) {
  return execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}

function log(message) {
  console.log(`[sync-daily] ${message}`);
}

function fail({ message, code }) {
  console.error(`[sync-daily] ERROR: ${message}`);
  return code;
}

function currentBranch() {
  return tryGit({ args: ['rev-parse', '--abbrev-ref', 'HEAD'] }).stdout.trim();
}

function workingTreeIsClean() {
  return tryGit({ args: ['status', '--porcelain'] }).stdout.trim() === '';
}

function remoteMainExists() {
  return tryGit({ args: ['rev-parse', '--quiet', '--verify', `refs/remotes/${MAIN_REMOTE_REFERENCE}`] }).returncode === 0;
}

function isAncestor({ ancestor, descendant }) {
  return tryGit({ args: ['merge-base', '--is-ancestor', ancestor, descendant] }).returncode === 0;
}

function dailyOnlyCommitCount() {
  return Number(tryGit({ args: ['rev-list', '--count', `${MAIN_REMOTE_REFERENCE}..HEAD`] }).stdout.trim());
}

function restoreDaily({ expectedHead }) {
  tryGit({ args: ['reset', '--hard', expectedHead] });
}

/** Refuse anything but a clean daily checkout; null means: proceed. */
function preconditionExitCode({ branch }) {
  if (branch !== DAILY_BRANCH_NAME) {
    return fail({
      message: `sync-daily runs from the ${DAILY_BRANCH_NAME} checkout, not from ${branch || 'a detached head'} - it rewrites ${DAILY_BRANCH_NAME} only (ADR-0024).`,
      code: EXIT_CODE_REFUSED,
    });
  }
  if (!workingTreeIsClean()) {
    return fail({
      message: 'the working tree is not clean - commit or stash first: a rebase over a dirty tree is not honest glue (ADR-0024).',
      code: EXIT_CODE_REFUSED,
    });
  }
  return null;
}

function fetchOrigin() {
  const fetch = tryGit({ args: ['fetch', 'origin'] });
  if (fetch.returncode === 0) return EXIT_CODE_SUCCESS;
  return fail({
    message: `could not fetch origin (${fetch.returncode}) - do not sync on stale references.`,
    code: EXIT_CODE_PROTOCOL_FAILURE,
  });
}

function pushDaily({ force, previousHead }) {
  const args = force
    ? ['push', '--force-with-lease', 'origin', DAILY_BRANCH_NAME]
    : ['push', 'origin', DAILY_BRANCH_NAME];
  const pushed = tryGit({ args });
  if (pushed.returncode === 0) return EXIT_CODE_SUCCESS;
  restoreDaily({ expectedHead: previousHead });
  return fail({
    message: `the push of ${DAILY_BRANCH_NAME} was refused (${pushed.returncode}) - daily is restored locally, the remote was not touched.`,
    code: EXIT_CODE_PROTOCOL_FAILURE,
  });
}

/** Strictly behind: move daily to origin/main without any rewrite. */
function fastForwardDaily({ previousHead }) {
  const merged = tryGit({ args: ['merge', '--ff-only', MAIN_REMOTE_REFERENCE] });
  if (merged.returncode !== 0) {
    restoreDaily({ expectedHead: previousHead });
    return fail({
      message: 'the fast-forward onto origin/main failed - daily is restored, nothing was pushed.',
      code: EXIT_CODE_PROTOCOL_FAILURE,
    });
  }
  const pushExitCode = pushDaily({ force: false, previousHead });
  if (pushExitCode === EXIT_CODE_SUCCESS) {
    log(`${DAILY_BRANCH_NAME} was strictly behind: fast-forwarded onto ${MAIN_REMOTE_REFERENCE} and pushed - no commit was rewritten (ADR-0024).`);
  }
  return pushExitCode;
}

/** Diverged: replay daily onto origin/main, verify, lease-push. */
function rebaseDailyOntoMain({ previousHead, dailyOnlyBefore }) {
  const rebased = tryGit({ args: ['rebase', MAIN_REMOTE_REFERENCE] });
  if (rebased.returncode !== 0) {
    tryGit({ args: ['rebase', '--abort'] });
    return fail({
      message: 'rebasing daily onto origin/main hit a conflict - the rebase is aborted and daily is untouched. Resolving accepted main content against accepted daily work is a human decision: escalate it (needs-human), never merge it by hand (ADR-0024).',
      code: EXIT_CODE_REFUSED,
    });
  }
  if (!isAncestor({ ancestor: MAIN_REMOTE_REFERENCE, descendant: 'HEAD' })) {
    restoreDaily({ expectedHead: previousHead });
    return fail({
      message: 'the replayed daily does not contain origin/main - daily is restored, nothing was pushed.',
      code: EXIT_CODE_PROTOCOL_FAILURE,
    });
  }
  const dailyOnlyAfter = dailyOnlyCommitCount();
  if (dailyOnlyAfter !== dailyOnlyBefore) {
    restoreDaily({ expectedHead: previousHead });
    return fail({
      message: `the replay changed the daily-only commit count (${dailyOnlyBefore} before, ${dailyOnlyAfter} after) - daily is restored, nothing was pushed.`,
      code: EXIT_CODE_PROTOCOL_FAILURE,
    });
  }
  const pushExitCode = pushDaily({ force: true, previousHead });
  if (pushExitCode === EXIT_CODE_SUCCESS) {
    log(`${DAILY_BRANCH_NAME} rebased onto ${MAIN_REMOTE_REFERENCE}: ${dailyOnlyBefore} commit(s) replayed, pushed with --force-with-lease - main was not touched (ADR-0024). Local branches based on the old daily need a rebase before their pull request.`);
  }
  return pushExitCode;
}

/** Entry point: clean daily checkout in, synced (or refused) out. */
export function run() {
  const refusalExitCode = preconditionExitCode({ branch: currentBranch() });
  if (refusalExitCode !== null) return refusalExitCode;
  const fetchExitCode = fetchOrigin();
  if (fetchExitCode !== EXIT_CODE_SUCCESS) return fetchExitCode;
  if (!remoteMainExists()) {
    log(`Nothing to sync: ${MAIN_REMOTE_REFERENCE} does not exist on the remote yet.`);
    return EXIT_CODE_SUCCESS;
  }
  if (isAncestor({ ancestor: MAIN_REMOTE_REFERENCE, descendant: 'HEAD' })) {
    log(`${DAILY_BRANCH_NAME} already contains ${MAIN_REMOTE_REFERENCE} - nothing to sync.`);
    return EXIT_CODE_SUCCESS;
  }
  const previousHead = tryGit({ args: ['rev-parse', 'HEAD'] }).stdout.trim();
  if (isAncestor({ ancestor: 'HEAD', descendant: MAIN_REMOTE_REFERENCE })) {
    return fastForwardDaily({ previousHead });
  }
  return rebaseDailyOntoMain({ previousHead, dailyOnlyBefore: dailyOnlyCommitCount() });
}
