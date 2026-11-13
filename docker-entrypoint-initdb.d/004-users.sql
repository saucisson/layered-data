-- Schéma des comptes utilisateurs (issue #139, ADR-0114 — proposé).
-- Le store du serveur recrée la table et la colonne si elles manquent
-- (CREATE TABLE IF NOT EXISTS / ADD COLUMN IF NOT EXISTS dans
-- server/userLayerStore.ts) ; ce script les pose dès l'init du volume.
--
-- Le code d'accès partagé historique (env ACCESS_CODE) reste un secret
-- serveur, hors table users : il mappe vers l'identité partagée
-- porteur-du-code. Les couches existantes gardent owner = NULL.

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  display_name TEXT NOT NULL,
  access_code_hash TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL CHECK (role IN ('user', 'admin')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE user_layers
  ADD COLUMN IF NOT EXISTS owner INTEGER REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  ADD COLUMN IF NOT EXISTS visibility TEXT NOT NULL DEFAULT 'private' CHECK (visibility IN ('private', 'public'));
