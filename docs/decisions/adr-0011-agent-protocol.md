# ADR-0011: Agent protocol - developer and reviewer roles

- Status: accepted
- Date: 2024-11-04

## Context

We need a protocol that allows AI agents to contribute to the codebase
while maintaining quality and preventing unchecked changes. The protocol
must ensure:
- Agents don't review their own work
- Agents don't merge their own changes
- Constitutional files require human approval
- Quality gates are mechanically enforced

## Options considered

- **Dual-role system** (chosen): Separate developer and reviewer agents
  with strict isolation between them.
- **Single agent with checks**: One agent does everything but follows
  strict rules - too prone to self-justification.
- **Human-only reviews**: Agents implement, humans review - scales
  poorly with agent autonomy.
- **No agents**: Reject AI assistance entirely - not viable.

## Decision

Two roles:
- **Developer agent**: Implements issues, never reviews, never merges.
  Full contract in `docs/agents/developer.md`.
- **Reviewer agent**: Reviews diffs with isolated context, seeking
  counterexamples. Never modifies code, never merges. Full contract
  in `docs/agents/reviewer.md`.

Isolation principle: The reviewer agent has access only to:
- The pull request specification (description with acceptance criteria)
- The pull request diff
- Constitutional documents (`docs/architecture.md`, `docs/review-checklist.md`, ADRs)

The reviewer is forbidden from consuming the developer's reasoning or
session transcripts.

## Consequences

- True code review isolation - the reviewer judges the diff against
  rules, not the author's intent.
- Clear separation of concerns - developers create, reviewers verify.
- Scalable - multiple developer agents can work in parallel.
- Requires tooling - the reviewer needs to be launched as a CI job
  (ADR-0016).
- Negative: More complex than a single-agent system.
