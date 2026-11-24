# fix(codeql): silence 3 of the 4 new code-scanning alerts on PR #379

- Date: 2026-11-24
- Type: hotfix
- Scope: `src/presentation/modelEditorPage.tsx`, `tests/model-editor-checks.mts`, `tests/auth-flow-checks.mts`
- Motive: the end-of-day PR #379 (daily -> main) fails the "CodeQL" check on 4
  new alerts. Three are fixable in code: a tainted `lens` value reaching an
  `<a href>` (now guarded against the known lens list), an incomplete regex
  escape (backslash missing from the escaped class in a test), and an open
  redirect in the fake IdP of the auth-flow test (now restricted to same-site
  relative paths, mirroring the quarry's `safeReturnTo`). The 4th alert
  (`js/clear-text-storage-of-sensitive-information` on the localStorage write
  of the personal Mistral token) is by design per ADR-0120 §3 and needs a
  human dismissal in the Security tab.
- Evidence: `npm run test:model-editor`, `npm run test:auth-flow`, `npm run lint`,
  `npm run typecheck` — see commit body / CI on PR #379.
- Known limits: the localStorage alert remains until dismissed as
  false-positive/by-design by the human.
