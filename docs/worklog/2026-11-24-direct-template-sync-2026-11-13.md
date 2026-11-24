# feat: sync with saucisson/project-template (2026-11-13), patches 01-05

- Date: 2026-11-24
- Type: hotfix (template sync)
- Scope: constitutional docs restructured per template commit f9190bb
- Motive: apply the template's latest changes (post 2026-11-12 sync 51acf36).
  Human owner explicitly validated "sync complet du patch 01-05" in session
  on 2026-11-24 (constitutional files are on the escalation list; the
  structured question was asked and answered in session).
- Applied: patch 01 (docs/agents/*, architecture.md, branching.md,
  review-checklist.md consolidated into docs/protocol.md + docs/rules.md;
  AGENTS.md rewritten to the template's post-patch version), patch 02
  (template ADRs 0001-0007 condensed; our project ADRs 0010+/0100+ kept and
  indexed under "Project ADRs" in docs/decisions/README.md), patch 03
  (English rule, carried by the new AGENTS.md).
- Not applied (documented exceptions, as in the 2026-11-12 sync): patches
  04-05 template python tooling (scripts/, tools/, pyproject.toml,
  .gitlab-ci.yml — not present in this TypeScript instance) and the
  project-branding files README.md / Makefile / .env.example /
  CODEOWNERS / ISSUE_TEMPLATE / mutation.yml keep this project's content.
- References to the removed docs updated to docs/protocol.md / docs/rules.md
  in CONTRIBUTING.md, README.md, scripts/commands/review.mjs,
  .github/ISSUE_TEMPLATE/task.md, .github/workflows/mutation.yml.
- Evidence: `npm run typecheck` + `npm run check:structure` green after the sync.
- Known limits: historical ADR files and CHANGELOG keep their old references
  (ADRs are never edited).
