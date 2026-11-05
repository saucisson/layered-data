// The application assembly of the layered data kernel.
//
// The kernel corpus is the bedrock: one `.ld` file per layer, all read
// in a fixed order. The assembly itself is order-neutral for the
// space (desugaring sorts topologically), the order only fixes the
// workshop layer list — and, for byte-identical dumps, the join
// order of the source text. The bedrock carries its own meta-model
// since ADR-0019: the `check-registry` layer stands beside the
// corpus (no refinement — the meta-model descends from nothing),
// and the checks' contracts are read from it.

import { type LayerName, asLayerName } from "../domain/identifiers.ts";
import { Space } from "../domain/space.ts";
import { type ParsedLanguage, parseLanguage } from "../domain/language/parser.ts";
import { type CompiledLanguage, compileLanguage } from "../domain/language/compiler.ts";
import { type ValidationOutcome, validateSpace } from "../domain/validation.ts";

// The bedrock layer order: also the layer list of the workshop.
export const KERNEL_LAYER_NAMES: LayerName[] = [
  "record",
  "check-registry",
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
  const readLayerSource = (layerName: string): string => {
    const source = layerSources[layerName];
    if (source === undefined) {
      throw new Error("couche du socle absente du dossier noyau : " + layerName);
    }
    return source.endsWith("\n") ? source : source + "\n";
  };

  const languageSource = KERNEL_LAYER_NAMES.map(readLayerSource).join("");
  const parsedLanguage = parseLanguage(languageSource);
  const compiledLanguage = compileLanguage(parsedLanguage.layers);
  const space = new Space(compiledLanguage.layers);
  const validation = validateSpace({
    space,
    parse: parsedLanguage,
    compilation: compiledLanguage,
    layerNames: KERNEL_LAYER_NAMES,
  });

  return {
    space,
    parsedLanguage,
    compiledLanguage,
    layerNames: KERNEL_LAYER_NAMES,
    languageSource,
    validation,
  };
}
