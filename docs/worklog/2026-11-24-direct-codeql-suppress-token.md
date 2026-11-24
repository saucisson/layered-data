# fix(codeql): inline-suppress the localStorage alert on the Mistral token (PR #379)

- Date: 2026-11-24
- Type: hotfix
- Scope: `src/infrastructure/mistralToken.ts`
- Motive: 4th code-scanning alert on PR #379 (`js/clear-text-storage-of-sensitive-information`)
  targets the `localStorage.setItem` of the personal Mistral token. Browser-side
  storage is the design accepted in ADR-0120 §3 (token never in a URL, never
  logged, sent only as the `x-mistral-api-token` header), so the alert is a
  false positive. Human chose (in session) to exclude the query for this path;
  implemented as a line-scoped `codeql[...]` suppression comment rather than a
  global `codeql-config.yml` exclusion, to avoid weakening the query repo-wide.
- Evidence: CI on PR #379 after push; `npm run verify` locally.
- Known limits: none — suppression is scoped to the single setItem line.
