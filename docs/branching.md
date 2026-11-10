# Branch model and the autonomous day

Constitutional document (ADR-0010). Changing it requires a human decision.

## Branches

| Branch             | Purpose                             | Who merges                                    |
| ------------------ | ----------------------------------- | --------------------------------------------- |
| `main`             | The tested, releasable product      | **Human only**, after human tests             |
| `daily`            | One working day of agent work       | Platform auto-merge, on the criteria below    |
| `feat/...`, `fix/...` | One issue each, short-lived      | Platform auto-merge into `daily`, same criteria |

`main` and `daily` are both protected branches.

## The day cycle

1. **Morning directive** - the human selects and prioritizes the day's
   issues, and runs `make day-start` (tags `daily-YYYY-MM-DD` as a restore
   point). If `origin/main` has commits `daily` lacks (template sync,
   hotfix, release), the day session then runs `make sync-daily`
   (ADR-0024) before any work starts.
2. **Triage gate** - each issue must carry acceptance criteria (template
   `.github/ISSUE_TEMPLATE/task.md`). No criteria -> the issue is labeled
   `blocked` and skipped.
3. **Work** - one issue at a time, branch `feat/<issue>` or `fix/<issue>`
   from `daily`, small pull requests (target < 1000 changed lines), rebase
   on `daily` before opening.
4. **Merge into `daily`** - platform auto-merge only when **all three**
   hold:
   - CI is green on the PR head (`npm run verify` passes),
   - the `reviewer` status check is green: the report contains **zero
     BLOCKING findings** (ADR-0016),
   - the change is not on the escalation list (`docs/agents/escalation.md`).
5. **End of day** - freeze merges, run `npm run verify`, `make smoke-test`,
   then the human tests and merges `daily` into `main`.
6. **Mutation testing** - for TypeScript projects, consider using a mutation
   testing framework like Stryker to ensure test quality (ADR-0013 equivalent).

## Integrating main into daily (ADR-0024)

`main` moves without `daily` when the human syncs the template, hotfixes,
or releases. The day session reconciles the branches itself, early in the
day (right after `make day-start`, before opening pull requests):

- `make sync-daily` rebases `daily` onto `origin/main` and pushes the
  rewritten `daily` with `--force-with-lease` (ADR-0024). A strictly
  behind `daily` is fast-forwarded instead - no rewrite, no force.
- A rebase conflict aborts and escalates (`needs-human`): resolving a
  conflict between accepted `main` content and accepted `daily` work
  is a human decision, never an unattended merge.
- `main` is never rewritten. Night sessions never run the sync: the
  unattended loop derives its worklist from `daily` and nobody answers
  a conflict at 3 a.m. (ADR-0024).

## Protections to enable

**GitHub** (`main` and `daily`):

- Require status checks: the `verify` job from `ci.yml` **and** the
  `reviewer` job from `review.yml` (ADR-0016).
- Require linear history.
- Allow force pushes on `daily` only (the sync driver pushes
  `--force-with-lease`, ADR-0024); keep them forbidden on `main`.
- Allow auto-merge (branch settings), delete head branches on merge.
- `CODEOWNERS` reserves `docs/decisions/`, `docs/agents/`, `docs/architecture.md`,
  `docs/branching.md`, `docs/review-checklist.md`, and tool configuration for
  the human owner.

**GitLab**: merge checks = pipelines must succeed (the `reviewer` job is
part of merge request pipelines); "merge when pipeline succeeds" plays
the auto-merge role; protected branches for `main` and `daily` with no
agent allowed to merge directly.

## Incident protocol

When `daily` is red: **revert first, debug second**.

1. Revert the offending merge commit (never pile a fix on a red branch).
2. Reopen the original issue with the failure evidence.
3. The issue keeps its attempt budget: after **3 failed attempts**, it is
   labeled `blocked` and escalated (`needs-human`).

An incident that cannot be resolved by revert is an **urgent** escalation:
all merges stop until the human answers (see `docs/agents/escalation.md`).

## Why this shape

`daily` exists so that agent autonomy has a blast radius of exactly one
day. `main` exists so that a human always stands between "the agents
believe it works" and "the product is updated". The merge criteria are
codified - not vibes - so both agents can check them mechanically.
The one sanctioned rewrite of `daily` (`make sync-daily`, ADR-0024)
integrates already-accepted `main` content early in the day; it never
touches `main` itself, so the human merge stays the only path in.
