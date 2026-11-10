// The application assembly of the layered data kernel.
//
// The kernel corpus is the bedrock: one `.ld` file per layer, all read
// in a fixed order. The assembly itself is order-neutral for the
// space (desugaring sorts topologically), the order only fixes the
// workshop layer list — and, for byte-identical dumps, the join
// order of the source text. ADR-0109 retired the check-registry layer:
// first-order checks carry their formula inline; the algorithmic tags
// keep a built-in contract in the kernel.

import { type LayerName, asLayerName } from "../domain/identifiers.ts";
import { Space } from "../domain/space.ts";
import { type ParsedLanguage, parseLanguage } from "../domain/language/parser.ts";
import { type CompiledLanguage, compileLanguage } from "../domain/language/compiler.ts";
import { type ValidationOutcome, validateSpace } from "../domain/validation.ts";

// The bedrock layer order: also the layer list of the workshop.
export const KERNEL_LAYER_NAMES: LayerName[] = [
  "record",
  "collection",
  "positions-scheme",
  "positions-grid",
  "positions-polar",
  "multihypergraph",
  "hypergraph",
  "uniform-hypergraph",
  "named-ends-hypergraph",
  "pair-graph",
  "graph",
  "graph-with-positions",
  "multidigraph",
  "digraph",
  "oriented-graph",
  "dag",
  "tree",
  "sperner-hypergraph",
  "k-partite-hypergraph",
  "mixed-graph",
  "bipartite-digraph",
  "vertex-annotated-hypergraph",
  "edge-annotated-hypergraph",
  "weighted-hypergraph",
  "weighted-bipartite",
  "petrinet-scheme",
  "pn-philosophers",
  "pn-philosophers-1",
  "pn-philosophers-5",
  "pn-philosophers-5-bounds",
  "pn-philosophers-5-bounds-c1",
  "wb1",
  "automaton-scheme",
  "petrinet-behavior",
  "petrinet-statespace",
  "ss-pn-philosophers-5",
  "ss-pn-philosophers-5-inst",
  "kahn-scheme",
  "graph-display",
  "petrinet-display",
  "kahn-display",
  "view-scheme",
  "petrinet-view",
  "pn-philosophers-5-course",
  "kahn-course",
  "wb-course",
].map(asLayerName);

/** The whole kernel, assembled and validated: what the workshop and
 * the harness both consume. The validation outcome is computed at
 * assembly time — its reads happen before any consumer reads, which
 * is observable in the diagnostics channel. */
export interface LayeredDataKernel {
  space: Space;
  parsedLanguage: ParsedLanguage;
  compiledLanguage: CompiledLanguage;
  layerNames: LayerName[];
  /** The joined layer sources, in assembly order — the staging pass
   * extends this text when a draft is judged. */
  languageSource: string;
  validation: ValidationOutcome;
}

/** Assemble the kernel from raw layer sources, keyed by layer name.
 * Every source ends with exactly one newline — the join is part of
 * the observable compilation input. A missing layer is a build
 * error: the corpus is the single source, never an embedded copy. */
export function assembleLayeredDataKernel({
  layerSources,
}: {
  layerSources: Readonly<Record<string, string>>;
}): LayeredDataKernel {
  return assembleCorpusKernel({ layerSources, layerNames: KERNEL_LAYER_NAMES });
}

// The tutorial corpus: a dedicated, simpler hierarchy — ten layers,
// beside the kernel corpus. The two chains the tutorial walks
// (graph → petrinet → philosophers → philosophers-5, and graph →
// automaton → state-space → philosophers-5-state-space) live in
// formalisms/tutorial, never inside the bedrock: the kernel corpus
// keeps its forty-seven layers, the tutorial keeps its ten, and
// the same assembly reads both.
export const TUTORIAL_LAYER_NAMES: LayerName[] = [
  "record",
  "collection",
  "graph",
  "petrinet",
  "philosophers",
  "philosophers-5",
  "automaton",
  "state-space",
  "philosophers-5-state-space",
].map(asLayerName);

/** Assemble the tutorial corpus: the same assembly, the same
 * validation — only the layer list changes. The flattened
 * listings of the tutorial page read this space, never the
 * kernel's. */
export function assembleTutorialKernel({
  layerSources,
}: {
  layerSources: Readonly<Record<string, string>>;
}): LayeredDataKernel {
  return assembleCorpusKernel({ layerSources, layerNames: TUTORIAL_LAYER_NAMES });
}

/** The shared assembly of one corpus: raw sources keyed by layer
 * name, a fixed layer order, one parse, one validation. */
function assembleCorpusKernel({
  layerSources,
  layerNames,
}: {
  layerSources: Readonly<Record<string, string>>;
  layerNames: LayerName[];
}): LayeredDataKernel {
  const readLayerSource = (layerName: string): string => {
    const source = layerSources[layerName];
    if (source === undefined) {
      throw new Error("couche du socle absente du dossier noyau : " + layerName);
    }
    return source.endsWith("\n") ? source : source + "\n";
  };

  const languageSource = layerNames.map(readLayerSource).join("");
  const parsedLanguage = parseLanguage(languageSource);
  const compiledLanguage = compileLanguage(parsedLanguage.layers);
  const space = new Space(compiledLanguage.layers);
  const validation = validateSpace({
    space,
    parse: parsedLanguage,
    compilation: compiledLanguage,
    layerNames,
  });

  return {
    space,
    parsedLanguage,
    compiledLanguage,
    layerNames,
    languageSource,
    validation,
  };
}
