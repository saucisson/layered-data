-- Schéma des couches utilisateurs (issue #109, ADR-0111 — accepté par
-- l'humain le 2026-11-11). Le store du serveur recrée la table si elle
-- manque (CREATE TABLE IF NOT EXISTS dans server/userLayerStore.ts) ;
-- ce script la pose dès l'init du volume.
-- Les tables de la session éditeur (editor_session, editor_session_events)
-- sont posées par 003-editor-session.sql (partie session de #109).

-- les couches des visiteurs (était formalisms/users/*.ld)
CREATE TABLE IF NOT EXISTS user_layers (
  name TEXT PRIMARY KEY,
  source TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
