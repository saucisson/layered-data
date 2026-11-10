// ② "The formalism": three tabs — Language (the colored source), Raw
// (what the layer stores), Flattened (the formalism without
// hierarchy + copyable dump) — three readings of the same layer,
// in step with the navigation; the language is used everywhere in
// the workshop. The contract tests fold and the diagnostics fold
// live here: the verdicts and recorded silences are read at the
// formalism, not at the end of the page.

import { useMemo, useState } from "react";
import type { LayeredDataKernel } from "../application/corpus.ts";
import { asLayerName } from "../domain/identifiers.ts";
import type { Language } from "../domain/messages.ts";
import { RawLayerExplorer } from "./rawExplorer.tsx";
import { LayerSourceView, type SourceLineTarget } from "./layerSourceView.tsx";
import { FlatView } from "./flatView.tsx";
import { LayerContractTests } from "./contractTests.tsx";
import { DiagnosticsPanel } from "./diagnosticsPanel.tsx";
import { say, type BilingualText } from "./i18n.ts";

type FormalismTab = "language" | "raw" | "flattened";

export function FormalismPanel({
  kernel,
  layer,
  addedLayerSources,
  sourceLineTargets,
  onPick,
  onLine,
  language,
}: {
  kernel: LayeredDataKernel;
  layer: string;
  addedLayerSources: Record<string, string>;
  sourceLineTargets: Map<number, SourceLineTarget>;
  onPick: (layer: string, path: string[]) => void;
  onLine: (target: SourceLineTarget) => void;
  language: Language;
}) {
  const [activeTab, setActiveTab] = useState<FormalismTab>("language");
  const tabs: [FormalismTab, BilingualText][] = [
    ["language", { en: "Language", fr: "Langage" }],
    ["raw", { en: "Raw", fr: "Brut" }],
    ["flattened", { en: "Flattened", fr: "Aplati" }],
  ];
  const parsedLayer = useMemo(
    () => kernel.parsedLanguage.layers.find((candidate) => candidate.name === layer) ?? null,
    [kernel, layer],
  );
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-bold text-slate-800">
          {say({ language, en: "② The formalism", fr: "② Le formalisme" })}
          <span className="ml-1 font-mono text-xs font-normal text-slate-400">{layer}</span>
        </h2>
        <div className="flex gap-1">
          {tabs.map(([tab, label]) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={
                "rounded-md px-2.5 py-1 text-[11px] font-semibold " +
                (tab === activeTab
                  ? "bg-slate-800 text-white"
                  : "border border-slate-300 bg-white text-slate-600 hover:border-slate-600")
              }
            >
              {say({ language, en: label.en, fr: label.fr })}
            </button>
          ))}
        </div>
      </div>
      {activeTab === "language" && (
        <LayerSourceView
          layer={layer}
          languageSource={kernel.languageSource}
          addedLayerSources={addedLayerSources}
          parsedLayer={parsedLayer}
          sourceLineTargets={sourceLineTargets}
          onLine={onLine}
          language={language}
        />
      )}
      {activeTab === "raw" && (
        <>
          <p className="mb-2 text-[10px] leading-4 text-slate-400">
            {say({
              language,
              en: "What the layer actually stores — no more, no less. The amber keys (refines, specification) are structural.",
              fr: "Ce que la couche stocke réellement — ni plus, ni moins. Les clés ambrées (refines, specification) sont structurelles.",
            })}
          </p>
          <RawLayerExplorer space={kernel.space} layer={asLayerName(layer)} language={language} />
        </>
      )}
      {activeTab === "flattened" && (
        <FlatView space={kernel.space} layer={layer} onPick={onPick} language={language} />
      )}
      <LayerContractTests space={kernel.space} layer={layer} language={language} />
      <DiagnosticsPanel
        space={kernel.space}
        layerNames={kernel.layerNames}
        compilation={kernel.compiledLanguage}
        validation={kernel.validation}
        language={language}
      />
    </div>
  );
}
