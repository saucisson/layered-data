// ============================================================
// Layered Data — migrate the disk quarry into PostgreSQL
// (issue #109, ADR-0111)
//
//     DATABASE_URL=postgres://user:password@host:5432/db \
//       node scripts/migrate-to-postgres.mts
//
// Upserts formalisms/users/*.ld into user_layers. Idempotent:
// re-running it changes nothing. The disk files are KEPT — they stay
// the dev/test store and a non-destructive backup; deleting them is a
// human operation after verification.
// ============================================================
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { DATABASE_URL, USERS_DIRECTORY } from "../server/config.ts";
import { asLayerName } from "../server/layerStore.ts";
import { createUserLayerStore } from "../server/userLayerStore.ts";

if (!DATABASE_URL) {
  console.error("DATABASE_URL est requis — aucune migration sans base PostgreSQL");
  process.exit(1);
}

const userLayerStore = createUserLayerStore({
  databaseUrl: DATABASE_URL,
  usersDirectory: USERS_DIRECTORY,
});

await userLayerStore.init();
console.log("store PostgreSQL prêt (schéma vérifié)");

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
console.log("fichiers disque CONSERVÉS (backup) — aucun fichier supprimé");
