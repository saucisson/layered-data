// The workshop's shared derivations: one kernel assembled from the
// corpus, one refinement graph over it, one line-target table — pure
// derivations of the assembled kernel, computed once at module load.
// The single source, never an embedded copy.

import { assembleLayeredDataKernel } from "../../application/corpus.ts";
import { loadKernelLayerSources } from "../../infrastructure/corpusLoader.ts";
import { RefinementDag } from "../workshopInventory.ts";
import { buildSourceLineTargets } from "../layerSourceView.tsx";

export const KERNEL = assembleLayeredDataKernel({ layerSources: loadKernelLayerSources() });
export const REFINEMENT_DAG = new RefinementDag({ space: KERNEL.space, layerNames: KERNEL.layerNames });
export const SOURCE_LINE_TARGETS = buildSourceLineTargets({ parsedLanguage: KERNEL.parsedLanguage });

/** One entry of the address history: where we were, and which key
 * we were reading there. */
export interface HistoryEntry {
  layer: string;
  path: string[];
  key: string | null;
}

/** One glyph selected in the drawing of ④. */
export interface SelectedGlyph {
  kind: "vertex" | "edge";
  name: string;
}

/** One accepted ＋ addition, kept as workshop state. */
export interface AcceptedAdditionState {
  source: string;
  layerNames: string[];
}
