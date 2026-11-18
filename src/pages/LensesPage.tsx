// The lenses page (issue #227): a dedicated top-level tab for the
// lenses and viewpoints, out of the workshop. The page owns the state
// the old panel ④ borrowed from the workshop: the model layer, the
// chosen look, the selected glyph.

import { useMemo, useState } from "react";
import { useRouter } from "../components/Router.tsx";
import { NotionText } from "../presentation/notions.tsx";
import { WIDE_WIDTH } from "../components/PageShell.tsx";
import { assembleLayeredDataKernel } from "../application/corpus.ts";
import { loadKernelLayerSources } from "../infrastructure/corpusLoader.ts";
import { asLayerName } from "../domain/identifiers.ts";
import type { Language } from "../domain/messages.ts";
import { say } from "../presentation/i18n.ts";
import { buildWorkshopLook } from "../presentation/lensDrawing.ts";
import { ViewpointPanel } from "../presentation/viewpointPanel.tsx";
import type { SelectedGlyph } from "../presentation/workshop/workshopKernel.ts";

const KERNEL = assembleLayeredDataKernel({ layerSources: loadKernelLayerSources() });

// The look chosen by default — the dinner course.
const DEFAULT_VIEW = "pn-philosophers-5-course";

export function LensesPage({ language }: { language: Language }) {
  const { parameter, navigate } = useRouter();
  const layer = KERNEL.layerNames.includes(asLayerName(parameter ?? ""))
    ? asLayerName(parameter ?? "")
    : asLayerName("graph");
  const [selectedView, setSelectedView] = useState(DEFAULT_VIEW);
  const [selectedGlyph, setSelectedGlyph] = useState<SelectedGlyph | null>(null);

  const look = useMemo(
    () => buildWorkshopLook({ space: KERNEL.space, selectedView, currentLayer: layer }),
    [selectedView, layer],
  );

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100">
      <div className={"mx-auto " + WIDE_WIDTH + " p-4 sm:p-6"}>
        <h1 className="mb-4 text-2xl font-bold text-slate-800 dark:text-slate-100">
          {say({ language, en: "Lenses — see a model through a look" })}
        </h1>
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <label className="text-xs text-slate-600 dark:text-slate-400" htmlFor="lenses-model-picker">
            {say({ language, en: "model layer" })}
          </label>
          <select
            id="lenses-model-picker"
            value={layer}
            onChange={(event) => navigate("lenses", event.target.value)}
            className="rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 py-1 font-mono text-xs"
          >
            {KERNEL.layerNames.map((layerName) => (
              <option key={layerName} value={layerName}>
                {layerName}
              </option>
            ))}
          </select>
          <span className="text-[10px] text-slate-500 dark:text-slate-400">
            <NotionText
              language={language}
              text={say({
                language,
                en: "the model is read from the ⟪address⟫ — #lenses/<layer>",
              })}
            />
          </span>
        </div>
        <ViewpointPanel
          language={language}
          kernel={KERNEL}
          look={look}
          selectedView={selectedView}
          onSelectView={setSelectedView}
          selectedGlyph={selectedGlyph}
          onSelectGlyph={setSelectedGlyph}
        />
      </div>
    </div>
  );
}
