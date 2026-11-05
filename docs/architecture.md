# Architecture

This document records the architectural choices of the project. The coding
rules themselves live in `docs/coding-guidelines.md`.

## The onion

The code is organized in concentric layers. A module may only import from
layers strictly closer to the center than itself. The center knows nothing
about the world outside it.

```
┌──────────────────────────────────────────────────────────┐
│ presentation  React components and hooks — pure render,  │
│               no business logic                           │
│  ┌────────────────────────────────────────────────────┐  │
│  │ application  use cases: corpus assembly, staging,  │  │
│  │              views, flattening, linting            │  │
│  │  ┌────────────────────────────────────────────┐  │  │
│  │  │ domain  the layered-data kernel: the       │  │  │
│  │  │         space, the language, validation   │  │  │
│  │  └────────────────────────────────────────────┘  │  │
│  └────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────┘

infrastructure  lives outside the onion and points inward: the
                quarry HTTP client, browser storage, corpus
                file loading. Inner layers never import it.
```

### Dependency rule

- `src/domain/` imports **nothing** from the project (no React, no Node
  APIs, no `fetch`, no file system). It is pure computation over data.
- `src/application/` imports only from `src/domain/`.
- `src/presentation/` imports from `src/application/` and `src/domain/`
  (types only where possible).
- `src/infrastructure/` imports from inner layers for the types it
  produces, and owns every side effect: HTTP, `localStorage`, file reads.
- `src/App.tsx` is the **composition root**: the only place where
  infrastructure is constructed (the corpus loader) and handed to
  the rest of the program. `src/main.tsx` only mounts React.

### No ports, no adapters — parameter injection

We deliberately keep the indirection ceremony minimal. An application
function that needs an external capability simply takes it as a named
parameter (for instance `loadLayerSource`). The concrete implementation
is chosen by the composition root: `import.meta.glob` under Vite, `fs`
under Node for the test harness. There is no `ports/` directory and no
interface layer; the parameter type *is* the contract.

### Where each concern lives

| Concern | Layer | File |
| --- | --- | --- |
| Addresses, references, address views | domain | `src/domain/addresses.ts` |
| The space: closures, first-winner reads, memoization | domain | `src/domain/space.ts` |
| The language: tokens, parser, compiler, citations | domain | `src/domain/language/` |
| The check registry and every semantic check | domain | `src/domain/checks.ts` |
| Views: lenses, dressing, drawn shapes | domain | `src/domain/views.ts` |
| Desugaring of citations, declared names, special keys | domain | `src/domain/desugaring.ts`, `src/domain/identifiers.ts`, `src/domain/specialKeys.ts` |
| Validation, the declaration table, contract replay | domain | `src/domain/validation.ts` |
| Bilingual messages, the kernel vocabulary (`renderMessage`, `kernelLabel`) | domain | `src/domain/messages.ts` |
| Corpus assembly (kernel construction) | application | `src/application/corpus.ts` |
| Staging of additions, flattening, linting | application | `src/application/staging.ts`, `src/application/flatten.ts`, `src/application/linting.ts` |
| The verified geologist loop, the living edition | application | `src/application/penLoop.ts`, `src/application/edition.ts` |
| Quarry HTTP client, browser storage, corpus loading | infrastructure | `src/infrastructure/` |
| Workshop language detection and memory | infrastructure | `src/infrastructure/browserLanguage.ts` |
| Bilingual labels (`say`, `localized`, `labelOf`) | presentation | `src/presentation/i18n.ts` |
| React components and hooks | presentation | `src/presentation/` |
| Wiring (kernel, refinement graph, line targets, state) | composition root | `src/App.tsx` |
| Mounting React | entry point | `src/main.tsx` |

## The kernel

The domain centers on one object: the **space** (`layeredDataKernel`), the
assembled stack of layers. Layers refine each other; a read at an address
walks the refinement chain and returns the first-winner value. The kernel
is total: it never throws, it reports through typed diagnostics. The
kernel is the only place in the code where mutable state is allowed
(the touch journal and the generation counter), and it is marked as such.

## The corpus

The corpus is **data**, not code: one `.ld` file per formalism under
`formalisms/kernel/`, French prose included — the refactoring never
touches it. The loader reads the raw sources and hands them to the
assembler; the corpus order lives in the domain, not in the file list.

## Verification

The kernel behavior is proven on complementary fronts, all replayed
in the same order by the CI (`.github/workflows/ci.yml`) and by
`npm run verify`:

- **Types** (`npm run typecheck`): `tsc --noEmit`, strict, over two
  configurations. `tsconfig.json` covers the workshop (`src`, no Node
  types — the domain stays pure), `tsconfig.node.json` covers the
  server side (`server.ts`, the harnesses, `vite.config.ts`, with
  `@types/node`). Node strips types at run time and never checks
  them: this front lives only in the compiler — and in the CI, the
  only place where the whole tree is actually read type-wise.
- **The audit** (`tests/audit-kernel.mts`): the dump of every
  observable kernel read over the whole corpus must stay
  **byte-identical** to `tests/baseline-kernel.txt`. The baseline was
  captured before the refactoring; any difference is a regression.
- **The executable specification** (`tests/specification-properties.mts`):
  the normative obligations O1–O18 and conformance requirements C1–C8
  of `docs/specification.md`, proven as properties — closures (dedup,
  own node first, the measured diamond), reads (first winner,
  statuses, MASK), keys, anchors, immutability (call-order
  independence, permutation invariance of the 47-layer assembly),
  the cycle guard, late binding, desugaring (topological order,
  idempotence), and the touch protocol (exact invalidation).
- **The staging checks** (`tests/staging-checks.mts`): a sound draft
  is accepted and applied, a broken syntax is refused at the syntax
  step, an orphan target is refused as « cible-inconnue », a betrayed
  expectation as « attendu-trahi » — the observable vocabulary of the
  verdicts is frozen like the statuses are.
- **The verified geologist loop** (`src/application/penLoop.ts`, proven by
  `tests/pen-loop-checks.mts`): the geologist proposes, the staging judges,
  the refusal travels back to the model with its verdicts — up to a
  spendable budget of attempts. A pure use case (the model call is
  injected), consumed by the server: `/api/generate` only ever answers
  with a staged draft.
- **The living editor** (`src/application/edition.ts`, proven by
  `tests/editor-checks.mts`): a runtime-added layer leaves the living
  context for its judgement, the staging re-validates corpus and
  additions whole and replays the expectations of the other living
  layers; the accepted tree replaces the old one in place, the write
  is declared through the touch — the edited layer's memo entries and
  the children's (O18 across the refinement chain) are invalidated,
  the panels re-read the space. A rename or a smuggled layer is
  refused by the edition guards; a betrayed expectation of another
  living layer is refused and the space stays intact. Without the
  touch, the memoized closure would keep serving the old chain
  silently — the protocol is mandatory, and the harness measures it.
- **The bilingual workshop** (`tests/i18n-checks.mts`): the workshop
  speaks two languages — English by default, French one click away.
  The kernel codes (statuses, kinds, steps) stay stable in the data;
  `renderMessage` and `kernelLabel` dress them in the workshop
  language, threaded to every leaf by an explicit `language` prop (no
  React context). Every pedagogical surface — the glossary, the
  tutorial, the scenarios, the view notes, the role of the 47 layers,
  the diagnostics fold, the geologist's system prompt — carries its two
  texts, and the harness measures the parity. The corpus `.ld`
  formalisms stay in their own tongue; the French audit half stays
  byte-identical from one version to the next.

```bash
npm run verify         # typecheck, structure, all six harnesses, build
npm test               # the six harnesses alone
```

The audit line of defense never weakens: no change to the domain is
complete until the dump reports an identical baseline.
