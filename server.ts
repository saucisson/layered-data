// ============================================================
// Layered Data — the quarry proxy (composition root)
//
// A dependency-free Node server (Node 22 runs TypeScript through
// native type stripping) that plays four roles for the workshop:
//   1. the disk quarry — the API that lists, reads, writes and
//      deletes the formalism layers (.ld files) of the corpus;
//   2. the AI geologist — a thin proxy to Mistral that carries the
//      access key server-side and grounds the model in the real
//      state of the corpus;
//   3. the shared editor session (ADR-0110) — the versioned living
//      additions of the graphical editor, judged by the same staging,
//      broadcast to every connected editor over SSE, persisted as
//      JSON on disk;
//   4. the static host — serves dist/ when a production build
//      exists.
//
// The modules live in server/: config, layerStore, geologistPrompts,
// mistralClient, editorSessionServer, httpUtils, routes.
//
// By default it binds to the loopback only (127.0.0.1:8791):
// HOST and PORT exist for real deployments, and the access code
// (API_TOKEN) protects the quarry and the geologist.
//
// What the server SENDS stays in French by design: the JSON keys
// of the compatibility API (`noyau`, `utilisateurs`, `erreur`…)
// are observable protocol and user-facing vocabulary of the
// workshop — the code is English, the spoken surface is French.
// ============================================================
import { existsSync } from "node:fs";

import { VERSION, PORT, HOST, API_TOKEN, MISTRAL_API_KEY, MAX_PEN_ATTEMPTS, environmentFilePath } from "./server/config.ts";
import { KERNEL_LAYER_NAMES } from "./server/layerStore.ts";
import { createQuarryServer } from "./server/routes.ts";

const server = createQuarryServer();

server.listen(PORT, HOST, () => {
  console.log("carrière Layered Data v" + VERSION + " sur http://" + HOST + ":" + PORT);
  console.log("socle : " + KERNEL_LAYER_NAMES.length + " couches ; géologue vérifié : jusqu'à " + MAX_PEN_ATTEMPTS + " propositions jugées par le staging" + (MISTRAL_API_KEY ? "" : " (MISTRAL_API_KEY absente — le géologue reste local)"));
  if (API_TOKEN === "changez-moi") {
    console.log("ATTENTION : code d'accès par défaut « changez-moi » encore en place — posez API_TOKEN dans .env");
  }
  if (existsSync(environmentFilePath)) {
    console.log(".env lu : " + environmentFilePath);
  } else {
    console.log("aucun .env trouvé — variables prises de l'environnement");
  }
});
