# fix(history): drop the empty commit a540209 from daily (PR #379 rebaseable)

- Date: 2026-11-24
- Type: hotfix
- Scope: branch `daily` history (no file change — tree SHA identical before/after: 137e76fa83915e334192170d2134be18397575bb)
- Motive: PR #379 (daily -> main) had `rebaseable: false` because commit
  a540209 ("chore(auth): trigger CI on PR head (empty commit, tree unchanged)")
  is empty; with rebase-only merging allowed on main, GitHub refuses the PR
  ("This branch cannot be rebased"). Interactive rebase with the empty commit
  dropped; 311 -> 310 commits; pushed with --force-with-lease (ADR-0024).
- Evidence: `git rebase -i --force-rebase --empty=drop origin/main daily` exit 0;
  `git rev-parse daily^{tree}` unchanged; API `pulls/379` rebaseable re-checked after push.
- Known limits: all commit SHAs after a540209 changed (expected after a rebase).
