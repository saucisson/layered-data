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
| [ADR-0017](adr-0017-order-as-semantics.md) | Order as semantics - first-wins conflicts made visible, signable, contractual | accepted | 2026-11-04 |
| [ADR-0018](adr-0018-checks-as-contracts.md) | Checks as contracts - the constraint semantics made nominal, visible, executable | accepted | 2026-11-04 |
| [ADR-0019](adr-0019-registry-as-data.md) | Registry as data - the meta-model comes home: the checks' contracts written in the language | accepted | 2026-11-05 |
| [ADR-0020](adr-0020-immutable-trunk.md) | The immutable trunk - read-only by protocol, not by convention: every mutation route carries the trunk's signature | accepted | 2026-11-05 |
| [ADR-0021](adr-0021-mythologie.md) | The vocabulary's treaty - three strata, one story: informatics words stay, the language's words are marked code, the story lives in the geologist's field | accepted | 2026-11-05 |
| [ADR-0022](adr-0022-checks-as-couples.md) | Checks as couples - the constraint's behavior written in the language, judged by the reading machine | accepted | 2026-11-05 |
| [ADR-0023](adr-0023-two-regime-algebra.md) | The two-regime algebra - mask and assume retire, the guarantees become theorems | accepted | 2026-11-05 |
| [ADR-0024](adr-0024-daily-integration-sync.md) | daily integrates main through a sync driver (`make sync-daily`) | proposed | 2026-11-08 |
| [ADR-0025](adr-0025-scripts-cli-package.md) | Driver commands: one CLI package with subcommands, make/npm stay the agent surface | proposed | 2026-11-08 |
| [ADR-0026](adr-0026-streamed-validation.md) | Streamed validation - chunked generator + event-loop pacing, synchronous drain kept as the API | proposed | 2026-11-09 |

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
