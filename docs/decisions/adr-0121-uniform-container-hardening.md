# ADR-0121: Uniform container hardening for the deployed sites

- Status: accepted (human decision in session, 2026-11-27, recorded with
  the hardening branch)
- Date: 2026-11-27
- Related: ADR-0111 (PostgreSQL stores, fail-fast), issue #242 (VPS
  deployment), docs/deployment.md

## Context

The three saucisson sites (layered-data, lisage, petrichor) run on the
same VPS behind nginx. The uniform rule of 2026-11-27: they obey the
same container rules, and a deployed service is hardened the same way
everywhere. The atelier container ran as root with every capability: a
compromise of the node process was root inside the container, one step
from the mounted volumes, the compose network and the deploy user's
files.

## Decision

The production `atelier` service is hardened, as an invariant of every
deployed site:

- **non-root**: the runtime image executes the unprivileged `node`
  user (uid 1000) shipped by `node:22-alpine`;
- **read-only root filesystem**, with `/tmp` as the only tmpfs — in
  production every write lives in PostgreSQL (ADR-0111), the container
  writes nothing of its own;
- **`cap_drop: ALL`** — the server binds 8791 (> 1024) and touches no
  syscall that needs a capability;
- **`no-new-privileges`** — no child gains privileges.

`postgres` keeps its stock image: the official entrypoint initializes
by `chown`-ing the data volume as root before dropping to its own
unprivileged user, so it needs its capabilities; it only listens on
the compose network, never on the host. The invariant is the app
service's, which the site owns end to end.

## Consequences

- The two `mkdirSync` of the boot (`server/config.ts`:
  `formalisms/users` and `data/`) only need the directories to exist;
  the runtime image pre-creates both with `node` ownership, so the
  boot needs no write access to the root filesystem.
- The disk fallback (no `DATABASE_URL`, dev) still works in a fresh
  container: both directories belong to `node`. On the VPS the
  pre-existing `atelier-data` volume was created by the former root
  container and stays root-owned — irrelevant while `DATABASE_URL` is
  set (production), and a fail-fast boot error (ADR-0111) if it ever
  were not: no silent split-brain.
- The dev override inherits the hardening and resets only
  `cap_drop` (docker-compose.dev.yml, compose v2.24+): the dev
  container runs as root on the bind-mounted repository, and a root
  without capabilities cannot write the host's files.
- A regression that makes the server write outside PostgreSQL or the
  mounts now fails loudly at runtime instead of silently succeeding.
