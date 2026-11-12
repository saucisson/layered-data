# Layered Data — the formalism design workshop

A standalone workshop where **the definitions themselves are data**: formalisms
and models are layers that sediment on top of each other (refinement,
inheritance, first-wins reading). The atelier lets you **define formalisms,
validate them by linting, and display and graphically edit models**. A Petri
net derives from the bedrock of hypergraphs up to the five philosophers'
dinner, and its state space inherits from the net by late binding. The model
comes from the paper _Layered Data: A Modular Formal Definition without
Formalisms_ (PNSE'16).

## Contents

The code follows an onion architecture, documented in
`docs/architecture.md` (the coding rules, binding for all of `src/` and
`server.ts`, live in `docs/coding-guidelines.md`):

- `src/domain/` — the layered-data kernel, pure: the space (closures,
  first-wins reading), the language (tokenizer, parser, compiler,
  citations), the semantic checks, the validation, the views (lenses).
  It imports neither React, nor Node, nor any file: pure computation on
  data.
- `src/application/` — the use cases: corpus assembly from sources,
  staging of additions (a breaking candidate is refused), flattened
  views, linting.
- `src/infrastructure/` — the effects towards the outside: corpus
  loading (Vite glob), HTTP client of the quarry, access-code storage.
- `src/presentation/` — the React components: pure in rendering, no
  business logic.
- `src/App.tsx` — the composition root: the kernel is assembled there,
  the states live there, the panels (① layers, ② formalism, ③ reading,
  ④ point of view) are wired there.
- `formalisms/kernel/` — the 85 layers of the bedrock, one `.ld` file
  per layer.
- `formalisms/users/` — the personal quarry (empty at first).
- `server.ts` — the quarry: layers API + AI geologist + static serving.
- `tests/` — the verification harnesses (see below).
- `vscode/` — the VS Code extension: syntax highlighting for the `.ld`
  language (build and installation below).
- `docs/specification.md` — the normative specification of the kernel
  (obligations O1–O18, conformance C1–C8, two-regime theorems T1–T3),
  made executable by `tests/specification-properties.mts`.
- `docs/archive/filiation.md` — the intellectual history (archived,
  kept for reference).

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) — humans and agents follow the protocol in `AGENTS.md` and `docs/branching.md`.

## Quick start

```bash
npm install
cp .env.example .env          # then edit API_TOKEN
npm run serve                 # quarry (API 127.0.0.1:8791) + workshop with hot reload (localhost:5173, proxy /api)
npm run dev                   # the workshop alone, with hot reload
npm run build && npm run serve:prod # the built workshop, served by the quarry
npm test                      # the verification harnesses (see below)
npm run check:structure       # JSX/tsx balance (safety net, no compiler)
```

### With Docker

```bash
cp .env.example .env           # then edit API_TOKEN, POSTGRES_USER, POSTGRES_PASSWORD
docker compose up --build      # workshop on 0.0.0.0:8791 + PostgreSQL (rate limiting active)
```

The `docker-compose.yml` deploys two services: `postgres` (named volume
`postgres-data`, schema initialized on first start via
`docker-entrypoint-initdb.d/`) and `atelier`, which waits for the database
and receives `DATABASE_URL` — the rate-limit counters then live in the
database. Without a database (local dev): `DATABASE_URL= docker compose up --no-deps --build atelier`.

`API_TOKEN`, `POSTGRES_USER` and `POSTGRES_PASSWORD` must be defined in the
environment or `.env` (compose refuses to start otherwise). See
[docs/deployment.md](docs/deployment.md) for deployment behind a reverse
proxy.

## Syntax highlighting in VS Code

The declarative extension lives in `vscode/`: TextMate grammar
(`syntaxes/ld.tmLanguage.json`) and manifest, no dependency, no compilation.
Details in `vscode/README.md`.

```bash
# try without installing, from the repository root:
code --extensionDevelopmentPath=vscode

# package the .vsix (vsce via npx, from the extension folder):
cd vscode && npx @vscode/vsce package

# install (a prebuilt .vsix is provided in vscode/):
code --install-extension vscode/layered-data-0.2.0.vsix
```

After any grammar change, regenerate the `.vsix` before installing. The
harness `node tests/vscode-checks.mts` validates the grammar against the
whole `.ld` corpus.

## The quarry API

See [docs/deployment.md](docs/deployment.md) for production deployment
(reverse proxy, HTTPS, checklist).

The access code travels in the `x-access-code` header. All routes require
it and return JSON, unless stated otherwise.

| Route                  | Effect                                                            |
| ---------------------- | ----------------------------------------------------------------- |
| `GET /api/whoami`      | 200 with a valid code, 401 otherwise                              |
| `GET /api/layers`      | `{ layers: [{ name, builtIn }] }` — bedrock + visitors' layers    |
| `GET /api/layers/:nom` | `{ name, builtIn, source }` — the `.ld` layer                     |
| `PUT /api/layers/:nom` | writes a visitor layer (403 on the bedrock, 400 invalid name)     |
| `POST /api/generate`   | body `{ prompt }`, **plain text** response: the layer in the language |

The bedrock (the 85 layers of the corpus) is read-only: `PUT` and `DELETE`
answer 403 there — and since ADR-0103, the rule lives in the protocol
itself, not only at the quarry's door: staging and edition carry the
bedrock's signature and refuse to touch it themselves ("bedrock-occupied",
"bedrock-edited").

## The geologist and the contract

The system prompt of `/api/generate` embeds the workshop's state, read from
disk on each call: the layered-data manifesto (refinement, first-wins
reading, citations, lenses), the complete stratigraphic column (one
`layer … refines …` line per bedrock layer, plus the visitors' layers), a
full corpus example and the tests contract. Upstream errors (refused key,
unknown model, exhausted quota) are returned as-is in the response, never
silenced.

**The geologist proposes, the staging judges**: every `/api/generate`
proposal is verified server-side by the workshop's own staging (syntax,
unknown target, betrayed expectations…); a refusal goes back to the model
with its verdicts, up to `PEN_MAX_ATTEMPTS` proposals (3 by default).
Since ADR-0102, the checks registry is itself a bedrock layer
(`formalisms/kernel/check-registry.ld`): contracts are data, and the lint
audits the seams ("contract-without-algorithm", "algorithm-without-contract",
"contract-unreadable"). The response is always a staged layer: plain text
on 200, spoken refusal on 422 — and the browser's staging remains the
final judge.

The tests contract: expectations (`expect … = …`, `expect … absent`)
travel with the layer and replay at validation; a betrayed expectation
becomes an "expectation-betrayed" verdict. Protocol: **the geologist
proposes, never the truth — expectations are measured, not guessed**.

## Verification

All fronts run under bare Node (native type stripping) — the CI
(`.github/workflows/ci.yml`) replays exactly the same chain as
`npm run verify`:

0. **Strict typing** (`npm run typecheck`): `tsc --noEmit` on both
   configurations — `tsconfig.json` (the workshop: `src`, no Node types,
   so the domain stays pure) and `tsconfig.node.json` (the server side:
   `server.ts`, the harnesses, `vite.config.ts`, with `@types/node`).
   Node never checks types at load time: that front lives only in the
   compiler.
1. **The executable specification** (`npm run test:specification`,
   `tests/specification-properties.mts`) checks the obligations O1–O18
   and requirements C1–C8 of `docs/specification.md` as properties —
   conformance measurements, not formal proofs: closures (dedup, own
   node first, the measured diamond), reads (first-wins, statuses),
   keys, anchors, immutability (call-order independence, permutation
   invariance of the 85-layer assembly), the cycle guard, late binding,
   desugaring (topological order, idempotence), the exact invalidation
   protocol — and, since ADR-0106, the two-regime algebra theorems.
2. **The staging checks** (`npm run test:staging`,
   `tests/staging-checks.mts`) pin the additions protocol: a healthy
   draft accepted and applied, broken syntax refused at the "syntax"
   step, unknown target refused, betrayed expectation refused, a draft
   claiming a bedrock name refused ("bedrock-occupied", ADR-0103).
3. **The geologist loop** (`npm run test:pen-loop`,
   `tests/pen-loop-checks.mts`) checks the server-side loop
   (`src/application/penLoop.ts`, injected geologist — offline).
4. **The living editor checks** (`npm run test:editor`,
   `tests/editor-checks.mts`) pin the edition protocol
   (`src/application/edition.ts`).
5. **The i18n mechanism checks** (`npm run test:i18n`,
   `tests/i18n-checks.mts`) verify the translation plumbing: English
   content by default, English fallback when French is absent
   (ADR-0113); the kernel codes stay stable in the data.
6. Plus the pages, model editor, editor session, validation stream,
   performance, server HTTP, reviewer, error boundary, access-code
   consent, rate-limit, PostgreSQL and VS Code harnesses — see the
   `scripts` section of `package.json`.

`npm test` runs the harness chain; `npm run verify` runs the whole chain
(typing, structure, harnesses, build). The normative specification lives in
`docs/specification.md` (kept in French: the product's observable vocabulary
is French).

Under Node, the harnesses import the domain directly (native type
stripping); under Vite, the workshop loads the same domain — the corpus
exists only once.

## Guardrails

- The server listens on `127.0.0.1` by default; only change `HOST` behind
  an authenticated reverse proxy.
- No key is embedded: the geologist only goes out if `MISTRAL_API_KEY` is
  set in the environment or `.env`.
