# Architecture Decision Records (ADRs)

This directory contains the Architecture Decision Records for saucisson/layered-data.

## What is an ADR?

An ADR is a short document that captures an important architectural decision
made in the project. The purpose is to provide context and reasoning for
decisions that affect the codebase structure, technology choices, or development
process.

## ADR Process

1. **Identify the need**: A decision is worth an ADR if a future developer
   might ask "why did we do it this way?"
2. **Draft the ADR**: Create a new file `adr-XXXX-description.md` where XXXX
   is the next available number
3. **Get approval**: Label the PR with `needs-human` for human review
4. **Accept**: Once accepted, the ADR becomes part of the project's constitutional
   documentation

## ADR Format

Each ADR follows this template:

```markdown
# ADR-XXXX: Title

- Status: accepted/proposed/superseded/deprecated
- Date: YYYY-MM-DD

## Context

The problem being addressed.

## Options considered

- **Option 1** (chosen): description
- **Option 2**: description
- **Option 3**: description

## Decision

What was chosen and why.

## Consequences

What this decision implies - good and bad.
```

## Existing ADRs

| Number | Title | Status | Date |
| ------ | ----- | ------ | ---- |
| [ADR-0010](adr-0010-branch-model.md) | Branch model - main/daily/work with codified autonomous merges | accepted | 2026-11-02 |
| [ADR-0011](adr-0011-agent-protocol.md) | Agent protocol - developer and reviewer roles | accepted | 2026-11-02 |
| [ADR-0016](adr-0016-reviewer-launch-mechanics.md) | Reviewer launch mechanics - CI job as status check | accepted | 2026-11-02 |

## Adding a new ADR

1. Check the existing ADRs to ensure the decision hasn't already been recorded
2. Use the next available number (e.g., if the last is ADR-0016, use ADR-0017)
3. Follow the format above
4. Place the file in this directory
5. Update this README's table
6. Submit a PR with `needs-human` label

## Modifying an ADR

ADRs are constitutional files - they can only be modified by humans.
Any change to an ADR requires:

1. A new ADR explaining why the change is needed
2. Human approval via `needs-human` label
3. Explicit acceptance by the project owner

See `docs/agents/escalation.md` for the escalation protocol.
