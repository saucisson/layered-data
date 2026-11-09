# ADR-0027: Inline checks, English-first formalisms, i18next for translations

- Status: proposed
- Date: 2026-11-09

## Context

ADR-0022 made check behavior writable in the language (the "couple" —
`check name { level, condition, judgment { when, formula, message } }`),
but only `hypergraph` poses its checks that way. The other seven tags
(`dag`, `arbre`, `oriented`, `sperner`, `k-partite`, `containers`,
`cardinality`) are still bare tags resolved through two indirection
layers: the `check-registry.ld` layer (contracts: level, required slots)
and the `checkRegistry` table in `src/domain/checks.ts` (nine hardcoded
algorithms). Reading what `dag` means requires opening three files.

Separately, the formalisms (`.ld` files) are written in French — comments,
check messages — while the rest of the workshop chrome is bilingual
English/French through a hand-rolled `VOCABULARY` table in
`src/domain/messages.ts`. The formalisms are the odd one out: their
messages are hardcoded French strings, unreachable by the i18n parity
test.

## Options considered

- **Keep the registry + algorithm table** (status quo): rejected — the
  indirection is the cost ADR-0022 already paid to remove; the registry
  duplicates what an inline formula states directly;
- **Codes as translation keys** (`check.simple.repeated-vertex`):
  rejected — opaque at reading time; the English string inline in the
  `.ld` is self-documenting;
- **Hand-rolled bilingual table extended to formalisms**: rejected —
  no static detection of missing or dead keys; the parity test only
  covers what it knows to look for;
- **i18next + i18next-parser** (chosen): mature, framework-agnostic core
  usable outside React, static extraction from sources, catalog diff
  detects missing and dead keys.

## Decision

1. **Checks are inline.** Every check is posed as
   `check <name> at <level>: <formula>` with an optional
   `message = "..."`. The formula is the semantics; the name is the
   label. The `check-registry.ld` layer disappears — its slot contracts
   are subsumed by the formula's free logic (a term that fails to
   denote is handled by the formula itself). `checks.ts` shrinks to the
   formula interpreter and the execution engine; the nine hardcoded
   algorithms and the `checkRegistry` table are removed.
2. **Formalisms are English-first.** Comments, check names' messages,
   and all human-readable strings in `.ld` files are written in English.
   Layer names and special keys (`checks`, `bindings`) are stable
   identifiers and stay as they are.
3. **Translations live in catalogs, keyed by the English string.**
   `i18next` loads `public/locales/<locale>/translation.json`. The key
   IS the English source string — readable inline, no opaque codes.
   French translations live in `public/locales/fr/translation.json`.
4. **Static detection of missing and dead keys.** `i18next-parser`
   extracts keys from `src/**/*.{ts,tsx}` (via `t()` calls) and from
   `formalisms/**/*.ld` (via a custom lexer matching `message = "..."`).
   `scripts/i18n-check.mjs` fails the build when a key is used in
   sources but missing from a catalog (missing translation) or present
   in a catalog but no longer referenced (dead key). Wired into
   `npm test` via `npm run i18n:check`.

## Consequences

- `formalisms/kernel/check-registry.ld` and its tutorial mirror are
  deleted; `REGISTRY_LAYER_NAME`, `registryContractsOf`, and
  `registryAuditOf` are removed from `checks.ts`;
- The meta-audit becomes: every posed `check` must carry a parseable
  formula — checked at pose time, never at runtime;
- New dependency: `i18next` (runtime) + `i18next-parser` (dev). This is
  on the escalation list (new dependencies) — human-approved in session;
- The existing `VOCABULARY` bilingual table in `messages.ts` stays for
  kernel diagnostic codes (they are identifiers, not prose); the new
  i18next catalogs cover the formalisms' prose messages;
- `npm run i18n:extract` regenerates catalogs; `npm run i18n:check`
  guards the build.

## Future improvements

- Migrate the tutorial formalisms' comments to English;
- Consider migrating `VOCABULARY` entries to i18next catalogs for a
  single translation mechanism.
