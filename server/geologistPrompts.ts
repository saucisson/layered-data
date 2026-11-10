// ============================================================
// Layered Data — the AI geologist's grounding prompts
//
// The geologist writes layers; to be pertinent it must not guess
// what already exists. The system prompt embeds, rebuilt at each
// call: the manifesto of the model, the stratigraphic column (one
// line per layer, read from the disk so layers written seconds ago
// are known), and one complete example of the corpus.
// ============================================================
import { readFileSync } from "node:fs";

import { VERSION, USERS_DIRECTORY } from "./config.ts";
import {
  KERNEL_LAYER_NAMES,
  kernelLayerPath,
  userLayerPath,
  listLayerNames,
  type LayerName,
} from "./layerStore.ts";

// ------------------------------------------------------------
export const MANIFESTO = `CE QU'EST LAYERED DATA — les définitions elles-mêmes sont des données.
Tout est couche : les formalismes (les schémas) et les modèles (les données) vivent dans le même espace, adressables, raffinables, héritants — pas de séparation schéma/instance.
- Une couche en raffine d'autres (héritage multiple, ordonné par "then") ; un membre hérite de ses parents par "refines @<chemin>".
- La lecture est un carottage premier-gagné : la chaîne de raffinement se suit de la plus concrète à la plus abstraite, la première source qui porte la clé gagne, les suivantes ne sont même pas consultées.
- Instancier, c'est citer : un membre peut citer une couche entière (@couche) ; "extend <bloc> refines @<fenêtre> then @<fenêtre> …" développe les citations en membres qualifiés, la donnée reste dans le template.
- Le rendu est une lentille : une couche d'affichage (graph-display, petrinet-display…) raffine le formalisme et dessine tout ce qui en descend.

LA COLONNE STRATIGRAPHIQUE CI-DESSOUS EST L'ÉTAT RÉEL DE L'ATELIER — un nouveau formalisme s'y raccroche : raffiner une couche existante (chemins absolus vers ses membres), jamais redéfinir ce qui existe.`;

/** One line per existing layer: the `layer …` header as written.
 * Reading the files at each call keeps the column true — the
 * kernel and the visitors' layers alike. */
export function corpusBackbone(): string {
  const lines: string[] = [];
  for (const name of KERNEL_LAYER_NAMES) {
    const source = readFileSync(kernelLayerPath({ name: name as LayerName }), "utf8");
    const header = source.split("\n").find((line) => line.startsWith("layer "));
    lines.push(header ?? "layer " + name);
  }
  for (const name of listLayerNames({ directory: USERS_DIRECTORY })) {
    const source = readFileSync(userLayerPath({ name: name as LayerName }), "utf8");
    const header = source.split("\n").find((line) => line.startsWith("layer "));
    lines.push(header ?? "layer " + name + "  // couche d'un visiteur");
  }
  return lines.join("\n");
}

/** The complete system prompt sent to the model. */
export function buildSystemPrompt(): string {
  let example = "";
  if (KERNEL_LAYER_NAMES.includes("pn-philosophers-1")) {
    example =
      "UN EXEMPLE COMPLET DU CORPUS — pn-philosophers-1, le modèle d'un philosophe seul (il remplit les collections du schéma pn-philosophers, ses membres raffinent les types par chemin absolu, les arcs désignent leurs extrémités par @) :\n" +
      readFileSync(kernelLayerPath({ name: "pn-philosophers-1" as LayerName }), "utf8").trim();
  }
  const visitorLayerNames = listLayerNames({ directory: USERS_DIRECTORY });
  const visitorLayers =
    visitorLayerNames.length > 0
      ? "\n\nLES COUCHES DES VISITEURS (sources complètes — un nouveau formalisme peut les raffiner ou les citer) :\n" +
        visitorLayerNames
          .sort()
          .map((name) => readFileSync(userLayerPath({ name: name as LayerName }), "utf8").trim())
          .join("\n\n")
      : "";
  return (
    penInstructions("en") +
    "\n\n" +
    MANIFESTO +
    "\n\nLA COLONNE STRATIGRAPHIQUE (une ligne par couche — " +
    KERNEL_LAYER_NAMES.length +
    " du socle en lecture seule, plus les couches des visiteurs) :\n" +
    corpusBackbone() +
    "\n\n" +
    example +
    visitorLayers
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

export const PEN_INSTRUCTIONS_FR = `Tu es le géologue de l'atelier Layered Data v${VERSION} : tu écris des couches dans le langage à indentation de l'atelier, et rien d'autre.

LE LANGAGE (les sept gestes, expliqués pas-à-pas dans le tutoriel de l'atelier) :
- "layer <nom>" ouvre une couche ; "refines @<couche>" déclare un parent, "then @<autre>" enchaîne les unions de parents.
- Les blocs s'ouvrent par indentation : "specification" (les déclarations de types), les collections (places, transitions, arcs…), "tests".
- Dans un bloc, un membre s'écrit "<clé> refines @<chemin-absolu>" ; "@" désigne un chemin absolu "@<couche>/<chemin>/<cible>" (un seul segment cite une couche entière — la citation).
- Les actes : "extend <bloc>" (le parent porte déjà la clé), "override <slot> = <valeur>" (repose une valeur), "abstract <slot>" (slot ouvert sans valeur), "bind <slot> = @<adresse>" (lie un slot à une adresse), "check <étiquette>, <étiquette>" (vérification de domaine), une valeur "slot = <valeur>" (nombre, "chaîne", @référence).
- Une ligne "// commentaire" avant une clé devient une note : elle voyage avec le bloc.
- "extend <collection> refines @<fenêtre1> then @<fenêtre2> then …" développe des citations : les membres atterrissent qualifiés, la donnée reste dans le template.

LE CONTRAT DE TESTS : le contrat de lectures attendues voyage avec la couche, dans un bloc "tests" :
- "expect <chemin>/<clé> = <valeur>" — la lecture doit rendre exactement cette valeur ; "expect <chemin>/<clé> absent" — la lecture doit rendre null ; une référence attendue s'écrit "expect <chemin>/<clé> = @<couche>/<chemin>".
- Les mots du contrat (tests, expect, absent) s'écrivent en anglais.

LE PROTOCOLE : tu proposes le brouillon, jamais la vérité. Un attendu n'est jamais inventé pour faire plaisir : les attendus se mesurent, ils ne se devinent pas. Mesure (ou demande de mesurer) avant d'écrire un expect ; ce qui est mesuré n'est pas ce qui est désiré.

TES PROPOSITIONS SONT VÉRIFIÉES : chaque proposition est jugée par le staging de l'atelier (étape « syntaxe », verdicts « cible-inconnue », « attendu-trahi », « surcharge-implicite »…). Si un refus t'est renvoyé, il porte les verdicts de ta proposition — corrige-la et repose la couche complète.

Réponds uniquement avec la ou les couches en langage, sans enceinte de code, sans explication.`;

/** The geologist's instructions in the workshop language — English is
 * the default, French its mirror; both follow VERSION. */
export function penInstructions(language: "en" | "fr" = "en"): string {
  return language === "fr" ? PEN_INSTRUCTIONS_FR : PEN_INSTRUCTIONS_EN;
}
