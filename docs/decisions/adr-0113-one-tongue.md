# ADR-0113: One tongue for now — English-only content, translation system kept

- Status: accepted (human owner, 2026-11-12 — slimming series, PR #132)
- Date: 2026-11-12

## Context

Every user-facing text of the workshop was duplicated in French and
English, and two harnesses policed the parity (the bilingual i18n
checks and the terminology checks). That obligation taxes every change
with a second text to write and two harnesses to keep green, while the
product is English-first. The corpus `.ld` formalisms and
`docs/specification.md` stay in French: their prose is data content
and the specification's normative vocabulary, not UI translation.

## Options considered

1. **Keep the bilingual obligation** — rejected: the cost is paid on
   every text change for a second audience that is not being served
   yet.
2. **Remove the i18n mechanism entirely** — rejected: French would
   then require re-architecture to return; the mechanism is cheap to
   keep and is the product's stated direction.
3. **English-only content, mechanism kept** — chosen: every helper
   tolerates absent French with an English fallback, so French returns
   later by filling catalogs and `fr` fields — pure content, no code
   change.

## Decision

User-facing content is English-only for now:

- `MessageTemplate` becomes `{ en, fr? }`; `renderMessage` renders
  `fr` only when the template carries one, else falls back to `en`.
  `parseText` takes `fr?` and falls back. `VOCABULARY` keeps its
  French keys — they are the kernel's stable codes, not translations —
  with `fr?` labels; `kernelLabel` falls back to `en`.
- `BilingualText` becomes `{ en, fr? }`; `localized` falls back; `say`
  passes through; `bilingualParityOf` requires a non-empty `en` and,
  when `fr` is present, a non-empty `fr` different from `en`.
- The i18next plumbing stays: `initI18n`, `t`, `setI18nLanguage`,
  `SUPPORTED_LANGUAGES = ["en"]` (the header picker renders from
  data). i18next falls back to English for any language.
- All `fr:` content properties are removed from `src/` and
  `server/geologistPrompts.ts`; the French catalog, the French
  tutorial markdown and the terminology harness are deleted.
  `browserLanguage.ts` is unchanged: detecting `fr` is harmless, every
  renderer falls back.

This supersedes the treaty-vocabulary part of ADR-0104 (whose status
line is marked `superseded`; its body is history and untouched).

## Consequences

- Every text change writes one tongue instead of two; the i18n and
  pen-loop harnesses keep checking the mechanism (fallback included),
  weaker in French policing only — no mechanism check is removed.
- Adding a `fr` catalog back (plus `fr` fields) renders French without
  any code change; the language picker grows its second option as
  soon as `SUPPORTED_LANGUAGES` lists it.
- The kernel's French codes (fournit, transparent, attendu-trahi…) stay
  the stable anchors of verdicts and diagnostics in both tongues.
