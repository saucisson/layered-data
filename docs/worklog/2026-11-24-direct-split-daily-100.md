# chore(history): split daily at 100 commits for the rebase-only merge into main

- Date: 2026-11-24
- Type: hotfix
- Scope: branch `daily` history (tree at the cut point, no content change beyond the cut)
- Motive: GitHub refuses "Rebase and merge" for PRs with more than ~100 commits
  (probed empirically: 100 commits -> rebaseable=true, 101 -> rebaseable=false,
  regardless of content). PR #381 (daily -> main, rebase-only strategy) had 311
  commits and showed "This branch cannot be rebased due to conflicts"
  (rebaseable=false) although mergeable=true and merge-tree is conflict-free.
  Per the human's decision: `daily` is cut to 100 commits (99 + this worklog
  entry) so the PR is validatable; ALL 311 commits are preserved on branch
  `backup/daily-full-pre-split` (b23afae) and will return to `daily` for a
  second PR after the first merge.
- Evidence: probe PRs #382-#396 (closed) mapping rebaseable vs commit count;
  `git rev-list --count origin/main..daily` = 100 after the cut.
- Known limits: the cut point (d8dbce9, "feat(ui): loading states...") is mid-history;
  commits after it (including the CodeQL fixes) live on the backup branch until PR #2.
