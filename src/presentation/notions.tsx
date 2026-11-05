// The living glossary: one definition per notion, one line — the
// tutorial prose carries its notions in ⟪…⟫ markers, the renderer
// swaps them for tooltips, and the full list closes the page.
// Defining is no longer a chapter: it is a gesture. Every entry is
// bilingual: the id stays stable (the historic French key), the
// term and the definition speak both workshop languages.

import React, { useState } from "react";
import type { Language } from "../domain/messages.ts";
import { localized, type BilingualText } from "./i18n.ts";

/** One glossary entry: the term and its one-line definition, in
 * both workshop languages. */
export interface GlossaryEntry {
  term: BilingualText;
  definition: BilingualText;
}

export const GLOSSARY: Record<string, GlossaryEntry> = {
  adresse: {
    term: { en: "address", fr: "adresse" },
    definition: {
      en: "a pair (layer, path) — pn-philosophers-1::pre_arcs::pt1::weight ; the path is relative to the named layer.",
      fr: "un couple (couche, chemin) — pn-philosophers-1::pre_arcs::pt1::weight ; le chemin est relatif à la couche nommée.",
    },
  },
  alias: {
    term: { en: "alias", fr: "alias" },
    definition: {
      en: "the freedom to name the same content by several addresses (ex. vertices as a union); the price: the same defect is reported at every address that designates it.",
      fr: "la liberté de nommer un même contenu par plusieurs adresses (ex. vertices comme union) ; le prix : un même défaut est rapporté à chaque adresse qui le désigne.",
    },
  },
  carottage: {
    term: { en: "core sample", fr: "carottage" },
    definition: {
      en: "the reading of an address: the traversal of its closure, from the newest to the oldest layer.",
      fr: "la lecture d'une adresse : la traversée de sa fermeture, de la plus récente à la plus ancienne couche.",
    },
  },
  carrière: {
    term: { en: "quarry", fr: "carrière" },
    definition: {
      en: "the disk store of the layers: one file per formalism, the bedrock read-only, the visitors' layers visible to all; every entry passes through the staging — the disk never bypasses the contract.",
      fr: "le magasin des couches sur disque : un fichier par formalisme, le socle en lecture seule, les couches des visiteurs visibles de tous ; toute entrée passe par le staging — le disque ne contourne jamais le contrat.",
    },
  },
  check: {
    term: { en: "check", fr: "check" },
    definition: {
      en: "a domain verification (cycles, duplicates, cardinalities) written as a data tag carried by a layer; the kernel is never modified for a formalism.",
      fr: "une vérification de domaine (cycles, doublons, cardinalités) écrite comme une étiquette de données portée par une couche ; le noyau n'est jamais modifié pour un formalisme.",
    },
  },
  citation: {
    term: { en: "citation", fr: "citation" },
    definition: {
      en: "a member that refines a window of another layer (ex. philo2 refines @pn-philosophers-1); the engine expands, the members land qualified, the data stays in the template.",
      fr: "un membre qui raffine une fenêtre d'une autre couche (ex. philo2 refines @pn-philosophers-1) ; le moteur développe, les membres atterrissent qualifiés, la donnée reste dans le template.",
    },
  },
  "clé": {
    term: { en: "key", fr: "clé" },
    definition: {
      en: "a relative designation: local to its collection, in the current layer only — as opposed to the Ref.",
      fr: "une désignation relative : locale à sa collection, dans la couche courante uniquement — par opposition au Ref.",
    },
  },
  "colonne stratigraphique": {
    term: { en: "stratigraphic column", fr: "colonne stratigraphique" },
    definition: {
      en: "the chain of layers that carries the tutorial's thread, from multihypergraph to ss-pn-philosophers-5-inst.",
      fr: "la chaîne de couches qui porte le fil du tutoriel, de multihypergraph à ss-pn-philosophers-5-inst.",
    },
  },
  "conflit d'ordre": {
    term: { en: "order conflict", fr: "conflit d'ordre" },
    definition: {
      en: "a leaf value decided between incomparable sources: the refines order, a convention — visible as a lint diagnostic, refused in strict staging; nothing signs it (ADR-0023), to resolve it is to restructure.",
      fr: "une valeur feuille tranchée entre sources incomparables : l'ordre des refines, une convention — visible en diagnostic de linter, refusée en staging strict ; rien ne la signe (ADR-0023), la résoudre, c'est restructurer.",
    },
  },
  contrainte: {
    term: { en: "constraint", fr: "contrainte" },
    definition: {
      en: "a value laid at the declaration level (ex. arc_type weight = 1 in pn-philosophers), which descends by inheritance — not a separate write.",
      fr: "une valeur posée au niveau de la déclaration (ex. arc_type weight = 1 dans pn-philosophers), qui descend par héritage — pas une écriture séparée.",
    },
  },
  contrat: {
    term: { en: "contract", fr: "contrat" },
    definition: {
      en: "the tests block of a layer: each expect freezes an expected read; the validation replays it, a betrayed read refuses the assembly.",
      fr: "le bloc tests d'une couche : chaque expect gèle une lecture attendue ; la validation le rejoue, une lecture trahie refuse l'assemblage.",
    },
  },
  continuum: {
    term: { en: "continuum", fr: "continuum" },
    definition: {
      en: "formalisms and models are layers; there is no separate instancing operation — to instance is to cite.",
      fr: "formalismes et modèles sont des couches ; il n'existe pas d'opération d'instanciation à part — instancier, c'est citer.",
    },
  },
  contenus: {
    term: { en: "contents", fr: "contenus" },
    definition: {
      en: "what lives outside specification: the concrete collections (the former instance).",
      fr: "ce qui vit hors de specification : les collections concrètes (l'ancienne instance).",
    },
  },
  couche: {
    term: { en: "layer", fr: "couche" },
    definition: {
      en: "a named stratum of data, which refines zero, one or several other layers.",
      fr: "une strate de données nommée, qui raffine zéro, une ou plusieurs autres couches.",
    },
  },
  diamant: {
    term: { en: "diamond", fr: "diamant" },
    definition: {
      en: "a junction layer that composes several facets and declares nothing of its own (ex. weighted-bipartite).",
      fr: "une couche de jonction qui compose plusieurs facettes et ne déclare rien en propre (ex. weighted-bipartite).",
    },
  },
  facette: {
    term: { en: "facet", fr: "facette" },
    definition: {
      en: "a thin layer that carries a single characteristic (annotation, arity, partition, weighting…), combined by multiple inheritance; petrinet-scheme is three crossed facets.",
      fr: "une couche fine qui porte une seule caractéristique (annotation, arité, partition, pondération…), combinée par héritage multiple ; petrinet-scheme est trois facettes croisées.",
    },
  },
  fermeture: {
    term: { en: "closure", fr: "fermeture" },
    definition: {
      en: "the ordered list of all the nodes that define an address: itself, then each ancestor via refines.",
      fr: "la liste ordonnée de tous les nœuds qui définissent une adresse : soi-même, puis chaque ancêtre via refines.",
    },
  },
  "géologue": {
    term: { en: "geologist", fr: "géologue" },
    definition: {
      en: "the AI layer-writer of the workshop: it proposes drafts, the staging judges them; it never applies anything, and an expectation is measured, never invented.",
      fr: "le rédacteur IA de l'atelier : il propose des brouillons, le staging les juge ; il n'applique jamais rien, et un attendu se mesure, il ne s'invente pas.",
    },
  },
  "hériter": {
    term: { en: "inherit", fr: "hériter" },
    definition: {
      en: "laying nothing oneself: the value read is an ancestor's.",
      fr: "ne rien poser soi-même : la valeur lue est celle d'un ancêtre.",
    },
  },
  implicits: {
    term: { en: "implicits", fr: "implicits" },
    definition: {
      en: "the rules of the schema (ex. « each collection has a type ») copied onto the instances at desugaring time; a mute task still inherits its type.",
      fr: "les règles du schéma (ex. « chaque collection a un type ») recopiées sur les instances au moment du désucrage ; une tâche muette hérite quand même de son type.",
    },
  },
  lentille: {
    term: { en: "lens", fr: "lentille" },
    definition: {
      en: "a rendering layer (ex. petrinet-display) that draws for all its descendants; templates laid at the same paths as the types.",
      fr: "une couche de rendu (ex. petrinet-display) qui dessine pour tous ses descendants ; gabarits posés aux mêmes chemins que les types.",
    },
  },
  "liaison tardive": {
    term: { en: "late binding", fr: "liaison tardive" },
    definition: {
      en: "a Ref can aim at a path that does not exist yet (ex. the petrinet parameter, laid lower in the stack); the resolution happens in the reading layer.",
      fr: "un Ref peut viser un chemin qui n'existe pas encore (ex. le paramètre petrinet, posé plus bas dans la pile) ; la résolution se fait dans la couche lisante.",
    },
  },
  linter: {
    term: { en: "linter", fr: "linter" },
    definition: {
      en: "the structural verifier of the space (dead references, embeddings, inert late bindings); blind to designations by keys.",
      fr: "le vérificateur structurel de l'espace (références mortes, plongements, liaisons tardives inertes) ; aveugle aux désignations par clés.",
    },
  },
  "paramètre": {
    term: { en: "parameter", fr: "paramètre" },
    definition: {
      en: "a slot whose value is laid by a descending layer (ex. ss-pn-philosophers-5 lays petrinet = pn-philosophers-5).",
      fr: "un slot dont la valeur est posée par une couche descendante (ex. ss-pn-philosophers-5 pose petrinet = pn-philosophers-5).",
    },
  },
  "point de vue": {
    term: { en: "viewpoint", fr: "point de vue" },
    definition: {
      en: "a layer that binds a looked-at model, a lens and a reading level (zoom); the positions are decisions of the viewpoint.",
      fr: "une couche qui lie un modèle regardé, une lentille et un niveau de lecture (zoom) ; les positions sont des décisions du point de vue.",
    },
  },
  "poids (weight)": {
    term: { en: "weight", fr: "poids (weight)" },
    definition: {
      en: "the annotation of a Petri net's arcs: the W of the standard definition; default 1, laid at the type level by pn-philosophers.",
      fr: "l'annotation des arcs d'un réseau de Petri : le W de la définition standard ; défaut 1, posé au niveau du type par pn-philosophers.",
    },
  },
  "premier-gagné": {
    term: { en: "first-wins", fr: "premier-gagné" },
    definition: {
      en: "the kernel returns the first value found in the closure; the order of the refines encodes the specificity.",
      fr: "le noyau rend la première valeur trouvée dans la fermeture ; l'ordre des refines encode la spécificité.",
    },
  },
  raffine: {
    term: { en: "refines", fr: "raffine" },
    definition: {
      en: "declaring one's parents by the refines act — the inheritance between layers or between types; the specific refines the generic.",
      fr: "déclarer ses parents par l'acte refines — l'héritage entre couches ou entre types ; le spécifique raffine le générique.",
    },
  },
  Ref: {
    term: { en: "Ref", fr: "Ref" },
    definition: {
      en: "a designation by absolute path (@layer/path), across the layers (late binding); a single-segment path cites a whole layer.",
      fr: "une désignation par chemin absolu (@couche/chemin), à travers les couches (liaison tardive) ; un chemin d'un seul segment cite une couche entière.",
    },
  },
  registre: {
    term: { en: "registry", fr: "registre" },
    definition: {
      en: "the nominal table of the checks: each tag declares its contract — where it judges, and which slots it must read to be able to (ADR-0018); a check carried but unable to judge is refused as check vacant. Since ADR-0019 the table is carried by the language itself: the layer check-registry declares the contracts, and existence in the registry is existence in the data.",
      fr: "la table nominale des checks : chaque étiquette y déclare son contrat — où elle juge, et quels slots il lui faut lire pour pouvoir (ADR-0018) ; un check porté mais incapable de juger est refusé comme check vacant. Depuis l'ADR-0019, la table est portée par le langage lui-même : la couche check-registry déclare les contrats, et exister dans le registre, c'est exister dans les données.",
    },
  },
  specification: {
    term: { en: "specification", fr: "specification" },
    definition: {
      en: "the sub-tree of a layer where the type declarations live (the former schema).",
      fr: "la sous-arborescence d'une couche où vivent les déclarations de types (l'ancien schéma).",
    },
  },
  slot: {
    term: { en: "slot", fr: "slot" },
    definition: {
      en: "the formal name a generic check reads (edges, arrows, arrow-vertex, end-source…): the layers bind it (bind), first-winner across the closure — a renaming rebinds the slot, the check follows the view.",
      fr: "le nom formel qu'un check générique lit (edges, arrows, arrow-vertex, end-source…) : les couches le lient (bind), premier-gagné à travers la fermeture — un renommage re-lie le slot, le check suit la vue.",
    },
  },
  socle: {
    term: { en: "bedrock", fr: "socle" },
    definition: {
      en: "the kernel's 47 shipped layers, read-only by protocol (ADR-0020): a draft may refine them, never replace or edit them — the UI filter and the HTTP 403 are conveniences over the protocol's own rule.",
      fr: "les 47 couches livrées par le noyau, en lecture seule par protocole (ADR-0020) : un brouillon peut les raffiner, jamais les remplacer ni les éditer — le filtre de l'interface et le 403 HTTP sont des commodités par-dessus la règle du protocole lui-même.",
    },
  },
  surcharger: {
    term: { en: "override", fr: "surcharger" },
    definition: {
      en: "laying a value locally: it wins against all the ancestors.",
      fr: "poser une valeur localement : elle gagne contre tous les ancêtres.",
    },
  },
  union: {
    term: { en: "union", fr: "union" },
    definition: {
      en: "a collection that merges other collections (the then act); membership is the enumeration, deduplicated first-wins.",
      fr: "une collection qui fusionne d'autres collections (l'acte then) ; l'appartenance est l'énumération, avec déduplication premier-gagné.",
    },
  },
};

/** The glossary ids, in declaration order. */
export function glossaryIds(): string[] {
  return Object.keys(GLOSSARY);
}

/** The glossary id behind a term as the prose writes it — the
 * markers carry the term in the prose's own language, sometimes
 * capitalized; the resolution is case-insensitive. */
export function glossaryIdOfTerm({ term, language }: { term: string; language: Language }): string | null {
  const sought = term.toLowerCase();
  for (const id of glossaryIds()) {
    const entry = GLOSSARY[id];
    if (
      entry.term.en.toLowerCase() === sought ||
      entry.term.fr.toLowerCase() === sought ||
      id.toLowerCase() === sought
    ) {
      return id;
    }
  }
  return null;
}

// the tooltip: a dotted-underline word, its definition on hover —
// pure reading, never derived state
export function NotionTip({
  term,
  language,
  children,
}: {
  term: string;
  language: Language;
  children?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const id = glossaryIdOfTerm({ term, language });
  const entry = id === null ? null : GLOSSARY[id];
  if (entry === null) return <span>{children ?? term}</span>;
  const termText = localized({ language, text: entry.term });
  const definition = localized({ language, text: entry.definition });
  return (
    <span
      className="relative inline-block"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <span className="cursor-help font-semibold text-slate-800 underline decoration-dotted decoration-sky-500 underline-offset-2">
        {children ?? termText}
      </span>
      {open && (
        <span className="absolute bottom-full left-1/2 z-30 mb-1 block w-64 -translate-x-1/2 rounded-md border border-slate-600 bg-slate-800 px-2 py-1.5 text-[10px] font-normal leading-4 text-slate-50 shadow-lg">
          {definition}
        </span>
      )}
    </span>
  );
}

// the tutorial prose carries its notions in ⟪…⟫ — the renderer
// swaps them for tooltips, the rest stays plain text
export function NotionText({ text, language }: { text: string; language: Language }) {
  const chunks = text.split(/(⟪[^⟫]*⟫)/g);
  return (
    <>
      {chunks.map((chunk, index) => {
        const notionMatch = chunk.match(/^⟪([^⟫]*)⟫$/);
        if (notionMatch) {
          return <NotionTip key={index} term={notionMatch[1]} language={language} />;
        }
        return <span key={index}>{chunk}</span>;
      })}
    </>
  );
}
