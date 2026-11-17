// The hierarchy page — the complete refinement graph of the
// workshop, given a whole page. The rendering (wrapped layout, SVG
// curves, pill nodes) is the SHARED RefinementGraph component (issue
// #217), the same one the workshop header uses; this page only adds
// the search, the counts, and the click that opens the formalism page
// on the picked layer — the address is the artifact.

import { useMemo, useState } from "react";
import { useRouter } from "../components/Router";
import { assembleLayeredDataKernel } from "../application/corpus.ts";
import { materializeSessionAdditions } from "../application/session.ts";
import { loadKernelLayerSources } from "../infrastructure/corpusLoader.ts";
import { RefinementDag } from "../presentation/workshopInventory.ts";
import { RefinementGraph } from "../presentation/refinementGraph.tsx";
import { say } from "../presentation/i18n.ts";
import type { Language } from "../domain/messages.ts";

interface HierarchyPageProps {
  language: Language;
}

// The kernel of the page: assembled once from the corpus files.
// The session additions materialize into it at each mount.
const KERNEL = assembleLayeredDataKernel({ layerSources: loadKernelLayerSources() });

export function HierarchyPage({ language }: HierarchyPageProps) {
  const { navigate } = useRouter();
  const session = useMemo(() => materializeSessionAdditions({ kernel: KERNEL }), []);
  const layerNames = session.layerNames;
  const dag = useMemo(() => new RefinementDag({ space: KERNEL.space, layerNames }), [layerNames]);
  const [search, setSearch] = useState("");
  const [hovered, setHovered] = useState<string | null>(null);

  const refinementCount = layerNames.reduce(
    (total, layerName) => total + dag.targetsOf(layerName).length,
    0,
  );
  const generationCount = new Set(layerNames.map((layerName) => dag.rank(layerName))).size;

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100">
      <div className="mx-auto max-w-[95rem] p-4 sm:p-6">
        <h1 className="mb-3 text-2xl font-bold text-slate-800 dark:text-slate-100">
          {say({ language, en: "The hierarchy — the complete refinement graph" })}
        </h1>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={say({ language, en: "search a layer…" })}
            className="min-w-52 flex-1 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-1.5 font-mono text-xs focus:border-slate-500 focus:outline-none"
          />
          <span className="text-[11px] text-slate-600 dark:text-slate-400">
            {layerNames.length + " "}
            {say({
              language,
              en: layerNames.length > 1 ? "layers" : "layer",
            })}
            {" · "}
            {refinementCount + " "}
            {say({
              language,
              en: refinementCount > 1 ? "refinements" : "refinement",
            })}
            {" · "}
            {generationCount + " "}
            {say({ language, en: "generations" })}
          </span>
        </div>

        <div className="overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
          <RefinementGraph
            layerNames={layerNames}
            dag={dag}
            focus={hovered}
            search={search}
            onPick={(layerName) => navigate("formalism", layerName)}
            onHover={setHovered}
            language={language}
          />
        </div>

        <p className="mt-2 text-[11px] leading-4 text-slate-500 dark:text-slate-400">
          {hovered !== null
            ? hovered
            : say({
                language,
                en: "Hover a layer: its closure (upward) and its descendants (downward) come to the front; click it: the formalism page opens on it.",
              })}
          {" — "}
          {say({
            language,
            en: "the shaded bands are the generations (the rank is the longest path towards a base); a solid arrow is one refinement (inheritance), a dashed hollow arrow is one usage (a field citing another layer); the search fades the non-matching layers.",
          })}
        </p>
      </div>
    </div>
  );
}
