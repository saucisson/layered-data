// ============================================================
// Layered Data — the wardrobe proxy
//
// A dependency-free Node server (Node 22 runs TypeScript through
// native type stripping) that plays three roles for the workshop:
//   1. the disk wardrobe — the API that lists, reads, writes and
//      deletes the formalism layers (.ld files) of the corpus;
//   2. the AI pen — a thin proxy to Mistral that carries the
//      access key server-side and grounds the model in the real
//      state of the corpus;
//   3. the static host — serves dist/ when a production build
//      exists.
//
// By default it binds to the loopback only (127.0.0.1:8791):
// HOST and PORT exist for real deployments, and the access code
// (API_TOKEN) protects the wardrobe and the pen.
//
// What the server SENDS stays in French by design: the JSON keys
// of the compatibility API (`noyau`, `utilisateurs`, `erreur`…)
// are observable protocol and user-facing vocabulary of the
// workshop — the code is English, the spoken surface is French.
// The pen's system prompt alone follows the workshop's languages:
// English by default, French its mirror (penInstructions).
// ============================================================
import { createServer } from "node:http";
import type { IncomingMessage, ServerResponse } from "node:http";
import { readFileSync, writeFileSync, unlinkSync, existsSync, readdirSync, mkdirSync } from "node:fs";
import { join, extname } from "node:path";

// The verified pen loop lives in the application layer — a pure
// use case, injected with the model call. The trunk order is the
// canonical one of the corpus assembly.
import { KERNEL_LAYER_NAMES as TRUNK_LAYER_NAMES } from "./src/application/corpus.ts";
import { composeVerifiedLayerDraft } from "./src/application/penLoop.ts";

// ------------------------------------------------------------
// 1. CONFIGURATION
//
// Node does not read .env on its own; a deployment that has one
// expects it to apply. The real environment wins over the file —
// a variable already set is never overridden.
// ------------------------------------------------------------
const environmentFilePath = join(import.meta.dirname, ".env");
if (existsSync(environmentFilePath)) {
  for (const line of readFileSync(environmentFilePath, "utf8").split("\n")) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!match || line.trim().startsWith("#")) continue;
    const variable = match[1];
    const value = match[2].replace(/^["']|["']$/g, "");
    if (process.env[variable] === undefined) process.env[variable] = value;
  }
}

const VERSION = "2.23.0";
const PORT = Number(process.env.PORT ?? 8791);
const HOST = process.env.HOST ?? "127.0.0.1";
const API_TOKEN = process.env.API_TOKEN ?? "changez-moi";
const MISTRAL_API_KEY = process.env.MISTRAL_API_KEY ?? "";
const MISTRAL_URL = process.env.MISTRAL_URL ?? "https://api.mistral.ai/v1/chat/completions";
const MISTRAL_MODEL = process.env.MISTRAL_MODEL ?? "codestral-latest";
// The verified pen loop: the number of proposals the staging may
// judge before the route gives up and answers 422.
const MAX_PEN_ATTEMPTS = Math.max(1, Number(process.env.PEN_MAX_ATTEMPTS ?? 3));
// The strict arm of the loop (ADR-0017): the pen may propose an
// order-decided read only if the reading address signs an `assume`
// — set PEN_STRICT_CONFLICTS=1 to arm it.
const STRICT_CONFLICTS = process.env.PEN_STRICT_CONFLICTS === "1";
// The strict arm of the loop for the carried checks (ADR-0018): the
// pen may no longer propose a layer whose checks refuse it — set
// PEN_STRICT_CHECKS=1 to arm it.
const STRICT_CHECKS = process.env.PEN_STRICT_CHECKS === "1";

// ------------------------------------------------------------
// 2. THE WARDROBE ON DISK
//
// The corpus lives in two folders: the kernel (read-only, the
// spine of the workshop) and the users (the feathers written by
// visitors). The users folder is created at startup so the
// wardrobe exists even on a fresh clone.
// ------------------------------------------------------------
const KERNEL_DIRECTORY = join(import.meta.dirname, "formalisms", "kernel");
const USERS_DIRECTORY = join(import.meta.dirname, "formalisms", "users");
const DIST_DIRECTORY = join(import.meta.dirname, "dist");
mkdirSync(USERS_DIRECTORY, { recursive: true });

/** A layer name as it appears in a URL: lowercase letters,
 * digits and dashes. The brand keeps names from being confused
 * with arbitrary strings. */
declare const layerNameBrand: unique symbol;
export type LayerName = string & { readonly [layerNameBrand]: never };

const LAYER_NAME_PATTERN = /^[a-z0-9][a-z0-9-]{0,63}$/;

/** Accept a URL segment as a layer name, or explain the refusal. */
function asLayerName({ candidate }: { candidate: string }): { name: LayerName } | { reason: string } {
  if (LAYER_NAME_PATTERN.test(candidate)) {
    return { name: candidate as LayerName };
  }
  return { reason: "nom invalide : minuscules, chiffres, tirets" };
}

/** List the layer names of a wardrobe folder, sorted. An absent
 * folder is an empty wardrobe, never an exception. */
function listLayerNames({ directory }: { directory: string }): string[] {
  if (!existsSync(directory)) return [];
  return readdirSync(directory)
    .filter((fileName) => fileName.endsWith(".ld"))
    .map((fileName) => fileName.slice(0, -3))
    .sort();
}

const KERNEL_LAYER_NAMES = listLayerNames({ directory: KERNEL_DIRECTORY });

/** The trunk language source, in the canonical trunk order, joined
 * once at startup: the pen loop stages every proposal over this
 * text. The users' feathers join per call — a feather written
 * seconds ago stays refinable for the pen. */
const TRUNK_LANGUAGE_SOURCE = TRUNK_LAYER_NAMES.map((name) => {
  const source = readFileSync(kernelLayerPath({ name: String(name) as LayerName }), "utf8");
  return source.endsWith("\n") ? source : source + "\n";
}).join("");

/** The path of a kernel layer — read-only ground. */
function kernelLayerPath({ name }: { name: LayerName }): string {
  return join(KERNEL_DIRECTORY, name + ".ld");
}

/** The path of a user layer — the writable wardrobe. */
function userLayerPath({ name }: { name: LayerName }): string {
  return join(USERS_DIRECTORY, name + ".ld");
}

/** What a lookup found: a layer's source and where it lives.
 * The user wardrobe wins over the kernel — a visitor may shadow
 * a read-only name with their own writing. */
type LayerLookup =
  | { found: false }
  | { found: true; location: "kernel" | "users"; source: string };

function lookupLayer({ name }: { name: LayerName }): LayerLookup {
  if (existsSync(userLayerPath({ name }))) {
    return { found: true, location: "users", source: readFileSync(userLayerPath({ name }), "utf8") };
  }
  if (KERNEL_LAYER_NAMES.includes(name)) {
    return { found: true, location: "kernel", source: readFileSync(kernelLayerPath({ name }), "utf8") };
  }
  return { found: false };
}

/** Write a user layer (the kernel refuses). A trailing newline is
 * added: every layer file ends with one. */
function writeUserLayer({ name, source }: { name: LayerName; source: string }): { created: boolean } {
  const created = !existsSync(userLayerPath({ name }));
  const normalized = source.endsWith("\n") ? source : source + "\n";
  writeFileSync(userLayerPath({ name }), normalized);
  return { created };
}

/** Delete a user layer (the kernel refuses). */
function deleteUserLayer({ name }: { name: LayerName }): void {
  unlinkSync(userLayerPath({ name }));
}

// ------------------------------------------------------------
// 3. THE AI PEN — GROUNDING
//
// The pen writes layers; to be pertinent it must not guess what
// already exists. The system prompt embeds, rebuilt at each
// call: the manifesto of the model, the backbone (one line per
// layer, read from the disk so feathers written seconds ago are
// known), and one complete example of the corpus.
// ------------------------------------------------------------
const MANIFESTO = `CE QU'EST LAYERED DATA — les définitions elles-mêmes sont des données.
Tout est couche : les formalismes (les schémas) et les modèles (les données) vivent dans le même espace, adressables, raffinables, héritants — pas de séparation schéma/instance.
- Une couche en raffine d'autres (héritage multiple, ordonné par "then") ; un membre hérite de ses parents par "refines @<chemin>".
- La lecture est un carottage premier-gagné : la chaîne de raffinement se suit de la plus concrète à la plus abstraite, la première source qui porte la clé gagne, les suivantes ne sont même pas consultées.
- Instancier, c'est citer : un membre peut citer une couche entière (@couche) ; "extend <bloc> refines @<fenêtre> then @<fenêtre> …" développe les citations en membres qualifiés, la donnée reste dans le template.
- Le rendu est une lentille : une couche d'affichage (graph-display, petrinet-display…) raffine le formalisme et dessine tout ce qui en descend.

LA COLONNE VERTÉBRALE CI-DESSOUS EST L'ÉTAT RÉEL DE L'ATELIER — un nouveau formalisme s'y raccroche : raffiner une couche existante (chemins absolus vers ses membres), jamais redéfinir ce qui existe.`;

/** One line per existing layer: the `layer …` header as written.
 * Reading the files at each call keeps the backbone true — the
 * kernel and the visitors' feathers alike. */
function corpusBackbone(): string {
  const lines: string[] = [];
  for (const name of KERNEL_LAYER_NAMES) {
    const source = readFileSync(kernelLayerPath({ name: name as LayerName }), "utf8");
    const header = source.split("\n").find((line) => line.startsWith("layer "));
    lines.push(header ?? "layer " + name);
  }
  for (const name of listLayerNames({ directory: USERS_DIRECTORY })) {
    const source = readFileSync(userLayerPath({ name: name as LayerName }), "utf8");
    const header = source.split("\n").find((line) => line.startsWith("layer "));
    lines.push(header ?? "layer " + name + "  // plume d'un visiteur");
  }
  return lines.join("\n");
}

/** The complete system prompt sent to the model. */
function buildSystemPrompt(): string {
  let example = "";
  if (KERNEL_LAYER_NAMES.includes("pn-philosophers-1")) {
    example =
      "UN EXEMPLE COMPLET DU CORPUS — pn-philosophers-1, le modèle d'un philosophe seul (il remplit les collections du schéma pn-philosophers, ses membres raffinent les types par chemin absolu, les arcs désignent leurs extrémités par @) :\n" +
      readFileSync(kernelLayerPath({ name: "pn-philosophers-1" as LayerName }), "utf8").trim();
  }
  const featherNames = listLayerNames({ directory: USERS_DIRECTORY });
  const feathers =
    featherNames.length > 0
      ? "\n\nLES PLUMES DES VISITEURS (sources complètes — un nouveau formalisme peut les raffiner ou les citer) :\n" +
        featherNames
          .sort()
          .map((name) => readFileSync(userLayerPath({ name: name as LayerName }), "utf8").trim())
          .join("\n\n")
      : "";
  return (
    penInstructions("en") +
    "\n\n" +
    MANIFESTO +
    "\n\nLA COLONNE VERTÉBRALE (une ligne par couche — " +
    KERNEL_LAYER_NAMES.length +
    " du tronc en lecture seule, plus les plumes) :\n" +
    corpusBackbone() +
    "\n\n" +
    example +
    feathers
  );
}

const PEN_INSTRUCTIONS_EN = `You are the pen of the Layered Data v${VERSION} workshop: you write layers in the workshop's indentation language, and nothing else.

THE LANGUAGE (the seven gestures, explained step by step in the workshop's tutorial):
- "layer <name>" opens a layer; "refines @<layer>" declares a parent, "then @<other>" chains the unions of parents.
- Blocks open by indentation: "specification" (the type declarations), the collections (places, transitions, arcs…), "tests".
- Inside a block, a member is written "<key> refines @<absolute-path>"; "@" designates an absolute path "@<layer>/<path>/<target>" (a single segment cites a whole layer — the citation).
- The acts: "extend <block>" (the parent already carries the key), "override <slot> = <value>" (lays a value again), "abstract <slot>" (open slot without value), "mask <slot>" (silent inheritance), "bind <slot> = @<address>" (binds a slot to an address), "check <label>, <label>" (domain check), a value "slot = <value>" (number, "string", @reference).
- A "// comment" line before a key becomes a note: it travels with the block.
- "extend <collection> refines @<window1> then @<window2> then …" expands citations: the members land qualified, the data stays in the template.

THE TESTS CONTRACT: the expected-reads contract travels with the layer, in a "tests" block:
- "expect <path>/<key> = <value>" — the read must return exactly this value; "expect <path>/<key> absent" — the read must return null; an expected reference is written "expect <path>/<key> = @<layer>/<path>".
- The contract's words (tests, expect, absent) are written in English.

THE PROTOCOL: you propose the pen, never the truth. An expectation is never invented to please: expectations are measured, they are not guessed. Measure (or ask to measure) before writing an expect; what is measured is not what is desired.

YOUR PROPOSALS ARE VERIFIED: every proposal is judged by the workshop's staging (step "syntax", verdicts "unknown-target", "expectation-betrayed", "implicit-overload"…). If a refusal is sent back to you, it carries the verdicts of your proposal — correct it and propose the complete layer again.

Answer only with the layer or layers in the language, without code fencing, without explanation.`;

const PEN_INSTRUCTIONS_FR = `Tu es la plume de l'atelier Layered Data v${VERSION} : tu écris des couches dans le langage à indentation de l'atelier, et rien d'autre.

LE LANGAGE (les sept gestes, expliqués pas-à-pas dans le tutoriel de l'atelier) :
- "layer <nom>" ouvre une couche ; "refines @<couche>" déclare un parent, "then @<autre>" enchaîne les unions de parents.
- Les blocs s'ouvrent par indentation : "specification" (les déclarations de types), les collections (places, transitions, arcs…), "tests".
- Dans un bloc, un membre s'écrit "<clé> refines @<chemin-absolu>" ; "@" désigne un chemin absolu "@<couche>/<chemin>/<cible>" (un seul segment cite une couche entière — la citation).
- Les actes : "extend <bloc>" (le parent porte déjà la clé), "override <slot> = <valeur>" (repose une valeur), "abstract <slot>" (slot ouvert sans valeur), "mask <slot>" (héritage muet), "bind <slot> = @<adresse>" (lie un slot à une adresse), "check <étiquette>, <étiquette>" (vérification de domaine), une valeur "slot = <valeur>" (nombre, "chaîne", @référence).
- Une ligne "// commentaire" avant une clé devient une note : elle voyage avec le bloc.
- "extend <collection> refines @<fenêtre1> then @<fenêtre2> then …" développe des citations : les membres atterrissent qualifiés, la donnée reste dans le template.

LE CONTRAT DE TESTS : le contrat de lectures attendues voyage avec la couche, dans un bloc "tests" :
- "expect <chemin>/<clé> = <valeur>" — la lecture doit rendre exactement cette valeur ; "expect <chemin>/<clé> absent" — la lecture doit rendre null ; une référence attendue s'écrit "expect <chemin>/<clé> = @<couche>/<chemin>".
- Les mots du contrat (tests, expect, absent) s'écrivent en anglais.

LE PROTOCOLE : tu proposes la plume, jamais la vérité. Un attendu n'est jamais inventé pour faire plaisir : les attendus se mesurent, ils ne se devinent pas. Mesure (ou demande de mesurer) avant d'écrire un expect ; ce qui est mesuré n'est pas ce qui est désiré.

TES PROPOSITIONS SONT VÉRIFIÉES : chaque proposition est jugée par le staging de l'atelier (étape « syntaxe », verdicts « cible-inconnue », « attendu-trahi », « surcharge-implicite »…). Si un refus t'est renvoyé, il porte les verdicts de ta proposition — corrige-la et repose la couche complète.

Réponds uniquement avec la ou les couches en langage, sans enceinte de code, sans explication.`;

/** The pen's instructions in the workshop language — English is
 * the default, French its mirror; both follow VERSION. */
function penInstructions(language: "en" | "fr" = "en"): string {
  return language === "fr" ? PEN_INSTRUCTIONS_FR : PEN_INSTRUCTIONS_EN;
}

// ------------------------------------------------------------
// 4. HTTP HELPERS
// ------------------------------------------------------------
function sendJson({ response, statusCode, body }: { response: ServerResponse; statusCode: number; body: unknown }): void {
  const text = JSON.stringify(body);
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(text),
  });
  response.end(text);
}

function sendText({ response, statusCode, body }: { response: ServerResponse; statusCode: number; body: string }): void {
  response.writeHead(statusCode, { "Content-Type": "text/plain; charset=utf-8" });
  response.end(body);
}

/** The access code travels in the `x-access-code` header (the
 * workshop protocol) or as a Bearer token (compatibility) —
 * never in the URL, never in the page. */
function isAccessGranted({ request }: { request: IncomingMessage }): boolean {
  const workshopHeader = request.headers["x-access-code"];
  if (typeof workshopHeader === "string" && workshopHeader.trim() !== "" && workshopHeader.trim() === API_TOKEN) {
    return true;
  }
  const authorizationHeader = request.headers["authorization"] ?? "";
  return authorizationHeader.startsWith("Bearer ") && authorizationHeader.slice(7) === API_TOKEN;
}

/** Read a request body, refusing bodies over one megabyte — a
 * layer source is a few kilobytes; more is not a source. */
function readRequestBody({ request }: { request: IncomingMessage }): Promise<string> {
  return new Promise((resolve) => {
    let accumulated = "";
    request.on("data", (chunk) => {
      accumulated += chunk;
      if (accumulated.length > 1_000_000) request.destroy();
    });
    request.on("end", () => resolve(accumulated));
  });
}

/** The source field of a JSON body, or why the body is refused. */
function sourceOfRequestBody({ rawBody }: { rawBody: string }): { source: string } | { reason: string } {
  const body = JSON.parse(rawBody || "{}") as { source?: unknown };
  if (typeof body?.source === "string" && body.source.trim()) {
    return { source: body.source };
  }
  return { reason: "corps JSON attendu : { \"source\": \"…\" }" };
}

// ------------------------------------------------------------
// 5. THE AI PEN — THE VERIFIED LOOP
//
// The pen proposes, the staging judges, the refusal comes back to
// the model with its verdicts. The answer of the route is always a
// STAGED draft: plain text on 200 (the accepted layer source), a
// spoken refusal on 422 (budget spent), an infrastructure error
// (no key, unreachable upstream) keeps its own status.
// ------------------------------------------------------------

/** An infrastructure failure of the pen — not a verdict, the loop
 * never retries it: the route passes it through with its status. */
class PenInfraFailure {
  readonly statusCode: number;
  readonly body: string;

  constructor({ statusCode, body }: { statusCode: number; body: string }) {
    this.statusCode = statusCode;
    this.body = body;
  }
}

/** One call to the upstream model. The feedback of a previous
 * refusal travels with the instruction — the correction happens in
 * the model's own writing, the verdict vocabulary speaks to it. */
async function generateLayer({ instruction, feedback }: { instruction: string; feedback: string | null }): Promise<{ statusCode: number; body: string }> {
  if (!MISTRAL_API_KEY) {
    throw new PenInfraFailure({ statusCode: 500, body: "pas de clé Mistral configurée (MISTRAL_API_KEY) — la plume reste locale" });
  }
  let upstreamResponse: Response;
  try {
    upstreamResponse = await fetch(MISTRAL_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + MISTRAL_API_KEY },
      body: JSON.stringify({
        model: MISTRAL_MODEL,
        messages: [
          { role: "system", content: buildSystemPrompt() },
          { role: "user", content: feedback === null ? instruction : instruction + "\n\n" + feedback },
        ],
      }),
    });
  } catch (error) {
    throw new PenInfraFailure({ statusCode: 502, body: "amont injoignable (" + MISTRAL_URL + ") : " + String((error as Error)?.message ?? error) });
  }
  if (!upstreamResponse.ok) {
    // The upstream error is passed through verbatim — a refused
    // key, an unknown model or an exhausted quota must not
    // disguise itself as a mute "bad gateway".
    const detail = (await upstreamResponse.text()).replace(/\s+/g, " ").slice(0, 300);
    throw new PenInfraFailure({ statusCode: 502, body: "amont a répondu " + upstreamResponse.status + " (" + MISTRAL_MODEL + ") : " + detail });
  }
  const data = (await upstreamResponse.json()) as { choices?: { message?: { content?: string } }[] };
  const proposal = data?.choices?.[0]?.message?.content ?? "";
  if (!proposal.trim()) {
    throw new PenInfraFailure({ statusCode: 502, body: "la plume n'a rien écrit" });
  }
  return { statusCode: 200, body: proposal };
}

// ------------------------------------------------------------
// 6. THE ROUTES
//
// The wardrobe API exists in two vocabularies: `api/layers` (the
// workshop protocol — English keys, one shape for every client)
// and `api/formalismes` (the compatibility API — French keys,
// kept for the already-published pen clients).
// ------------------------------------------------------------
const server = createServer(async (request, response) => {
  const url = new URL(request.url ?? "/", "http://" + (request.headers.host ?? "localhost"));
  const segments = url.pathname.split("/").filter(Boolean);

  try {
    // ---- the wardrobe and pen API ----
    if (segments[0] === "api") {
      if (url.pathname === "/api/whoami") {
        if (!isAccessGranted({ request })) return sendJson({ response, statusCode: 401, body: { erreur: "code d'accès requis" } });
        return sendJson({ response, statusCode: 200, body: { version: VERSION, utilisateur: "porteur-du-code" } });
      }
      if (!isAccessGranted({ request })) {
        return sendJson({ response, statusCode: 401, body: { erreur: "code d'accès requis" } });
      }

      // ---- the workshop protocol: api/layers ----
      if (request.method === "GET" && url.pathname === "/api/layers") {
        const layers = [
          ...KERNEL_LAYER_NAMES.map((name) => ({ name, builtIn: true })),
          ...listLayerNames({ directory: USERS_DIRECTORY }).map((name) => ({ name, builtIn: false })),
        ];
        return sendJson({ response, statusCode: 200, body: { layers } });
      }

      if (segments[1] === "layers" && segments[2]) {
        const nameCheck = asLayerName({ candidate: segments[2] });
        if ("reason" in nameCheck) return sendJson({ response, statusCode: 400, body: { erreur: nameCheck.reason } });
        const name = nameCheck.name;

        if (request.method === "GET") {
          const lookup = lookupLayer({ name });
          if (!lookup.found) return sendJson({ response, statusCode: 404, body: { erreur: "couche inconnue : " + name } });
          return sendJson({ response, statusCode: 200, body: { name, builtIn: lookup.location === "kernel", source: lookup.source } });
        }

        if (request.method === "PUT") {
          if (KERNEL_LAYER_NAMES.includes(name)) {
            return sendJson({ response, statusCode: 403, body: { erreur: "le tronc est en lecture seule : " + name } });
          }
          const bodyCheck = sourceOfRequestBody({ rawBody: await readRequestBody({ request }) });
          if ("reason" in bodyCheck) return sendJson({ response, statusCode: 400, body: { erreur: bodyCheck.reason } });
          const { created } = writeUserLayer({ name, source: bodyCheck.source });
          return sendJson({ response, statusCode: created ? 201 : 200, body: { name, builtIn: false, écrit: true } });
        }
      }

      // ---- the compatibility API: api/formalismes ----
      if (request.method === "GET" && url.pathname === "/api/formalismes") {
        const userNames = listLayerNames({ directory: USERS_DIRECTORY });
        return sendJson({
          response,
          statusCode: 200,
          body: {
            version: VERSION,
            noyau: KERNEL_LAYER_NAMES,
            utilisateurs: userNames,
            total: KERNEL_LAYER_NAMES.length + userNames.length,
          },
        });
      }

      if (segments[1] === "formalismes" && segments[2]) {
        const nameCheck = asLayerName({ candidate: segments[2] });
        if ("reason" in nameCheck) return sendJson({ response, statusCode: 400, body: { erreur: nameCheck.reason } });
        const name = nameCheck.name;

        if (request.method === "GET") {
          const lookup = lookupLayer({ name });
          if (!lookup.found) return sendJson({ response, statusCode: 404, body: { erreur: "couche inconnue : " + name } });
          return sendJson({ response, statusCode: 200, body: { nom: name, origine: lookup.location, source: lookup.source } });
        }

        if (request.method === "PUT") {
          if (KERNEL_LAYER_NAMES.includes(name)) {
            return sendJson({ response, statusCode: 403, body: { erreur: "le tronc est en lecture seule : " + name } });
          }
          const bodyCheck = sourceOfRequestBody({ rawBody: await readRequestBody({ request }) });
          if ("reason" in bodyCheck) return sendJson({ response, statusCode: 400, body: { erreur: bodyCheck.reason } });
          const { created } = writeUserLayer({ name, source: bodyCheck.source });
          return sendJson({ response, statusCode: created ? 201 : 200, body: { nom: name, origine: "utilisateurs", écrit: true } });
        }

        if (request.method === "DELETE") {
          if (KERNEL_LAYER_NAMES.includes(name)) {
            return sendJson({ response, statusCode: 403, body: { erreur: "le tronc est en lecture seule : " + name } });
          }
          if (!existsSync(userLayerPath({ name }))) {
            return sendJson({ response, statusCode: 404, body: { erreur: "couche inconnue : " + name } });
          }
          deleteUserLayer({ name });
          return sendJson({ response, statusCode: 200, body: { nom: name, effacé: true } });
        }
      }

      // ---- the pen: prompt (workshop protocol) or instruction
      // (compatibility), answered with a STAGED draft in plain
      // text. Every proposal is judged by the exact staging the
      // workshop applies; a refusal travels back to the model
      // with its verdicts, up to MAX_PEN_ATTEMPTS propositions ----
      if (request.method === "POST" && url.pathname === "/api/generate") {
        const body = JSON.parse((await readRequestBody({ request })) || "{}") as { prompt?: unknown; instruction?: unknown };
        const instruction = body?.prompt ?? body?.instruction;
        if (typeof instruction !== "string" || !instruction.trim()) {
          return sendJson({ response, statusCode: 400, body: { erreur: "corps JSON attendu : { \"prompt\": \"…\" }" } });
        }
        // The living context of the loop: the trunk once, the
        // users' feathers read at the call — a feather written
        // seconds ago stays refinable for the pen.
        const userNames = listLayerNames({ directory: USERS_DIRECTORY });
        const previousAdditionSources = userNames.map((name) => readFileSync(userLayerPath({ name: name as LayerName }), "utf8"));
        try {
          const loopOutcome = await composeVerifiedLayerDraft({
            instruction,
            languageSource: TRUNK_LANGUAGE_SOURCE,
            livingLayerNames: [...TRUNK_LAYER_NAMES, ...userNames],
            previousAdditionSources,
            maxAttempts: MAX_PEN_ATTEMPTS,
            strictConflicts: STRICT_CONFLICTS,
            strictChecks: STRICT_CHECKS,
            propose: async ({ instruction, feedback }) => {
              const generated = await generateLayer({ instruction, feedback });
              if (generated.statusCode !== 200) {
                throw new PenInfraFailure({ statusCode: generated.statusCode, body: generated.body });
              }
              return generated.body;
            },
          });
          if (loopOutcome.ok && loopOutcome.draftSource !== null) {
            return sendText({ response, statusCode: 200, body: loopOutcome.draftSource });
          }
          // The budget is spent: the refusal speaks — the last
          // feedback, the verdicts the model ignored. The client
          // shows it and falls back to its own staging.
          const lastRefusal = loopOutcome.refusals[loopOutcome.refusals.length - 1];
          return sendText({
            response,
            statusCode: 422,
            body: "la plume n'a pas produit de couche acceptable en " + loopOutcome.attempts + " propositions — dernier refus :\n" + lastRefusal.feedback,
          });
        } catch (error) {
          if (error instanceof PenInfraFailure) {
            return sendText({ response, statusCode: error.statusCode, body: error.body });
          }
          throw error;
        }
      }

      return sendJson({ response, statusCode: 404, body: { erreur: "route inconnue : " + request.method + " " + url.pathname } });
    }

    // ---- the static build, when it exists ----
    if (request.method === "GET") {
      if (!existsSync(DIST_DIRECTORY)) {
        return sendJson({ response, statusCode: 404, body: { erreur: "dist/ absent — npm run build pour construire l'atelier" } });
      }
      const requestedPath = url.pathname === "/" ? "index.html" : url.pathname;
      let filePath = join(DIST_DIRECTORY, requestedPath);
      if (!existsSync(filePath)) filePath = join(DIST_DIRECTORY, "index.html");
      const mimeTypes: Record<string, string> = {
        ".html": "text/html; charset=utf-8",
        ".js": "text/javascript",
        ".css": "text/css",
        ".svg": "image/svg+xml",
        ".json": "application/json",
      };
      const body = readFileSync(filePath);
      response.writeHead(200, { "Content-Type": mimeTypes[extname(filePath)] ?? "application/octet-stream" });
      return response.end(body);
    }

    return sendJson({ response, statusCode: 404, body: { erreur: "route inconnue" } });
  } catch (error) {
    return sendJson({ response, statusCode: 500, body: { erreur: String((error as Error)?.message ?? error) } });
  }
});

server.listen(PORT, HOST, () => {
  console.log("armoire Layered Data v" + VERSION + " sur http://" + HOST + ":" + PORT);
  console.log("tronc : " + KERNEL_LAYER_NAMES.length + " couches ; plume vérifiée : jusqu'à " + MAX_PEN_ATTEMPTS + " propositions jugées par le staging" + (MISTRAL_API_KEY ? "" : " (MISTRAL_API_KEY absente — la plume reste locale)"));
  if (API_TOKEN === "changez-moi") {
    console.log("ATTENTION : code d'accès par défaut « changez-moi » encore en place — posez API_TOKEN dans .env");
  }
  if (existsSync(environmentFilePath)) {
    console.log(".env lu : " + environmentFilePath);
  } else {
    console.log("aucun .env trouvé — variables prises de l'environnement");
  }
});
