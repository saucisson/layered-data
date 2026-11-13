# ADR-0103 addendum: unify bedrock and frozen formalisms

- Status: proposed
- Date: 2026-11-13
- Issue: #158
- Amends: ADR-0103 (immutable trunk), ADR-0116 (formalism versioning)

## Context

The kernel (bedrock) is read-only by protocol (ADR-0103); user
formalisms become immutable once frozen (ADR-0116, issue #157). Two
mechanisms, one concept: an immutable, versioned formalism. The
verdict families differ (`socle-édité` vs `formalism-frozen`) but the
semantics are the same — a frozen formalism is a bedrock for its
dependents.

## Decision

Treat the kernel as a set of built-in frozen formalisms:

- The kernel layers are conceptually frozen at their shipped version;
  they are readable and refinable forever, never writable (unchanged
  behavior — ADR-0103's protocol guard stays).
- A user formalism frozen at version `v` has the same guarantees as a
  kernel layer: immutable, readable, refinable. The freeze route
  (issue #155) is the user-side equivalent of the kernel's build-time
  freeze.
- One verdict family: writes to any frozen formalism (kernel or user)
  are refused with a pointer to the way out — for the kernel, there is
  no way out (it is the trunk); for a user formalism, fork into the
  next version (issue #157).

## Consequences

- The staging and the server can share one predicate
  `isFrozen(name)`: kernel names are always frozen; user names are
  frozen when a row exists in `formalism_versions` with
  `status = 'frozen'`.
- The UI can render kernel layers and frozen user formalisms with the
  same badge family (the status badge of issue #145).
