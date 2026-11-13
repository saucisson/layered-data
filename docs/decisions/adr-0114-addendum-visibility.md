# ADR-0114 addendum: cross-user visibility and sharing

- Status: proposed
- Date: 2026-11-12
- Issue: #146
- Amends: ADR-0114 (user accounts and optional identity)

## Context

With per-user ownership (issue #139) and per-user scoping (issue #140),
each user's layers are private by default. But formalisms are meant to
be shared: a user should be able to reference another user's published
formalism (prerequisite for milestone 3 pinning, `@user/name`).

## Decision

### Visibility column

```sql
ALTER TABLE user_layers
  ADD COLUMN IF NOT EXISTS visibility TEXT NOT NULL DEFAULT 'private'
  CHECK (visibility IN ('private', 'public'));
```

- **Default: `private`** — a layer is invisible to other users unless
  its owner explicitly publishes it. This is the safe default: nothing
  leaks by accident.
- `public` makes the layer readable by any authenticated user (shared
  code included), but **never writable** — only the owner can modify
  or delete their layers.

### Read rules

- `GET /api/layers` lists: the kernel layers + the caller's own layers
  (any visibility) + other users' `public` layers.
- `GET /api/layers/:name` resolves: the caller's own layer first,
  then any `public` layer, then the kernel. A `private` layer of
  another user is a 404 (not a 403 — existence is not leaked).

### Write rules

- `PUT /api/layers/:name` only writes to the caller's own layers.
  A `public` layer of another user is read-only: PUT returns 403.
- `POST /api/layers/:name/publish` (owner only) flips visibility
  private → public. Unpublish (public → private) is a separate
  verb for a later issue.

## Consequences

- Referencing another user's formalism (`@alice/petri`) works when
  `petri` is `public` — the prerequisite for milestone 3.
- The default-private stance means existing deployments see no
  behavior change until an owner explicitly publishes.
