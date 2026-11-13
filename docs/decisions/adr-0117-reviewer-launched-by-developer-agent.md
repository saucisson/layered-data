# ADR-0117: Reviewer launch mechanics - developer agent launches the reviewer in parallel with CI

- Status: proposed
- Date: 2026-11-13
- Amends: ADR-0016

## Context

ADR-0016 launched the reviewer as a CI job (`.github/workflows/review.yml`)
whose exit code was the required `reviewer` status check. In practice the
workflow was disabled (`disabled_manually`), which left the merge criteria
without their second gate: the platform could not auto-merge, and the
developer agent had to merge by hand without a reviewer report.

The coding agent (developer agent) is itself a long-lived process that can
spawn an isolated subagent. That makes the CI job unnecessary: the
developer agent can launch the reviewer **in parallel with CI** on every
PR push, wait for its report, and merge only when both gates are green.

## Options considered

- **Keep the CI job** (ADR-0016 as-is): a required status check is
  enforced by branch protection, but it depends on a workflow staying
  enabled and on platform auto-merge; when disabled, the gate silently
  disappears.
- **Developer agent launches the reviewer subagent** (chosen): the
  launcher is the agent that owns the PR, the review runs in parallel
  with CI instead of serializing after it, and the merge decision
  (developer agent, rebase-only, into `daily`) consumes the report
  directly. Isolation is preserved by construction: the review bundle
  is the subagent's sole context.
- **Human reviews every PR**: does not scale; contradicts ADR-0011.

## Decision

The reviewer agent is launched by the **developer agent** as an isolated
subagent, in parallel with CI, on every pull request push (`opened`,
`synchronize`, `reopened`):

1. The developer agent builds the **review bundle** (reviewer contract,
   architecture rules, review checklist, all ADRs, the PR description,
   the diff) and hands it to the reviewer subagent as its sole user
   content.
2. The reviewer answers with the structured JSON report (ADR-0016
   format: `findings` with `severity`, `file`, `line`, `rule`,
   `evidence`). The developer agent posts it as a PR comment - one per
   push, the latest is authoritative.
3. Merge criterion 2 is: **zero BLOCKING findings** in the latest
   report. A protocol failure (missing key, invalid answer) is
   fail-closed: treated as BLOCKING.
4. `.github/workflows/review.yml` is removed; there is no CI trigger
   for the review. Branch protection requires only the `ci.yml` checks;
   the reviewer gate is enforced by the developer agent before it merges
   into `daily` (rebase-only). `main` remains human-only.

## Consequences

- The review runs **in parallel** with CI, not after it: the PR cycle
  time drops by one serial CI job.
- The reviewer gate no longer depends on a workflow staying enabled;
  it is enforced by the agent that performs the merge.
- The reviewer's isolation is unchanged (bundle-only context, ideally a
  different model than the developer).
- The 3-attempt budget per issue still spans the whole
  develop-review loop, including re-reviews after fixes.
