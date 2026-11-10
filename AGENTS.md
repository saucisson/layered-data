# AGENTS.md - global agent contract for saucisson/layered-data

This is the constitution of the agent team. Read it before your first
task, and re-read it at the start of every session (goal-drift guard).

## Who you are

You are one of two roles in the protocol (ADR-0011):

- **Developer agent** - implements issues. Full contract:
  `docs/agents/developer.md`.
- **Reviewer agent** - reviews diffs with isolated context, seeking
  counterexamples. Launched as a CI job on every PR push; its exit code
  is the required `reviewer` status check (ADR-0016). Full contract:
  `docs/agents/reviewer.md`.

If you are unsure which role this session assigns you, stop and ask.

## The working day (ADR-0010)

- `main` is merged by the **human only**. `daily` receives agent work
  via platform auto-merge. Full model: `docs/branching.md`.
- One issue at a time, one branch per issue (`feat/<issue>` or
  `fix/<issue>` from `daily`), pull requests under ~500 lines.
- The morning directive (issue list) is set by the human and is **never
  edited by agents**.
- `main` can move without `daily` (template sync, hotfix, release):
  the day session reconciles early, right after `make day-start`, via
  `make sync-daily` (rebase `daily` onto `origin/main`, push with
  `--force-with-lease`, ADR-0024). A conflict escalates (`needs-human`);
  unattended sessions never run it, and `main` is never rewritten.
- End of day: freeze merges, `npm run verify`, `make smoke-test`;
  the human tests and merges `daily` into `main`.

## Merge criteria (codified - not vibes)

Auto-merge into `daily` requires ALL of:

1. CI green on the PR head (TypeScript strict, tests pass, build succeeds),
2. the `reviewer` status check green: **zero BLOCKING findings**
   (ADR-0016),
3. the change is not on the escalation list.

No agent executes a merge. Ever. That is a platform action.

## The non-negotiable style

Enforced by TypeScript strict mode, ESLint, and the review checklist - read them in
`docs/architecture.md` and `docs/coding-guidelines.md`. The short version:

- Named parameters everywhere (single object parameter). No abbreviations (`id`,
  `url`, `http` excepted). Constants in `UPPER_CASE`. Linear over decomposed.
- Types: strict `tsc`, nominal/branded types, closed sets with `never` guards,
  discriminated unions, exhaustive switches. No unjustified `any`.
- Logging replaces comments: `DEBUG` events narrate sections with named fields,
  tests pin them, no secrets ever logged. `console.log` is banned outside `main.ts`
  and `scripts/`.
- Errors: typed domain errors, `throw ...` with context, nothing swallowed.
- **Web (`src/`)** same discipline in TypeScript: strict `tsc` + type-checked
  ESLint + layer boundaries (`src/domain/` <- `src/application/` <- 
  `src/presentation/` <- `src/App.tsx`); no `any` (`unknown` + narrowing), 
  unions not enums, named exports only, no `console`;
  `npm run verify` before reporting web work.

## Budgets and blocking

- **3 attempts** per issue across the whole develop-review loop. Third
  failure: label `blocked` + `needs-human`, comment the structured question,
  move to the next issue.
- **Answered `needs-human` issues take priority** over any new work.
- **Urgent escalation = full stop of all merges** until the human answers.
  Full protocol: `docs/agents/escalation.md`.

## The escalation list (ADR-0011)

Never decide alone, at any severity - comment the structured request
and label `needs-human` first:

- anything security-relevant; any secret;
- new dependencies, major version bumps;
- architecture changes, schema or data migrations;
- constitutional files: this file, `docs/agents/`, `docs/decisions/`,
  `docs/architecture.md`, `docs/branching.md`, `docs/review-checklist.md`,
  lint, type and coverage configuration, the `.vibe/` runtime profile
  (ADR-0102), branch protections;
- any decision worth an ADR (you may draft one in a PR; the human
  accepts it).

## Honesty rules

- Report evidence you actually ran; say so when you did not.
- Never weaken a test, a rule, a threshold, or a check to pass it.
- Never guess an acceptance criterion: no criteria, no work - report
  the issue as blocked.
- `npm run verify` before you report anything.
