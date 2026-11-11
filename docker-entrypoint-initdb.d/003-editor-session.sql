-- Schéma de la session éditeur (issue #109, ADR-0111 — accepté par
-- l'humain le 2026-11-11). Les stores du serveur recréent ces tables
-- si elles manquent (CREATE TABLE IF NOT EXISTS dans
-- server/editorSessionStore.ts) ; ce script les pose dès l'init du
-- volume.

-- la session éditeur : UNE ligne, l'état versionné courant (ADR-0110)
CREATE TABLE IF NOT EXISTS editor_session (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  version BIGINT NOT NULL,
  state JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- le journal de la session : une ligne par version acceptée, pour que
-- l'undo/redo survive à un rechargement. Rétention : les dernières
-- EDITOR_SESSION_HISTORY_DEPTH versions (200 par défaut), nettoyées à
-- chaque écriture par le serveur.
CREATE TABLE IF NOT EXISTS editor_session_events (
  version BIGINT PRIMARY KEY,
  state JSONB NOT NULL,
  at TIMESTAMPTZ NOT NULL DEFAULT now()
);
