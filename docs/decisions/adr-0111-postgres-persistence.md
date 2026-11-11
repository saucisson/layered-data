# ADR-0111: PostgreSQL persistence for user layers and the editor session

- Status: accepted (human owner, 2026-11-11 — issue #109 comments)
- Date: 2026-11-11

## Context

The server stores on disk: the visitors' layers in
`formalisms/users/*.ld` and the shared editor session in
`data/editor-session.json` (ADR-0110). But the server is meant to run
as **several instances behind a proxy** (decision taken on #85, where
the rate-limit counters already moved to PostgreSQL): disk storage
cannot be shared, two instances would not see each other's writes.
The human decided on #109: **PostgreSQL** for the visitors' layers
and the editor session. `DATABASE_URL` already exists
(`server/config.ts`, delivered with #85), and #110 delivers the
`docker compose` stack (atelier + postgres + schema init).

The schema below is the one the human owner accepted in the issue
comments (2026-11-11).

## Decision

### Schema

```sql
-- the visitors' layers (was formalisms/users/*.ld)
CREATE TABLE IF NOT EXISTS user_layers (
  name TEXT PRIMARY KEY,
  source TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- the editor session snapshot (was data/editor-session.json):
-- ONE row, the current versioned state (ADR-0110)
CREATE TABLE IF NOT EXISTS editor_session (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  version BIGINT NOT NULL,
  state JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- the session journal: one row per accepted version, so undo/redo
-- survives a reload. Retention: the last EDITOR_SESSION_HISTORY_DEPTH
-- versions (default 200), trimmed on every write.
CREATE TABLE IF NOT EXISTS editor_session_events (
  version BIGINT PRIMARY KEY,
  state JSONB NOT NULL,
  at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

The tables are created twice, deliberately: by
`docker-entrypoint-initdb.d/` at the first start of the data volume
(#110), and by `CREATE TABLE IF NOT EXISTS` at store init — a server
booting against an existing database never depends on the init script.

### Store selection and boot

- `DATABASE_URL` set → PostgreSQL stores; unset → the current disk
  behavior, unchanged (dev, tests, `LD_USERS_DIRECTORY`).
- `DATABASE_URL` set but the database unreachable at boot → **fail
  fast**: the process stops with a typed error. No disk fallback —
  two instances on two truths (disk vs base) is exactly the split-brain
  this ADR removes.

### Abstraction

`UserLayerStore` (list / read / write / delete) and
`EditorSessionStore` (load / save / history) are interfaces with two
implementations each: disk (dev/tests) and PostgreSQL (production).
`GET/PUT/DELETE /api/layers`, the compatibility `api/formalismes`,
the geologist's prompt context and the editor session routes all go
through the selected store.

### Editor session semantics in PostgreSQL

- Every accepted gesture (or restore) upserts the snapshot row and
  appends one journal row, in one transaction; the journal is then
  trimmed to the last `EDITOR_SESSION_HISTORY_DEPTH` versions.
- `GET /api/editor/history` reads the journal; `POST
  /api/editor/restore { version, baseVersion }` re-stages the target
  version's additions over a fresh bedrock (the same tribunal as any
  gesture) and, if accepted, becomes the new current version —
  undo/redo therefore works even after a reload.
- Optimistic locking is unchanged (ADR-0110): the `version` column is
  the `baseVersion` the clients carry; a stale one is a 409 conflict.

### Migration

`scripts/migrate-to-postgres.mts` (run once with `DATABASE_URL` set)
upserts `formalisms/users/*.ld` and `data/editor-session.json` into
PostgreSQL. It is idempotent and **keeps the disk files** — they stay
the dev/test store and a non-destructive backup.

### Tests

Integration tests with a real PostgreSQL (`tests/postgres-store-checks.mts`)
run **locally** only: without `DATABASE_URL` they skip and CI stays
green.

## Consequences

- Multi-instance deployment behind a proxy becomes possible: layers,
  session and rate-limit counters all live in one PostgreSQL.
- Without `DATABASE_URL` nothing changes: same disk files, same
  behavior, `npm run verify` green.
- The disk files are never deleted by the server; removing them after
  a verified migration is a human operation.

## Implementation

Delivered in two stacked pull requests on issue #109:

1. the visitors' layer store (`user_layers`), the schema init, the
   layer migration and the layer integration tests;
2. the editor session store (`editor_session` + journal), the
   history/restore routes, the session migration and the SSE
   integration tests.
