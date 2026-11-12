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
    term: { en: "address"},
    definition: {
      en: "a pair (layer, path) — pn-philosophers-1::pre_arcs::pt1::weight ; the path is relative to the named layer.",
    },
  },
  alias: {
    term: { en: "alias"},
    definition: {
      en: "the freedom to name the same content by several addresses (ex. vertices as a union); the price: the same defect is reported at every address that designates it.",
    },
  },
  carottage: {
    term: { en: "core sample"},
    definition: {
      en: "the reading of an address: the traversal of its closure, from the newest to the oldest layer.",
    },
  },
  carrière: {
    term: { en: "quarry"},
    definition: {
      en: "the disk store of the layers: one file per formalism, the bedrock read-only, the visitors' layers visible to all; every entry passes through the staging — the disk never bypasses the contract.",
    },
  },
  check: {
    term: { en: "check"},
    definition: {
      en: "a domain verification (cycles, duplicates, cardinalities) written as a data tag carried by a layer; the kernel is never modified for a formalism.",
    },
  },
  citation: {
    term: { en: "citation"},
    definition: {
      en: "a member that refines a window of another layer (ex. philo2 refines @pn-philosophers-1); the engine expands, the members land qualified, the data stays in the template.",
    },
  },
  clé: {
    term: { en: "key"},
    definition: {
      en: "a relative designation: local to its collection, in the current layer only — as opposed to the Ref.",
    },
  },
  "colonne stratigraphique": {
    term: { en: "stratigraphic column"},
    definition: {
      en: "the chain of layers that carries the tutorial's thread, from multihypergraph to ss-pn-philosophers-5-inst.",
    },
  },
  "conflit d'ordre": {
    term: { en: "order conflict"},
    definition: {
      en: "a leaf value decided between incomparable sources: the refines order, a convention — visible as a lint diagnostic, refused in strict staging; nothing signs it (ADR-0106), to resolve it is to restructure.",
    },
  },
  contrainte: {
    term: { en: "constraint"},
    definition: {
      en: "a value laid at the declaration level (ex. arc_type weight = 1 in pn-philosophers), which descends by inheritance — not a separate write.",
    },
  },
  contrat: {
    term: { en: "contract"},
    definition: {
      en: "the tests block of a layer: each expect freezes an expected read; the validation replays it, a betrayed read refuses the assembly.",
    },
  },
  continuum: {
    term: { en: "continuum"},
    definition: {
      en: "formalisms and models are layers; there is no separate instancing operation — to instance is to cite.",
    },
  },
  contenus: {
    term: { en: "contents"},
    definition: {
      en: "what lives outside specification: the concrete collections (the former instance).",
    },
  },
  couche: {
    term: { en: "layer"},
    definition: {
      en: "a named stratum of data, which refines zero, one or several other layers.",
    },
  },
  diamant: {
    term: { en: "diamond"},
    definition: {
      en: "a junction layer that composes several facets and declares nothing of its own (ex. weighted-bipartite).",
    },
  },
  facette: {
    term: { en: "facet"},
    definition: {
      en: "a thin layer that carries a single characteristic (annotation, arity, partition, weighting…), combined by multiple inheritance; petrinet-scheme is three crossed facets.",
    },
  },
  fermeture: {
    term: { en: "closure"},
    definition: {
      en: "the ordered list of all the nodes that define an address: itself, then each ancestor via refines.",
    },
  },
  géologue: {
    term: { en: "geologist"},
    definition: {
      en: "the AI layer-writer of the workshop: it proposes drafts, the staging judges them; it never applies anything, and an expectation is measured, never invented.",
    },
  },
  hériter: {
    term: { en: "inherit"},
    definition: {
      en: "laying nothing oneself: the value read is an ancestor's.",
    },
  },
  implicits: {
    term: { en: "implicits"},
    definition: {
      en: "the rules of the schema (ex. « each collection has a type ») copied onto the instances at desugaring time; a mute task still inherits its type.",
    },
  },
  lentille: {
    term: { en: "lens"},
    definition: {
      en: "a rendering layer (ex. petrinet-display) that draws for all its descendants; templates laid at the same paths as the types.",
    },
  },
  "liaison tardive": {
    term: { en: "late binding"},
    definition: {
      en: "a Ref can aim at a path that does not exist yet (ex. the petrinet parameter, laid lower in the stack); the resolution happens in the reading layer.",
    },
  },
  linter: {
    term: { en: "linter"},
    definition: {
      en: "the structural verifier of the space (dead references, embeddings, inert late bindings); blind to designations by keys.",
    },
  },
  paramètre: {
    term: { en: "parameter"},
    definition: {
      en: "a slot whose value is laid by a descending layer (ex. ss-pn-philosophers-5 lays petrinet = pn-philosophers-5).",
    },
  },
  "point de vue": {
    term: { en: "viewpoint"},
    definition: {
      en: "a layer that binds a looked-at model, a lens and a reading level (zoom); the positions are decisions of the viewpoint.",
    },
  },
  "poids (weight)": {
    term: { en: "weight"},
    definition: {
      en: "the annotation of a Petri net's arcs: the W of the standard definition; default 1, laid at the type level by pn-philosophers.",
    },
  },
  "premier-gagné": {
    term: { en: "first-wins"},
    definition: {
      en: "the kernel returns the first value found in the closure; the order of the refines encodes the specificity.",
    },
  },
  raffine: {
    term: { en: "refines"},
    definition: {
      en: "declaring one's parents by the refines act — the inheritance between layers or between types; the specific refines the generic.",
    },
  },
  Ref: {
    term: { en: "Ref"},
    definition: {
      en: "a designation by absolute path (@layer/path), across the layers (late binding); a single-segment path cites a whole layer.",
    },
  },
  registre: {
    term: { en: "registry"},
    definition: {
      en: "the checks' contracts: since ADR-0109 the first-order checks carry their formula inline in the language (ADR-0105); the algorithmic tags keep a built-in contract in the kernel. A check carried but unable to judge is refused as check vacant (ADR-0101).",
    },
  },
  specification: {
    term: { en: "specification"},
    definition: {
      en: "the sub-tree of a layer where the type declarations live (the former schema).",
    },
  },
  slot: {
    term: { en: "slot"},
    definition: {
      en: "the formal name a generic check reads (edges, arrows, arrow-vertex, end-source…): the layers bind it (bind), first-winner across the closure — a renaming rebinds the slot, the check follows the view.",
    },
  },
  socle: {
    term: { en: "bedrock"},
    definition: {
      en: "the kernel's 47 shipped layers, read-only by protocol (ADR-0103): a draft may refine them, never replace or edit them — the UI filter and the HTTP 403 are conveniences over the protocol's own rule.",
    },
  },
  surcharger: {
    term: { en: "override"},
    definition: {
      en: "laying a value locally: it wins against all the ancestors.",
    },
  },
  union: {
    term: { en: "union"},
    definition: {
      en: "a collection that merges other collections (the then act); membership is the enumeration, deduplicated first-wins.",
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
export function glossaryIdOfTerm({ term }: { term: string }): string | null {
  const sought = term.toLowerCase();
  for (const id of glossaryIds()) {
    const entry = GLOSSARY[id];
    if (entry === undefined) continue;
    if (
      entry.term.en.toLowerCase() === sought ||
      (entry.term.fr ?? entry.term.en).toLowerCase() === sought ||
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
  const id = glossaryIdOfTerm({ term });
  const entry = id === null ? undefined : GLOSSARY[id];
  if (entry === undefined) return <span>{children ?? term}</span>;
  const termText = localized({ language, text: entry.term });
  const definition = localized({ language, text: entry.definition });
  return (
    <span
      className="relative inline-block"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <span className="cursor-help font-semibold text-slate-800 dark:text-slate-100 underline decoration-dotted decoration-sky-500 underline-offset-2">
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
          return <NotionTip key={index} term={notionMatch[1] ?? ""} language={language} />;
        }
        return <span key={index}>{chunk}</span>;
      })}
    </>
  );
}
