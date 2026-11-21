// Panel ① of the workshop: the layers — the refinement graph (or the
// principal-parent list), the ＋ composer, the disk wardrobe and the
// living-layer editor, then panel ② the formalism of the current
// layer. The composer, the wardrobe and the editor are lazy chunks:
// they only load when opened. Pure presentation — the state lives in
// the composition root.

import { lazy, Suspense } from "react";
import type { Language } from "../../domain/messages.ts";
import type { LayeredDataKernel } from "../../application/corpus.ts";
import { LAYER_COLOR, LAYER_ROLE, PRINCIPAL_PARENT, type RefinementDag } from "../workshopInventory.ts";
import { localized, say } from "../i18n.ts";
import { RefinesGraph } from "../refinesGraph.tsx";
import type { AcceptedAddition } from "../addFormalism.tsx";
import type { AppliedEdition } from "../../application/edition.ts";
import type { AcceptedAdditionState } from "./workshopKernel.ts";

// The ＋ flow's tools are separate chunks: they load on first open,
// never with the workshop itself (issue #200).
const AddFormalismComposer = lazy(() =>
  import("../addFormalism.tsx").then((module) => ({ default: module.AddFormalismComposer })),
);
const DiskWardrobe = lazy(() =>
  import("../diskWardrobe.tsx").then((module) => ({ default: module.DiskWardrobe })),
);
const LayerEditor = lazy(() =>
  import("../layerEditor.tsx").then((module) => ({ default: module.LayerEditor })),
);

function PanelToolFallback() {
  return (
    <div className="flex items-center justify-center py-4" aria-busy="true">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-300 border-t-gray-700 dark:border-slate-600 dark:border-t-slate-300" />
    </div>
  );
}

export function WorkshopLayersPanel({
  language,
  kernel,
  dag,
  layer,
  search,
  graphView,
  onGraphViewChange,
  composerOpen,
  onComposerToggle,
  additions,
  livingLayerNames,
  addedLayerBlocks,
  onComposerAdded,
  onWardrobeAdded,
  editorLayer,
  editorInitialSource,
  onEditorApplied,
  onEditorClose,
  onPickLayer,
  closureSet,
  layerMatches,
  editableLayerSet,
  onEditorToggle,
}: {
  language: Language;
  kernel: LayeredDataKernel;
  dag: RefinementDag;
  layer: string;
  search: string;
  graphView: boolean;
  onGraphViewChange: (graphView: boolean) => void;
  composerOpen: boolean;
  onComposerToggle: () => void;
  additions: AcceptedAdditionState[];
  livingLayerNames: string[];
  addedLayerBlocks: Record<string, string>;
  onComposerAdded: (addition: AcceptedAddition) => void;
  onWardrobeAdded: (addition: AcceptedAddition) => void;
  editorLayer: string | null;
  editorInitialSource: string;
  onEditorApplied: (edition: AppliedEdition) => void;
  onEditorClose: () => void;
  onPickLayer: (layerName: string, path: string[], key?: string | null) => void;
  closureSet: Set<string>;
  layerMatches: (layerName: string) => boolean;
  editableLayerSet: Set<string>;
  onEditorToggle: (layerName: string) => void;
}) {
  return (
    <section className="space-y-3" role="region" aria-labelledby="panel-layers-heading">
      <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-3">
        <h2 id="panel-layers-heading" className="mb-2 flex items-center gap-2 text-sm font-bold text-slate-800 dark:text-slate-100">
          {say({ language, en: "① The layers" })}
          <span className="font-normal text-slate-600 dark:text-slate-400">
            {graphView
              ? say({
                  language,
                  en: "the graph of refinements",
                })
              : say({ language, en: "and their raws" })}
          </span>
          <span className="ml-auto flex overflow-hidden rounded border border-slate-300 dark:border-slate-600 text-[10px] leading-4">
            <button type="button"
              onClick={() => onGraphViewChange(false)}
              className={
                "px-2 " +
                (!graphView
                  ? "bg-slate-800 dark:bg-slate-600 text-white"
                  : "bg-white text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 dark:bg-slate-900")
              }
            >
              {say({ language, en: "list" })}
            </button>
            <button type="button"
              onClick={() => onGraphViewChange(true)}
              className={
                "px-2 " +
                (graphView
                  ? "bg-slate-800 dark:bg-slate-600 text-white"
                  : "bg-white text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 dark:bg-slate-900")
              }
            >
              {say({ language, en: "graph" })}
            </button>
          </span>
          <button type="button"
            onClick={onComposerToggle}
            title={say({
              language,
              en:
                "add a formalism — the candidate goes through staging: " +
                "whole corpus + supplements revalidated, 0 assembly verdict demanded",
            })}
            className={
              "ml-1 rounded-full border px-2 text-sm font-bold leading-5 " +
              (composerOpen
                ? "border-emerald-600 bg-emerald-600 dark:bg-emerald-700 text-white"
                : "border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:border-emerald-500 dark:hover:border-emerald-400 hover:text-emerald-600 dark:hover:text-emerald-400")
            }
          >
            ＋
          </button>
        </h2>
        {composerOpen && (
          <div className="space-y-2">
            {/* Sign-in happens from the key button of the site header
                (milestone Auth v1), not here. */}
            <Suspense fallback={<PanelToolFallback />}>
              <AddFormalismComposer
                kernel={kernel}
                language={language}
                livingLayerNames={livingLayerNames}
                previousAdditionSources={additions.map((addition) => addition.source)}
                onAdded={onComposerAdded}
              />
              <DiskWardrobe
                kernel={kernel}
                language={language}
                livingLayerNames={livingLayerNames}
                previousAdditionSources={additions.map((addition) => addition.source)}
                localLayerSources={addedLayerBlocks}
                onAdded={onWardrobeAdded}
              />
            </Suspense>
          </div>
        )}
        {editorLayer !== null && (
          <Suspense fallback={<PanelToolFallback />}>
            <LayerEditor
              kernel={kernel}
              language={language}
              layerName={editorLayer}
              initialSource={editorInitialSource}
              livingAdditions={additions}
              livingLayerNames={livingLayerNames}
              onApplied={onEditorApplied}
              onClose={onEditorClose}
            />
          </Suspense>
        )}
        {graphView ? (
          <RefinesGraph
            layer={layer}
            search={search}
            language={language}
            layerNames={livingLayerNames}
            dag={dag}
            closureSet={closureSet}
            onPick={(layerName) => onPickLayer(layerName, [])}
          />
        ) : (
          <div className="space-y-1" onKeyDown={(event) => {
            if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
            const buttons = Array.from(event.currentTarget.querySelectorAll("button"));
            const currentIndex = buttons.findIndex((button) => button === document.activeElement);
            if (currentIndex === -1) return;
            event.preventDefault();
            const nextIndex = event.key === "ArrowDown"
              ? Math.min(currentIndex + 1, buttons.length - 1)
              : Math.max(currentIndex - 1, 0);
            buttons[nextIndex]?.focus();
          }}>
            {livingLayerNames.filter(layerMatches).length === 0 && (
              <div className="py-2 text-xs text-slate-600 dark:text-slate-400">
                {say({
                  language,
                  en: "No layer matches “ " + search + " ”.",
                })}
              </div>
            )}
            {livingLayerNames.filter(layerMatches).map((layerName) => {
              const depth = (() => {
                let steps = 0;
                let current: string | null = layerName;
                // != null covers undefined: a layer forgotten in
                // PRINCIPAL_PARENT gives a wrong indentation, not
                // an infinite loop.
                while (current != null) {
                  current = PRINCIPAL_PARENT[current] ?? null;
                  steps += 1;
                }
                return steps - 1;
              })();
              const inClosure = closureSet.has(layerName);
              return (
                <div key={layerName} style={{ marginLeft: depth * 10 }}>
                  <div className="flex items-center gap-1">
                    <button type="button"
                      onClick={() => onPickLayer(layerName, [])}
                      title={localized({
                        language,
                        text: LAYER_ROLE[layerName] ?? { en: layerName},
                      })}
                      className={
                        "flex flex-1 items-center gap-2 rounded-md px-2 py-1 text-left text-xs transition-colors " +
                        (layerName === layer
                          ? "bg-slate-100 dark:bg-slate-800 ring-1 ring-slate-400"
                          : "hover:bg-slate-50 dark:hover:bg-slate-700 dark:bg-slate-900") +
                        (inClosure ? " font-semibold" : "")
                      }
                    >
                      <span
                        className={
                          "h-2.5 w-2.5 shrink-0 rounded-full " + LAYER_COLOR[layerName]
                        }
                      />
                      <span>
                        {layerName}
                        <span
                          title={say({
                            language,
                            en: "in the closure of the current address (③)",
                          })}
                          className="ml-1 text-[10px] text-slate-600 dark:text-slate-400"
                        >
                          {inClosure ? "•" : ""}
                        </span>
                      </span>
                    </button>
                    {editableLayerSet.has(layerName) && (
                      <button type="button"
                        onClick={() => onEditorToggle(layerName)}
                        title={say({
                          language,
                          en:
                            "edit the living layer — staging rejudges it " +
                            "(zero failed checks demanded), the write is declared, " +
                            "the workshop re-reads the space",
                        })}
                        aria-label={
                          say({ language, en: "edit the layer " }) +
                          layerName
                        }
                        className={
                          "shrink-0 rounded-md px-1.5 py-1 text-xs transition-colors " +
                          (editorLayer === layerName
                            ? "bg-sky-600 dark:bg-sky-700 text-white"
                            : "text-slate-600 dark:text-slate-400 hover:bg-sky-50 dark:hover:bg-sky-950 hover:text-sky-600 dark:hover:text-sky-300")
                        }
                      >
                        ✎
                      </button>
                    )}
                  </div>
                  {layerName === layer && (
                    <div className="ml-4 text-[10px] leading-4 text-slate-600 dark:text-slate-400">
                      {localized({
                        language,
                        text: LAYER_ROLE[layerName] ?? { en: layerName},
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
