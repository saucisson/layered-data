# ADR-0114: User accounts and optional identity

- Status: proposed
- Date: 2026-11-12
- Issue: #138

## Context

Today the workshop has **no user accounts**: a single shared access
code travels in the `x-access-code` header
(`server/httpUtils.ts:isAccessGranted`), and `whoami` answers
`porteur-du-code` for everyone (`server/routes.ts:132`). Every visitor
shares one identity, one quarry, one editor session. There is already
a local mode (the workshop runs in the browser without a server, work
kept in local storage), but the server side has no notion of "who".

The product direction (milestone "Users & optional accounts") is real
per-user accounts with ownership of formalisms and layers — but
**accounts must stay optional**: anonymous use remains 100 % local in
the browser, invisible to other users.

## Options considered

1. **Mandatory accounts** — rejected: it breaks the local-first,
   no-server mode that is a core property of the atelier, and it adds
   friction (consent flow, code management) before any value is
   delivered.
2. **Keep the single shared code forever** — rejected: no ownership,
   no per-user scoping of the quarry, no administration; it cannot
   carry milestones 2–4 (namespaces `@user/name`, per-user
   formalisms, versioning).
3. **Optional accounts alongside the shared code** — chosen: the
   shared code keeps working (migrated, not removed), personal
   accounts are created on demand, and anonymous local use is
   untouched.

## Decision

### Schema

```sql
users (
  id            serial primary key,
  display_name  text not null,
  access_code_hash text not null,   -- hashed personal access code
  role          text not null check (role in ('user', 'admin')),
  created_at    timestamptz not null default now()
)
```

### Authentication

- `x-access-code` resolves to **either** the legacy shared code
  **or** a personal access code (looked up by hash in `users`).
- `whoami` returns the user profile (`id`, `display_name`, `role`)
  when the code is personal, `porteur-du-code` when it is the shared
  code, and `anonymous-local` when there is no server at all.
- Roles: `user` (default) and `admin`. Admin-only routes: list users,
  revoke access codes, layer quotas.

### Migration of the shared code

The existing shared access code (env `ACCESS_CODE`) is **kept as a
fallback**: it still grants access and maps to `porteur-du-code`, so
existing deployments and scripts do not break. It is not stored in
`users`; it is a server-level secret, not a user. New deployments are
encouraged to disable it once personal accounts exist.

### Optionality

- **Without account**: all work (formalisms, drafts, frozen versions)
  stays in browser local storage, invisible to other users. No
  server call is required.
- **With account**: the user can publish to the server quarry; on
  login, local work is imported into the remote quarry with explicit
  name-collision handling (never silent overwrite).

## Consequences

- Ownership becomes expressible (`owner` column on `user_layers`,
  issue #139), which gates per-user formalisms (milestone 2).
- Rate limiting moves from per-IP to per-user when authenticated
  (issue #140).
- The consent flow for account creation reuses the existing
  access-code consent UX (issue #141).
- The shared code remains a single point of shared identity until the
  human owner decides to retire it; that retirement is a separate
  decision.
