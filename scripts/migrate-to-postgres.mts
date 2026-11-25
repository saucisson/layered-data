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
  console.error("DATABASE_URL is required — no migration without a PostgreSQL database");
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
console.log("PostgreSQL stores ready (schema verified)");

// ---- the visitors' layers ------------------------------------------

const layerFiles = readdirSync(USERS_DIRECTORY).filter((fileName) => fileName.endsWith(".ld"));
let migratedLayers = 0;
let skippedLayers = 0;
for (const fileName of layerFiles) {
  const nameCheck = asLayerName({ candidate: fileName.slice(0, -3) });
  if ("reason" in nameCheck) {
    console.warn("skipped (invalid name): " + fileName + " — " + nameCheck.reason);
    skippedLayers++;
    continue;
  }
  const source = readFileSync(join(USERS_DIRECTORY, fileName), "utf8");
  const { created } = await userLayerStore.write({ name: nameCheck.name, source });
  console.log((created ? "created" : "updated") + ": " + nameCheck.name);
  migratedLayers++;
}
console.log(migratedLayers + " layer(s) migrated, " + skippedLayers + " skipped");

// ---- the editor session ---------------------------------------------

if (existsSync(EDITOR_SESSION_FILE)) {
  const diskState = parseEditorSession({ text: readFileSync(EDITOR_SESSION_FILE, "utf8") });
  if (diskState === null) {
    console.warn("data/editor-session.json unreadable — session not migrated");
  } else {
    const current = await editorSessionStore.load();
    if (current !== undefined && current.version >= diskState.version) {
      console.log(
        "session already at version " + current.version + " in the database (disk: " + diskState.version + ") — nothing to do",
      );
    } else {
      await editorSessionStore.save({ state: diskState });
      console.log("session migrated: version " + diskState.version + ", " + diskState.additions.length + " addition(s)");
    }
  }
} else {
  console.log("no data/editor-session.json — session not migrated");
}

console.log("disk files KEPT (backup) — no file deleted");
