# ADR-0016: Reviewer launch mechanics - CI job as status check

- Status: accepted
- Date: 2024-11-04

## Context

ADR-0011 establishes the reviewer agent role, but we need a mechanism to:
- Launch the reviewer automatically on PR changes
- Make the review result a hard requirement for merging
- Ensure the reviewer's isolation from the developer
- Provide feedback to the developer

## Options considered

- **GitHub CI job** (chosen): Launch as a workflow on PR push events.
  The job's exit code becomes a required status check.
- **GitHub App**: More complex, requires app registration.
- **Webhook service**: External service listening for PR events.
- **Manual trigger**: Developer manually requests review.

## Decision

The reviewer agent runs as a **GitHub Actions workflow job**
(` .github/workflows/review.yml`) triggered by:
- `pull_request` events: `opened`, `synchronize`, `reopened`

The workflow:
1. Checks out the PR diff
2. Builds a review bundle (spec, diff, rules)
3. Executes the reviewer agent (model call)
4. Posts review findings as a PR comment
5. Sets exit code based on findings:
   - `0` - zero BLOCKING findings (check passes)
   - `1` - at least one BLOCKING finding (check fails)
   - `2` - protocol failure (check fails)

The `reviewer` status check is added to branch protection rules for
`main` and `daily`, making it a required check for auto-merge.

## Consequences

- Review is automatic - no manual intervention needed.
- Review is mandatory - cannot be bypassed.
- Review is isolated - the bundle contains only permitted context.
- Review is auditable - PR comments record all findings.
- Negative: Requires GitHub Actions access and API key for model calls
  (in production). For now, the workflow includes a simulation.

## Future improvements

- Support for different reviewer models (different model family from
  developer)
- Caching of review results for unchanged code
- Integration with other CI systems (GitLab CI)
