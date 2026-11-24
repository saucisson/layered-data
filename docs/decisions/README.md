# Architecture Decision Records

An ADR records **why** a choice was made, so it can be revisited later
with the original reasoning in hand - not to freeze it.

## Process (MADR-lite)

Each ADR is one file, `adr-NNNN-short-name.md`, containing:

- **Status**: `accepted` (or `superseded by adr-NNNN`).
- **Date**: the decision date.
- **Context**: the forces at play.
- **Options considered**: with explicit trade-offs, including the
  rejected ones and why.
- **Decision**: the chosen option.
- **Consequences**: including the negatives - every decision has some.

## Rules

- Accepted ADRs are **never edited**. A reversal is a new ADR that
  references and supersedes the old one. Owner-set exceptions are
  recorded here: stale references follow the code, so projects
  instantiated from the template never inherit dead paths.
- Superseded ADRs are removed from the repository; ADR numbers are
  never reused.
- **Numbering**: ADR numbers `0001`-`0099` are reserved for the
  template's own decisions (currently 0001-0007). A project
  instantiated from this template numbers its own, project-specific
  ADRs from `0100` upward, so a template update can add new template
  ADRs without ever colliding with the project's.
- ADRs are constitutional files: agents may **draft** a new ADR inside
  a pull request, but only the human owner accepts it. Draft status is
  explicit at the top of the file.
- "ADR-worthy" changes are on the strict escalation list
  (`docs/protocol.md`).
- The ADRs are **language- and tool-agnostic**: they record the ideas.
  The concrete tools of an instance (its language, linter, type
  checker, test runner) apply the ideas; the template's own Python
  tools are the worked example.

## Index

The template's decisions were condensed on 2026-11-13 (by the owner)
from twenty-two single-topic ADRs into seven thematic ones; each file
lists the former numbers it merges, and no decision was dropped.

| ADR      | Decision                                                      |
| -------- | ------------------------------------------------------------- |
| [0001](adr-0001-toolchain-and-tooling.md) | Toolchain and repository tooling: stable standards, committed lockfile, delegated maintenance, one CLI driver package |
| [0002](adr-0002-architecture-and-style.md) | Onion data-first architecture; data and functions over OOP; readability-first style |
| [0003](adr-0003-typing-logging-and-apis.md) | Precise typing with one reference checker; structured logging as executable comments; REST with best practices |
| [0004](adr-0004-quality-and-security-gates.md) | Quality gates, security gates, anti-complacency tests |
| [0005](adr-0005-branch-model-and-worklog.md) | Branch model main/daily/work; criteria-checked merge, body-update and sync drivers; per-record worklog |
| [0006](adr-0006-agent-protocol.md) | Two-agent protocol with isolated local review, budgets, contact channel, runtime permissions, active CI wait |
| [0007](adr-0007-unattended-loop.md) | Unattended loop: one fresh headless session per item, claims first, recovery, anti-spin |

## Project ADRs (this instance)

| Number | Title | Status | Date |
| ------ | ----- | ------ | ---- |
| [ADR-0010](adr-0010-branch-model.md) | Branch model - main/daily/work with codified autonomous merges | accepted | 2026-11-02 |
| [ADR-0011](adr-0011-agent-protocol.md) | Agent protocol - developer and reviewer roles | accepted | 2026-11-02 |
| [ADR-0016](adr-0016-reviewer-launch-mechanics.md) | Reviewer launch mechanics - CI job as status check | accepted | 2026-11-02 |
| [ADR-0117](adr-0117-reviewer-launched-by-developer-agent.md) | Reviewer launch mechanics - developer agent launches the reviewer in parallel with CI (amends ADR-0016) | proposed | 2026-11-13 |
| [ADR-0100](adr-0100-order-as-semantics.md) | Order as semantics - first-wins conflicts made visible, signable, contractual | accepted | 2026-11-04 |
| [ADR-0101](adr-0101-checks-as-contracts.md) | Checks as contracts - the constraint semantics made nominal, visible, executable | accepted | 2026-11-04 |
| [ADR-0102](adr-0102-registry-as-data.md) | Registry as data - the meta-model comes home: the checks' contracts written in the language | accepted | 2026-11-05 |
| [ADR-0103](adr-0103-immutable-trunk.md) | The immutable trunk - read-only by protocol, not by convention: every mutation route carries the trunk's signature | accepted | 2026-11-05 |
| [ADR-0104](adr-0104-mythologie.md) | The vocabulary's treaty - three strata, one story: informatics words stay, the language's words are marked code, the story lives in the geologist's field | superseded (by ADR-0113) | 2026-11-05 |
| [ADR-0105](adr-0105-checks-as-couples.md) | Checks as couples - the constraint's behavior written in the language, judged by the reading machine | accepted | 2026-11-05 |
| [ADR-0106](adr-0106-two-regime-algebra.md) | The two-regime algebra - mask and assume retire, the guarantees become theorems | accepted | 2026-11-05 |
| [ADR-0024](adr-0024-daily-integration-sync.md) | daily integrates main through a sync driver (`make sync-daily`) | proposed | 2026-11-08 |
| [ADR-0025](adr-0025-scripts-cli-package.md) | Driver commands: one CLI package with subcommands, make/npm stay the agent surface | proposed | 2026-11-08 |
| [ADR-0107](adr-0107-graphical-model-editor.md) | A graphical model editor, generic by formalism data | proposed | 2026-11-09 |
| [ADR-0108](adr-0108-streamed-validation.md) | Streamed validation - chunked generator + event-loop pacing, synchronous drain kept as the API | accepted | 2026-11-09 |
| [ADR-0109](adr-0109-inline-checks-english-formalisms.md) | Inline checks, English-first formalisms, i18next for translations | proposed | 2026-11-09 |
| [ADR-0110](adr-0110-shared-editor-session.md) | A shared editor session - SSE state, judged gestures, optimistic locking | proposed | 2026-11-09 |
| [ADR-0111](adr-0111-postgres-persistence.md) | PostgreSQL persistence for user layers and the editor session | accepted | 2026-11-11 |
| [ADR-0112](adr-0112-retire-audit-treaty.md) | Retiring the audit treaty - the executable specification is the contract | accepted | 2026-11-12 |
| [ADR-0113](adr-0113-one-tongue.md) | One tongue for now - English-only content, the translation system is kept | accepted | 2026-11-12 |
