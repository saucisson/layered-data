// ============================================================
// Layered Data — migrate the disk quarry into PostgreSQL
// (issue #109, ADR-0111)
//
//     DATABASE_URL=postgres://user:password@host:5432/db \
//       node scripts/migrate-to-postgres.mts
//
// Upserts formalisms/users/*.ld into user_layers and
// data/editor-session.json into editor_session(+events). Idempotent:
// re-running it changes nothing. The disk files are KEPT — they stay
// the dev/test store and a non-destructive backup; deleting them is a
// human operation after verification.
// ============================================================
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

import {
  DATABASE_URL,
  USERS_DIRECTORY,
  EDITOR_SESSION_FILE,
  EDITOR_SESSION_HISTORY_DEPTH,
} from "../server/config.ts";
import { asLayerName } from "../server/layerStore.ts";
import { createUserLayerStore } from "../server/userLayerStore.ts";
import { createEditorSessionStore } from "../server/editorSessionStore.ts";
import { parseEditorSession } from "../src/application/editorSession.ts";

if (!DATABASE_URL) {
  console.error("DATABASE_URL est requis — aucune migration sans base PostgreSQL");
  process.exit(1);
}

const userLayerStore = createUserLayerStore({
  databaseUrl: DATABASE_URL,
  usersDirectory: USERS_DIRECTORY,
});
const editorSessionStore = createEditorSessionStore({
  databaseUrl: DATABASE_URL,
  editorSessionFile: EDITOR_SESSION_FILE,
  historyDepth: EDITOR_SESSION_HISTORY_DEPTH,
});

await userLayerStore.init();
await editorSessionStore.init();
console.log("stores PostgreSQL prêts (schéma vérifié)");

// ---- the visitors' layers ------------------------------------------

const layerFiles = readdirSync(USERS_DIRECTORY).filter((fileName) => fileName.endsWith(".ld"));
let migratedLayers = 0;
let skippedLayers = 0;
for (const fileName of layerFiles) {
  const nameCheck = asLayerName({ candidate: fileName.slice(0, -3) });
  if ("reason" in nameCheck) {
    console.warn("ignoré (nom invalide) : " + fileName + " — " + nameCheck.reason);
    skippedLayers++;
    continue;
  }
  const source = readFileSync(join(USERS_DIRECTORY, fileName), "utf8");
  const { created } = await userLayerStore.write({ name: nameCheck.name, source });
  console.log((created ? "créée" : "mise à jour") + " : " + nameCheck.name);
  migratedLayers++;
}
console.log(migratedLayers + " couche(s) migrée(s), " + skippedLayers + " ignorée(s)");

// ---- the editor session ---------------------------------------------

if (existsSync(EDITOR_SESSION_FILE)) {
  const diskState = parseEditorSession({ text: readFileSync(EDITOR_SESSION_FILE, "utf8") });
  if (diskState === null) {
    console.warn("data/editor-session.json illisible — session non migrée");
  } else {
    const current = await editorSessionStore.load();
    if (current !== undefined && current.version >= diskState.version) {
      console.log(
        "session déjà à version " + current.version + " en base (disque : " + diskState.version + ") — rien à faire",
      );
    } else {
      await editorSessionStore.save({ state: diskState });
      console.log("session migrée : version " + diskState.version + ", " + diskState.additions.length + " addition(s)");
    }
  }
} else {
  console.log("aucun data/editor-session.json — session non migrée");
}

console.log("fichiers disque CONSERVÉS (backup) — aucun fichier supprimé");
