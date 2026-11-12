# Contributing to layered-data

This repository is governed by an agent protocol — read these first:

- `AGENTS.md` — the constitution of the agent team (roles, working day, merge criteria, escalation list).
- `docs/branching.md` — the branch model (`main` merged by the human only, `daily` receives agent work).
- `docs/agents/developer.md` — the developer agent's full contract.
- `docs/agents/reviewer.md` — the reviewer agent's contract.
- `docs/coding-guidelines.md` — the style rules (strict TypeScript, named parameters, typed errors).

## Setup

Prerequisites: Node 22+ (native type stripping is required), npm, and VS Code recommended (the `vscode/` extension provides `.ld` syntax highlighting).

```bash
npm install
cp .env.example .env   # then edit API_TOKEN
npm run verify         # full gate: typecheck, structure, lint, tests, coverage, build
npm run serve          # quarry API on 127.0.0.1:8791 + atelier with hot reload on localhost:5173
npm run dev            # atelier only, with hot reload
```

### Troubleshooting

- **Port 8791 already in use**: set `PORT=<other>` in `.env`, or free the port (`lsof -ti:8791 | xargs kill`).
- **Default `API_TOKEN` (`changez-moi`)**: the API rejects requests until you replace it in `.env` — this is intentional, never commit a real token.
- **Missing `MISTRAL_API_KEY`**: `POST /api/generate` answers 500 without ever calling the outside — expected behavior, not a bug; set the key in `.env` to enable the pen.

### Architecture quick-start

Read `docs/architecture.md` (layer boundaries: `src/domain` <- `src/application` <- `src/presentation` <- `src/App.tsx`) and `docs/coding-guidelines.md` (strict TypeScript, named parameters, typed errors) before writing code.

### Running tests individually

Each front of `npm run verify` has its own script: `npm run typecheck`, `npm run check:structure`, `npm run lint`, `npm run test:specification`, `npm run test:editor`, `npm run test:pages`, `npm run test:server`, `npm run test:e2e` (Playwright), etc. — see the `scripts` section of `package.json`.

## For humans

- Issues with acceptance criteria live in the issue tracker; the morning directive sets the day's priorities.
- Pull requests follow `.github/PULL_REQUEST_TEMPLATE.md` — including `Closes #n` when resolving an issue.
- Run `npm run verify` before opening a PR; CI must be green.
- Constitutional files (`AGENTS.md`, `docs/agents/`, `docs/decisions/`, `docs/architecture.md`, `docs/branching.md`, lint/type/coverage config) change only with human approval — label the PR `needs-human`.

## Local artifacts

- `public/locales/**/*_old.json` files are generated locally by `npm run i18next-parser` (via `npm run i18n:extract`). They are ignored by `.gitignore` (`public/locales/**/*_old.json`) and must never be committed; `npm run i18n:extract` regenerates them cleanly on each run.

## For agents

Follow `AGENTS.md` and `docs/agents/orchestration.md` exactly. Never merge; never edit the morning directive; escalate per `docs/agents/escalation.md`.
