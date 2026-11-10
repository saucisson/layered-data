# ADR-0110: A shared editor session — SSE state, judged gestures, optimistic locking

- Status: proposed (awaiting the human owner's acceptance)
- Date: 2026-11-09

## Context

ADR-0107 gave the workshop a graphical model editor, but it lives
alone in the browser: the living additions (the models being edited)
exist only in the tab's memory, and two editors on two machines never
see each other. The server (`server.ts`) already persists layers in
the disk quarry (`formalisms/users/`) and already runs the staging
server-side for the geologist loop — the tribunal exists on both
sides. What is missing is a shared, versioned state of the editor's
living additions, with the same judgment applied to every write.

Constraints carried over: no new dependency (the escalation list
forbids adding one unilaterally) — the transport is plain node `http`
with Server-Sent Events; the access code keeps travelling in the
`x-access-code` header (which is why the client reads the SSE stream
over `fetch`, not `EventSource`); the bedrock stays read-only
(ADR-0103); the workshop still works with no server at all.

## Decision

The server keeps ONE versioned state — the editor session — and is
the single writer of it:

- **State**: `{ version, additions: [{ name, source }] }`, persisted
  as JSON in `data/editor-session.json` (gitignored, reloaded at
  boot). An addition is one layer's complete source block.
- **Transport**: `GET /api/editor/session` is an SSE stream — `hello`
  (client id), then `state` (full snapshot + presence) on connect and
  after every accepted gesture; `presence` events carry who is
  online and which model each editor has focused
  (`POST /api/editor/presence`). A 25 s `: ping` heartbeat keeps the
  stream open through proxies.
- **The gesture**: `POST /api/editor/gesture { source, baseVersion }`.
  The source is the drafted layer block(s) — exactly what the editor
  drafts locally. The server re-stages EVERY candidate addition in
  order over a freshly assembled bedrock (the deterministic replay of
  their acceptance, the same `stageLayerAddition`/`applyStagedAddition`
  the browser runs): any verdict anywhere refuses the gesture with 422
  and the version does not move. A stale `baseVersion` is a 409
  conflict carrying the current snapshot. On acceptance the version
  increments, the state is persisted and broadcast (200).
- **The client** (`src/infrastructure/editorSync.ts`) applies gestures
  locally first (the canvas answers at once), then sends them; on every
  `state` event it re-materializes — a fresh kernel assembly plus the
  server's additions — so the server's snapshot is the local truth and
  a conflict heals itself. When the stream is absent (dev server, no
  access code, server down) the editor stays local: the badge in the
  header says which mode is active.

The pure session logic lives in the application layer
(`src/application/editorSession.ts`, covered by
`tests/editor-session-checks.mts`); `server.ts` only wires it to
HTTP/SSE and to the JSON file.

## Options considered

- **WebSocket / socket.io**: rejected — a new dependency, and SSE over
  plain `http` covers the server→client direction; the client→server
  direction is plain POST.
- **Persisting each accepted layer as a quarry `.ld` file**: rejected
  for the session — the quarry is the durable, curated path; the
  session is living workshop state, kept in its own JSON file.
- **Client-authoritative merge (CRDT)**: rejected — the staging is the
  tribunal, and only a single writer can convene it; optimistic
  locking (baseVersion CAS) plus re-sync on conflict is the honest
  protocol at workshop scale.
- **EventSource for the stream**: rejected — it cannot carry the
  `x-access-code` header; the client parses SSE over `fetch`.

## Consequences

- Two editors never diverge silently: the second write on a stale
  version gets a 409, the client reloads the shared state and the
  banner says to replay the gesture.
- The undo journal stays local (per tab); the shared state is the
  source of truth for the additions, not for the undo history.
- Presence is transport-level (connected streams + focus), not a
  persisted roster.
