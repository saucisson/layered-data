# Orchestration protocol

Constitutional document. How work is selected, ordered, and executed by
agents in saucisson/layered-data.

## The morning directive

The human sets the morning directive as a prioritized list of issues for
the day. This list is **never edited by agents** - it is the single source
of truth for the day's work.

If `origin/main` has commits `daily` lacks (template sync, hotfix,
release), the day session runs `make sync-daily` right after
`make day-start` and before any work: the driver rebases `daily` onto
`origin/main` and pushes with `--force-with-lease`; a conflict aborts
and escalates (`needs-human`) - resolving accepted `main` content
against accepted `daily` work is a human decision (ADR-0024).

## Triage gate

Before starting any issue, the agent checks:

1. The issue has **acceptance criteria** (template `.github/ISSUE_TEMPLATE/task.md`).
2. The criteria are **unambiguous** and **testable**.
3. The issue is **not labeled `blocked`** or `needs-human`.

If any check fails, the issue is **skipped** and labeled `blocked`.
The agent moves to the next issue in the directive.

## Work protocol

1. **Select**: Pick the highest-priority unblocked issue from the directive.
2. **Label**: Add `in-progress` label to the issue.
3. **Branch**: Create `feat/<issue-id>` or `fix/<issue-id>` from `daily`.
4. **Implement**: Follow the developer contract (`docs/agents/developer.md`).
5. **Verify**: Run `npm run verify` - all gates must pass.
6. **Open PR**: Push branch, open pull request with the required template.

## Priority rules

Issues are processed in this order:

1. Issues labeled `needs-human` that have been **answered** by the human.
2. Issues that are **blocking** other issues.
3. Issues in the order specified by the morning directive.
4. New issues (only if the directive is empty and no higher-priority work exists).

## End of day

1. Freeze all merges.
2. Run `npm run verify` on `daily` to ensure integrity.
3. Run smoke tests (`make smoke-test` if available).
4. Generate day report of completed work, blocked issues, and escalations.
5. The human tests and merges `daily` into `main`.

## Budget tracking

Each issue has a budget of **3 attempts** across the entire develop-review
loop. An attempt is consumed when:

- The developer agent reports the issue as complete.
- The reviewer agent finds BLOCKING issues.
- The CI fails on the PR.

After 3 failed attempts, the issue is **automatically labeled `blocked` and
`needs-human`**, and work stops on that issue.

## Communication constraints

- Agents **never** communicate with each other except through git artifacts
  (branches, PRs, commits, issue comments).
- Agents **never** read session transcripts or shared memory from other agents.
- The reviewer agent has **no access** to the developer's session or reasoning.
- All communication with the human goes through structured channels:
  - Issue comments for non-urgent matters.
  - The notification system for urgent matters.

## State machine

```
┌─────────────┐    triage     ┌──────────────┐    implement    ┌─────────────┐
│   pending    │ ───────────► │   blocked    │                │  in-progress │
└─────────────┘               └──────────────┘                └─────────────┘
       ▲                                                                   │
       │                                                                   │
       └───────────────────────────────────────────────────────────────┘
                              budget exhausted

                      ┌─────────────────┐
                      │   needs-human  │
                      │   (answered)   │
                      └──────────┬─────┘
                                 │
                  priority order │
                                 ▼
                      ┌─────────────────┐
                      │   in-progress   │
                      └─────────────────┘
```

## Violations

Any violation of this protocol is a **BLOCKING** finding in the reviewer
checklist and must be reported immediately.
