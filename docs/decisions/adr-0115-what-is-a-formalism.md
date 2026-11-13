# ADR-0115: What is a formalism?

- Status: proposed
- Date: 2026-11-12
- Issue: #137

## Context

The workshop manipulates **layers** (`.ld` files): the read-only kernel
(`formalisms/kernel/`, 85+ layers, ADR-0103) and the visitors' quarry
(`formalisms/users/`, PostgreSQL-backed, ADR-0111). A *formalism* is
currently an informal grouping — a directory of layers, as in
`formalisms/tutorial/` where `automaton.ld` refines `@graph` and
aliases its vertices/edges into states/transitions.

Milestones 3 (versioning) and 4 (freeze & publication) need a precise,
single definition of "formalism" to attach names, owners, versions and
frozen status to. Corpus-of-layers aggregation (a formalism as a set
of many layers) is a possible extension but is **explicitly deferred**
here.

## Options considered

1. **A formalism is a directory / a corpus of layers** — rejected for
   now: versioning and freezing a whole corpus raises diamond and
   drift questions (milestone 3) before the single-layer case is
   settled; it also conflicts with the kernel's one-layer-per-file
   granularity.
2. **A formalism is a single versioned layer** — chosen: matches the
   tutorial's usage (`automaton.ld` IS the automaton formalism), gives
   a natural unit for names (`@user/name`), versions (semver per
   layer), and freeze (snapshot of one layer). Aggregation can later
   be expressed as a layer that refines several others.
3. **No definition, keep it informal** — rejected: milestones 3 and 4
   cannot be specified without it.

## Decision

**One formalism = one versioned layer.**

- A formalism is identified by `@user/name` (issue #143); the kernel
  layers are the built-in formalisms owned by the system.
- Each formalism carries a status (`draft` by default, issue #144),
  an owner (ADR-0114), and — once published — a semver version
  assigned by the workshop (ADR-0116).
- A formalism that aggregates several layers is expressed as a layer
  whose `refines` closure covers them; the aggregation itself is not a
  separate entity. This keeps one concept (the layer) as the only
  first-class object.

## Consequences

- Milestone 3 (versioning) and milestone 4 (freeze) operate on single
  layers; no corpus-level versioning machinery is needed now.
- The tutorial's `formalisms/tutorial/*.ld` files are already
  formalisms under this definition — no migration.
- If a future need requires corpus-level identity (a named bundle of
  layers with its own version), it will be a new ADR refining this
  one, not a silent change.
