// ============================================================
// Layered Data — the AI geologist's grounding prompts
//
// The geologist writes layers; to be pertinent it must not guess
// what already exists. The system prompt embeds, rebuilt at each
// call: the manifesto of the model, the stratigraphic column (one
// line per layer — the visitors' layers are read through the
// UserLayerStore at the call, so layers written seconds ago are
// known), and one complete example of the corpus.
// ============================================================
import { readFileSync } from "node:fs";

import { VERSION } from "./config.ts";
import { KERNEL_LAYER_NAMES, kernelLayerPath, type LayerName } from "./layerStore.ts";

/** One visitor layer as the prompt sees it: its name and source. */
export interface VisitorLayer {
  name: string;
  source: string;
}

// ------------------------------------------------------------
export const MANIFESTO = `CE QU'EST LAYERED DATA — les définitions elles-mêmes sont des données.
Tout est couche : les formalisms (les schémas) et les modèles (les données) vivent dans le même espace, adressables, raffinables, héritants — pas de séparation schéma/instance.
- Une couche en raffine d'autres (héritage multiple, ordonné par "then") ; un membre hérite de ses parents par "refines @<chemin>".
- La lecture est un carottage premier-gagné : la chaîne de raffinement se suit de la plus concrète à la plus abstraite, la première source qui porte la clé gagne, les suivantes ne sont même pas consultées.
- Instancier, c'est citer : un membre peut citer une couche entière (@couche) ; "extend <bloc> refines @<fenêtre> then @<fenêtre> …" développe les citations en membres qualifiés, la donnée reste dans le template.
- Le rendu est une lentille : une couche d'affichage (graph-display, petrinet-display…) raffine le formalisme et dessine tout ce qui en descend.

LA COLONNE STRATIGRAPHIQUE CI-DESSOUS EST L'ÉTAT RÉEL DE L'ATELIER — un nouveau formalisme s'y raccroche : raffiner une couche existante (chemins absolus vers ses membres), jamais redéfinir ce qui existe.`;

/** The leading comment block of a source: the layer's own
 * description, capped at a few lines — the column says what each
 * layer IS, not only its name. */
function leadingComments({ source, maxLines = 4 }: { source: string; maxLines?: number }): string[] {
  const comments: string[] = [];
  for (const line of source.split("\n")) {
    const trimmed = line.trim();
    if (trimmed.startsWith("//")) {
      comments.push(trimmed);
      if (comments.length >= maxLines) break;
    } else if (trimmed !== "") {
      break;
    }
  }
  return comments;
}

/** The `layer …` header of a source, or a bare fallback. */
function layerHeader({ source, fallbackName }: { source: string; fallbackName: string }): string {
  return source.split("\n").find((line) => line.startsWith("layer ")) ?? "layer " + fallbackName;
}

/** One entry per existing layer: the `layer …` header as written,
 * followed by its leading comments (the role of the layer). The
 * visitors' layers arrive as data, read through the store at each
 * call — the column stays true. `maxCommentLines` caps the comment
 * block per layer (the survey column keeps one line). */
export function corpusBackbone({
  visitorLayers,
  maxCommentLines = 4,
}: {
  visitorLayers: VisitorLayer[];
  maxCommentLines?: number;
}): string {
  const lines: string[] = [];
  for (const name of KERNEL_LAYER_NAMES) {
    const source = readFileSync(kernelLayerPath({ name: name as LayerName }), "utf8");
    lines.push(layerHeader({ source, fallbackName: name }));
    for (const comment of leadingComments({ source, maxLines: maxCommentLines })) {
      lines.push("  " + comment);
    }
  }
  for (const visitorLayer of visitorLayers) {
    lines.push(
      layerHeader({ source: visitorLayer.source, fallbackName: visitorLayer.name + "  // couche d'un visiteur" }),
    );
    for (const comment of leadingComments({ source: visitorLayer.source, maxLines: maxCommentLines })) {
      lines.push("  " + comment);
    }
  }
  return lines.join("\n");
}

/** The expected structure, spelled out: a formalism (a scheme)
 * refines an existing scheme and declares its types in
 * `specification`; a model refines a scheme and fills its
 * collections. The parent is chosen in the column, never invented. */
export const EXPECTED_STRUCTURE = `LA STRUCTURE ATTENDUE — deux espèces de couches, ne pas les confondre :
- UN FORMALISME (schéma) raffine un schéma existant de la colonne (ex. @petrinet-scheme, @graph, @bipartite-digraph) et déclare ses types dans "specification" : "<type>_type refines @<chemin absolu>", avec extend / override / abstract. Il ne contient PAS de données concrètes.
- UN MODÈLE raffine un schéma et remplit ses collections (places, transitions, arcs…) : chaque membre cite son type par chemin absolu, chaque arc désigne ses extrémités par @.
RÈGLES DE RACCORDEMENT : choisir dans la colonne le parent le plus spécifique qui convient (jamais un parent générique quand un parent précis existe — un Petri net raffine @petrinet-scheme, pas @graph) ; ne jamais redéfinir ce qui existe déjà (extend, pas une nouvelle déclaration) ; tous les chemins de membres sont absolus (@<couche>/<chemin>).`;

// ------------------------------------------------------------
// The survey pass (issue #279): a fast model chooses the ground —
// which existing layers the new layer should refine or cite —
// before the pen writes anything. The survey sees the column with
// one comment line per layer, never the full sources.
// ------------------------------------------------------------

/** The surveyor's instructions — it does NOT write layers, it
 * chooses the ground, and asks when the intention is ambiguous. */
export const SURVEY_INSTRUCTIONS_EN = `You are the surveyor of the Layered Data workshop: you do NOT write layers, you choose the ground.
Given the stratigraphic column and an intention, list ONLY the layers the new layer should REFINE or CITE, most specific first — and, when relevant, the closest existing layer whose STRUCTURE is worth imitating even from another family.
Rules: prefer the most specific existing parent; never invent a name absent from the column.
If the intention is too ambiguous to choose the ground, do NOT guess: answer with one or two lines, each starting with "QUESTION:", asking precisely what would disambiguate the grounding.
Otherwise answer with layer names only, one per line, prefixed by @, nothing else.`;

/** The survey prompt: the manifesto, the expected structure and the
 * column with a single comment line per layer — rebuilt at each
 * call so a visitor layer written seconds ago stays visible. */
export function buildSurveyPrompt({ visitorLayers }: { visitorLayers: VisitorLayer[] }): string {
  return (
    SURVEY_INSTRUCTIONS_EN +
    "\n\n" +
    MANIFESTO +
    "\n\n" +
    EXPECTED_STRUCTURE +
    "\n\nLA COLONNE STRATIGRAPHIQUE (une ligne par couche — " +
    KERNEL_LAYER_NAMES.length +
    " du socle en lecture seule, plus les couches des visiteurs) :\n" +
    corpusBackbone({ visitorLayers, maxCommentLines: 1 })
  );
}

/** The names alive right now: the kernel plus the visitors' layers. */
export function livingLayerNames({ visitorLayers }: { visitorLayers: VisitorLayer[] }): string[] {
  return [...KERNEL_LAYER_NAMES, ...visitorLayers.map((visitorLayer) => visitorLayer.name)];
}

/** The source of a living layer: the kernel read from disk, the
 * visitors from the data read at the call — null when the name is
 * not alive. */
function livingSource({
  name,
  visitorLayers,
}: {
  name: string;
  visitorLayers: VisitorLayer[];
}): string | null {
  if ((KERNEL_LAYER_NAMES as readonly string[]).includes(name)) {
    return readFileSync(kernelLayerPath({ name: name as LayerName }), "utf8");
  }
  const visitorLayer = visitorLayers.find((candidate) => candidate.name === name);
  return visitorLayer?.source ?? null;
}

/** The direct parents of a layer, parsed from its header
 * (`layer x refines @a then @b`) — the deterministic reading of
 * the refines chain, no model involved. */
export function parentsOf({
  name,
  visitorLayers,
}: {
  name: string;
  visitorLayers: VisitorLayer[];
}): string[] {
  const source = livingSource({ name, visitorLayers });
  if (source === null) return [];
  const header = layerHeader({ source, fallbackName: name });
  const refines = /\brefines\b(.*)$/.exec(header)?.[1] ?? "";
  const parents: string[] = [];
  for (const match of refines.matchAll(/@([a-z0-9][a-z0-9-]{0,63})/g)) {
    if (match[1] !== undefined && !parents.includes(match[1])) parents.push(match[1]);
  }
  return parents;
}

/** The transitive closure of the refines chain: every ancestor of
 * the given names, in discovery order, seeds excluded. The server
 * adds it deterministically — the survey never has to name an
 * ancestor it forgot. */
export function ancestorClosure({
  names,
  visitorLayers,
}: {
  names: readonly string[];
  visitorLayers: VisitorLayer[];
}): string[] {
  const closure: string[] = [];
  const queue = [...names];
  const seen = new Set(names);
  while (queue.length > 0) {
    const current = queue.shift();
    if (current === undefined) break;
    for (const parent of parentsOf({ name: current, visitorLayers })) {
      if (!seen.has(parent)) {
        seen.add(parent);
        closure.push(parent);
        queue.push(parent);
      }
    }
  }
  return closure;
}

/** The parsed answer of the survey: either clarifying questions
 * (lines starting with `QUESTION:`, case-insensitive) or a
 * selection of living layer names — `@` prefix tolerated, noise
 * ignored — closed over its ancestors. An unusable selection is
 * an empty one, never an invented name. */
export function parseSurveyResponse({
  text,
  livingNames,
  visitorLayers,
}: {
  text: string;
  livingNames: readonly string[];
  visitorLayers: VisitorLayer[];
}): { kind: "questions"; questions: string[] } | { kind: "selection"; layers: string[]; selected: string[]; closure: string[] } {
  const questions = text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => /^question:\s*/i.test(line))
    .map((line) => line.replace(/^question:\s*/i, "").trim())
    .filter((question) => question !== "");
  if (questions.length > 0) return { kind: "questions", questions };

  const alive = new Set(livingNames);
  const selected: string[] = [];
  for (const match of text.matchAll(/@([a-z0-9][a-z0-9-]{0,63})/g)) {
    const name = match[1];
    if (name !== undefined && alive.has(name) && !selected.includes(name)) selected.push(name);
  }
  const closure = ancestorClosure({ names: selected, visitorLayers });
  return { kind: "selection", layers: [...selected, ...closure], selected, closure };
}

/** The complete system prompt sent to the model. With
 * `selectedLayerNames` (the survey's ground), the prompt is cut:
 * the selected layers' full sources replace the fixed examples,
 * the column drops the selected layers (they are above, in full),
 * annotates the ancestors with their comments and lists every
 * other layer as a bare name. Without a selection, the prompt is
 * the monolith of before — the fallback is never worse. */
export function buildSystemPrompt({
  visitorLayers,
  selectedLayerNames,
}: {
  visitorLayers: VisitorLayer[];
  selectedLayerNames?: readonly string[];
}): string {
  if (selectedLayerNames === undefined || selectedLayerNames.length === 0) {
    return buildMonolithSystemPrompt({ visitorLayers });
  }
  const selected = [...selectedLayerNames];
  const closure = ancestorClosure({ names: selected, visitorLayers });
  const selectedSet = new Set(selected);
  const closureSet = new Set(closure);

  // The selected layers, in full — the ground of the proposal.
  const selectedText =
    "LES COUCHES RETENUES PAR LE RELEVÉ (sources complètes — le terrain de cette proposition) :\n" +
    selected
      .map((name) => (livingSource({ name, visitorLayers }) ?? "").trim())
      .filter((source) => source !== "")
      .join("\n\n");

  // The column, cut: ancestors annotated with their comments, every
  // other living layer as a bare name.
  const columnLines: string[] = [];
  for (const name of KERNEL_LAYER_NAMES) {
    if (selectedSet.has(name)) continue;
    const source = readFileSync(kernelLayerPath({ name: name as LayerName }), "utf8");
    if (closureSet.has(name)) {
      columnLines.push(layerHeader({ source, fallbackName: name }));
      for (const comment of leadingComments({ source })) columnLines.push("  " + comment);
    }
  }
  const bareKernel: string[] = [];
  for (const name of KERNEL_LAYER_NAMES) {
    if (!selectedSet.has(name) && !closureSet.has(name)) bareKernel.push("layer " + name);
  }
  const bareVisitors = visitorLayers
    .map((visitorLayer) => visitorLayer.name)
    .filter((name) => !selectedSet.has(name) && !closureSet.has(name))
    .sort((a, b) => a.localeCompare(b))
    .map((name) => "layer " + name);
  if (bareKernel.length > 0 || bareVisitors.length > 0) {
    columnLines.push("// … autres couches du socle (noms nus — pas le terrain de cette proposition) :");
    columnLines.push(...bareKernel, ...bareVisitors);
  }

  return (
    penInstructions("en") +
    "\n\n" +
    MANIFESTO +
    "\n\nLA COLONNE STRATIGRAPHIQUE (couches retenues absentes — leurs sources sont ci-dessous ; ancêtres annotés ; le reste en noms nus) :\n" +
    columnLines.join("\n") +
    "\n\n" +
    EXPECTED_STRUCTURE +
    "\n\n" +
    selectedText
  );
}

/** The monolith system prompt: the full column, the two fixed
 * examples, the visitors' full sources — the fallback when the
 * survey could not choose a ground. */
function buildMonolithSystemPrompt({ visitorLayers }: { visitorLayers: VisitorLayer[] }): string {
  let examples = "";
  if (KERNEL_LAYER_NAMES.includes("bipartite-digraph")) {
    examples +=
      "UN EXEMPLE COMPLET DE FORMALISME — bipartite-digraph, un schéma : il raffine deux axes existants, déclare ses types (left_type, right_type, arcAB_type…) par chemins absolus, impose ses conteneurs — aucune donnée concrète :\n" +
      readFileSync(kernelLayerPath({ name: "bipartite-digraph" as LayerName }), "utf8").trim() +
      "\n";
  }
  if (KERNEL_LAYER_NAMES.includes("pn-philosophers-1")) {
    examples +=
      "\n\nUN EXEMPLE COMPLET DE MODÈLE — pn-philosophers-1, le modèle d'un philosophe seul (il remplit les collections du schéma pn-philosophers, ses membres raffinent les types par chemin absolu, les arcs désignent leurs extrémités par @) :\n" +
      readFileSync(kernelLayerPath({ name: "pn-philosophers-1" as LayerName }), "utf8").trim();
  }
  const visitorLayersText =
    visitorLayers.length > 0
      ? "\n\nLES COUCHES DES VISITEURS (sources complètes — un nouveau formalisme peut les raffiner ou les citer) :\n" +
        [...visitorLayers]
          .sort((a, b) => a.name.localeCompare(b.name))
          .map((visitorLayer) => visitorLayer.source.trim())
          .join("\n\n")
      : "";
  return (
    penInstructions("en") +
    "\n\n" +
    MANIFESTO +
    "\n\nLA COLONNE STRATIGRAPHIQUE (une ligne par couche — " +
    KERNEL_LAYER_NAMES.length +
    " du socle en lecture seule, plus les couches des visiteurs) :\n" +
    corpusBackbone({ visitorLayers }) +
    "\n\n" +
    EXPECTED_STRUCTURE +
    "\n\n" +
    examples +
    visitorLayersText
  );
}

export const PEN_INSTRUCTIONS_EN = `You are the geologist of the Layered Data v${VERSION} workshop: you write layers in the workshop's indentation language, and nothing else.

THE LANGUAGE (the seven gestures, explained step by step in the workshop's tutorial):
- "layer <name>" opens a layer; "refines @<layer>" declares a parent, "then @<other>" chains the unions of parents.
- Blocks open by indentation: "specification" (the type declarations), the collections (places, transitions, arcs…), "tests".
- Inside a block, a member is written "<key> refines @<absolute-path>"; "@" designates an absolute path "@<layer>/<path>/<target>" (a single segment cites a whole layer — the citation).
- The acts: "extend <block>" (the parent already carries the key), "override <slot> = <value>" (lays a value again), "abstract <slot>" (open slot without value), "bind <slot> = @<address>" (binds a slot to an address), "check <label>, <label>" (domain check), a value "slot = <value>" (number, "string", @reference).
- A "// comment" line before a key becomes a note: it travels with the block.
- "extend <collection> refines @<window1> then @<window2> then …" expands citations: the members land qualified, the data stays in the template.

THE TESTS CONTRACT: the expected-reads contract travels with the layer, in a "tests" block:
- "expect <path>/<key> = <value>" — the read must return exactly this value; "expect <path>/<key> absent" — the read must return null; an expected reference is written "expect <path>/<key> = @<layer>/<path>".
- The contract's words (tests, expect, absent) are written in English.

THE PROTOCOL: you propose the draft, never the truth. An expectation is never invented to please: expectations are measured, they are not guessed. Measure (or ask to measure) before writing an expect; what is measured is not what is desired.

YOUR PROPOSALS ARE VERIFIED: every proposal is judged by the workshop's staging (step "syntax", verdicts "unknown-target", "expectation-betrayed", "implicit-overload"…). If a refusal is sent back to you, it carries the verdicts of your proposal — correct it and propose the complete layer again.

Answer only with the layer or layers in the language, without code fencing, without explanation.`;

/** The geologist's instructions in the workshop language — English
 * for now (ADR-0113); the signature stays so a French text can return
 * as pure content. */
export function penInstructions(language: "en" | "fr" = "en"): string {
  void language;
  return PEN_INSTRUCTIONS_EN;
}
