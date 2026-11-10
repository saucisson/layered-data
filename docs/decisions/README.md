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
| [ADR-0100](adr-0100-order-as-semantics.md) | Order as semantics - first-wins conflicts made visible, signable, contractual | accepted | 2026-11-04 |
| [ADR-0101](adr-0101-checks-as-contracts.md) | Checks as contracts - the constraint semantics made nominal, visible, executable | accepted | 2026-11-04 |
| [ADR-0102](adr-0102-registry-as-data.md) | Registry as data - the meta-model comes home: the checks' contracts written in the language | accepted | 2026-11-05 |
| [ADR-0103](adr-0103-immutable-trunk.md) | The immutable trunk - read-only by protocol, not by convention: every mutation route carries the trunk's signature | accepted | 2026-11-05 |
| [ADR-0104](adr-0104-mythologie.md) | The vocabulary's treaty - three strata, one story: informatics words stay, the language's words are marked code, the story lives in the geologist's field | accepted | 2026-11-05 |
| [ADR-0105](adr-0105-checks-as-couples.md) | Checks as couples - the constraint's behavior written in the language, judged by the reading machine | accepted | 2026-11-05 |
| [ADR-0106](adr-0106-two-regime-algebra.md) | The two-regime algebra - mask and assume retire, the guarantees become theorems | accepted | 2026-11-05 |
| [ADR-0024](adr-0024-daily-integration-sync.md) | daily integrates main through a sync driver (`make sync-daily`) | proposed | 2026-11-08 |
| [ADR-0025](adr-0025-scripts-cli-package.md) | Driver commands: one CLI package with subcommands, make/npm stay the agent surface | proposed | 2026-11-08 |
| [ADR-0107](adr-0107-graphical-model-editor.md) | A graphical model editor, generic by formalism data | proposed | 2026-11-09 |
| [ADR-0108](adr-0108-streamed-validation.md) | Streamed validation - chunked generator + event-loop pacing, synchronous drain kept as the API | accepted | 2026-11-09 |
| [ADR-0109](adr-0109-inline-checks-english-formalisms.md) | Inline checks, English-first formalisms, i18next for translations | proposed | 2026-11-09 |
| [ADR-0110](adr-0110-shared-editor-session.md) | A shared editor session - SSE state, judged gestures, optimistic locking | proposed | 2026-11-09 |

Numbers ADR-0000 to ADR-0099 are reserved for the project template (agent
protocol, branching, CI mechanics). ADRs specific to layered-data start at
ADR-0100.

## Adding a new ADR

1. Check the existing ADRs to ensure the decision hasn't already been recorded
2. Use the next available number (template ADRs: 00XX; layered-data ADRs: 01XX and up)
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
