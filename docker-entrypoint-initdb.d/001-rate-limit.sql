-- Schéma initial de la base au premier démarrage (issue #110).
-- Table rate_limit du rate limiting partagé entre instances (issue #85) :
-- un compteur par (clé cliente, fenêtre), incrémenté atomiquement.
-- Le serveur recrée la table si elle manque (CREATE TABLE IF NOT EXISTS
-- dans server/rateLimit.ts) ; ce script la pose dès l'init du volume.
-- Les tables de l'issue #109 (formalismes, modèles, session éditeur)
-- s'ajouteront ici quand elle sera livrée.
CREATE TABLE IF NOT EXISTS rate_limit (
  key TEXT NOT NULL,
  window_start BIGINT NOT NULL,
  count INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY (key, window_start)
);
