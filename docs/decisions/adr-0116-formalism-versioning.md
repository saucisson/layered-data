# ADR-0116: Formalism versioning policy

- Status: proposed
- Date: 2026-11-12
- Issue: #147 (blocker)

## Context

Formalisms are single versioned layers (ADR-0115). The workshop must
assign a semantic version to each published (frozen) version, resolve
`refines` references across users and majors, and police the assembly
when a dependency moves. Today there is **no versioning** of visitors'
layers and **no freeze** outside the kernel (ADR-0103). The five
rules below were arbitrated by the human owner and are captured here
as the normative policy; implementation issues are #148–#154.

## Decision

### Rule 1 — The workshop assigns the level, never the author

At each publication of a new version, the workshop inspects the diff
between the previous frozen version and the candidate:

- **PATCH** — no semantic difference (comments, formatting, reordering
  with identical meaning).
- **MINOR** — pure additions: new keys, new aliases; no existing key
  modified or removed; no first provider displaced.
- **MAJOR** — everything else: any removal, any modification, any
  displacement of a first provider.

The author never declares a version number; the classifier computes
it (issue #149).

### Rule 2 — `refines` pins the major

- `refines @alice/petri@2` pins major 2 of `@alice/petri`.
- The bare name `@alice/petri` resolves to the **latest frozen
  version of the latest major**.
- **Drafts never resolve**: a draft is private and cannot be refined
  by anyone (issue #144).

### Rule 3 — Single major per formalism name per closure

The transitive closure of an assembly must contain **at most one
major per formalism name**. A diamond with divergent majors (A refines
`@x/f@1`, B refines `@x/f@2`, C refines both A and B) is a
`version-conflict` verdict with a diagnostic naming the formalism, the
conflicting versions, and both diamond paths. Minor divergence within
one major never conflicts: it resolves to the latest frozen version of
that major. This mirrors Maven's dependency-convergence rule: the key
space is global, there is no per-module isolation (issue #151).

### Rule 4 — Drift policing at assembly

Each frozen version records the fingerprint of its certified DATA/OUT
dump. If a minor lift of a dependency changes the measured dump of a
host assembly (e.g. a namespace collision displacing a first
provider), the assembly emits a **drift verdict** and requires
explicit re-certification of the dependent. Never a silent behavior
change (issue #152).

### Rule 5 — Only frozen versions are refinable; acyclicity on majors

`refines` may only target a **frozen** version. The graph of majors
(one node per (name, major), edges from `refines` pins) must be
acyclic; a cycle is a staging verdict at the desugaring gate
(spec §8, issue #150).

## Consequences

- Version numbers are computed, so authors cannot "choose" a major to
  force or avoid a conflict; conflicts are structural and diagnosed.
- Bare-name resolution is stable within a major and moves only when a
  new major is frozen — the classic semver major boundary.
- The classifier (rule 1) is safety-critical and gets a dedicated
  mutation/coverage gate (issue #162).
- The re-pin harness (issue #153) quantifies, per dependent, the
  observational impact of changing a pinned major, enabling one-click
  re-pin suggestions (issue #154).
