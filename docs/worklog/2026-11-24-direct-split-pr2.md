# chore(history): second 100-commit slice of daily for the rebase-only merge (PR #2)

- Date: 2026-11-24
- Type: hotfix
- Scope: branch `daily` history (cut at fbeb6d3 + this entry = 100 commits on top of main 606be49)
- Motive: PR #381 (first 100-commit slice) was merged into main by the human
  (rebase strategy, merge_commit 606be49). The remaining 212 commits of the
  original daily (preserved on `backup/daily-full-pre-split`, b23afae) were
  rebased onto the new main; GitHub refuses rebase-merge beyond ~100 commits
  (rebaseable=false at 101+, probed on #382-#396), so daily is cut again to
  100 commits for PR #2. The remaining 112 commits stay on the backup branch
  for subsequent PRs.
- Evidence: `git rev-list --count origin/main..daily` = 100 after this entry;
  PR #2 rebaseable re-checked via API after push.
- Known limits: slices are mid-history cuts; content identical to backup branch at the cut points.
