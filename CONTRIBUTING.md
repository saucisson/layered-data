# Contributing to layered-data

This repository is governed by an agent protocol — read these first:

- `AGENTS.md` — the constitution of the agent team (roles, working day, merge criteria, escalation list).
- `docs/branching.md` — the branch model (`main` merged by the human only, `daily` receives agent work).
- `docs/agents/developer.md` — the developer agent's full contract.
- `docs/agents/reviewer.md` — the reviewer agent's contract.
- `docs/coding-guidelines.md` — the style rules (strict TypeScript, named parameters, typed errors).

## For humans

- Issues with acceptance criteria live in the issue tracker; the morning directive sets the day's priorities.
- Pull requests follow `.github/PULL_REQUEST_TEMPLATE.md` — including `Closes #n` when resolving an issue.
- Run `npm run verify` before opening a PR; CI must be green.
- Constitutional files (`AGENTS.md`, `docs/agents/`, `docs/decisions/`, `docs/architecture.md`, `docs/branching.md`, lint/type/coverage config) change only with human approval — label the PR `needs-human`.

## Local artifacts

- `public/locales/**/*_old.json` files are generated locally by `npm run i18next-parser` (via `npm run i18n:extract`). They are ignored by `.gitignore` (`public/locales/**/*_old.json`) and must never be committed; `npm run i18n:extract` regenerates them cleanly on each run.

## For agents

Follow `AGENTS.md` and `docs/agents/orchestration.md` exactly. Never merge; never edit the morning directive; escalate per `docs/agents/escalation.md`.
