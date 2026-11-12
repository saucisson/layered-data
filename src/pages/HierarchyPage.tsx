// The hierarchy page — the complete refinement graph of the
// workshop, given a whole page: one pill per layer of the living
// inventory, one curve per refinement, the generations in
// horizontal bands. The layout is the workshop's own deterministic
// barycenter (no new dependency: measured code, the same
// algorithm panel ① uses), scaled by buttons and panned by the
// scrollbars; hovering a layer brings its closure (upward) and its
// descendants (downward) to the front; clicking a layer opens the
// formalism page on it — the address is the artifact.

import React, { useMemo, useState } from "react";
import { useRouter } from "../components/Router";
import { assembleLayeredDataKernel } from "../application/corpus.ts";
import { materializeSessionAdditions } from "../application/session.ts";
import { loadKernelLayerSources } from "../infrastructure/corpusLoader.ts";
import { AddressView } from "../domain/addresses.ts";
import { bindingOf, VIEW_NOTES, VIEWPOINT_LAYERS } from "../presentation/viewTree.ts";
import {
  computeGraphLayout,
  LAYER_COLOR,
  LAYER_ROLE,
  RefinementDag,
} from "../presentation/workshopInventory.ts";
import { localized, say } from "../presentation/i18n.ts";
import type { BilingualText } from "../presentation/i18n.ts";
import type { Language } from "../domain/messages.ts";

interface HierarchyPageProps {
  language: Language;
  onChooseLanguage: (lang: Language) => void;
}

// The kernel of the page: assembled once from the corpus files.
// The session additions materialize into it at each mount.
const KERNEL = assembleLayeredDataKernel({ layerSources: loadKernelLayerSources() });

const MINIMUM_SCALE = 0.5;
const MAXIMUM_SCALE = 2.5;
const SCALE_STEP = 0.25;

export function HierarchyPage({ language, onChooseLanguage }: HierarchyPageProps) {
  const { navigate } = useRouter();
  const session = useMemo(() => materializeSessionAdditions({ kernel: KERNEL }), []);
  const layerNames = session.layerNames;
  const dag = useMemo(() => new RefinementDag({ space: KERNEL.space, layerNames }), [layerNames]);
  const layout = useMemo(() => computeGraphLayout({ layerNames, dag }), [layerNames, dag]);
  const [search, setSearch] = useState("");
  const [hovered, setHovered] = useState<string | null>(null);
  const [scale, setScale] = useState(1);

  const focus = hovered;
  const ancestors = useMemo(
    () => (focus !== null ? dag.ancestorsOf(focus) : new Set<string>()),
    [dag, focus],
  );
  const descendants = useMemo(
    () => (focus !== null ? dag.descendantsOf(focus) : new Set<string>()),
    [dag, focus],
  );
  const needle = search.trim().toLowerCase();
  const refinementCount = layerNames.reduce(
    (total, layerName) => total + dag.targetsOf(layerName).length,
    0,
  );

  // One curve per refinement: on the focus chain it goes black and
  // thick, between two descendants half-tone, otherwise it fades.
  const edges: React.ReactNode[] = [];
  for (const layerName of layerNames) {
    for (const parentName of dag.targetsOf(layerName)) {
      const from = layout.position(layerName);
      const to = layout.position(parentName);
      const onChain = ancestors.has(layerName) && ancestors.has(parentName);
      const betweenDescendants = descendants.has(layerName) && descendants.has(parentName);
      const midHeight = (from.y + to.y + 24) / 2;
      edges.push(
        <path
          key={layerName + "⇢" + parentName}
          d={
            "M " +
            (from.x + from.w / 2) +
            " " +
            (from.y + 2) +
            " C " +
            (from.x + from.w / 2) +
            " " +
            midHeight +
            " " +
            (to.x + to.w / 2) +
            " " +
            midHeight +
            " " +
            (to.x + to.w / 2) +
            " " +
            (to.y + 22)
          }
          fill="none"
          stroke={onChain ? "#1e293b" : "#cbd5e1"}
          strokeWidth={onChain ? 2 : 1}
          opacity={onChain ? 1 : betweenDescendants ? 0.5 : 0.15}
          markerEnd="url(#hierarchy-arrow)"
        />,
      );
    }
  }

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-800 text-slate-900">
      <header className="border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-5 py-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h1 className="text-lg font-bold">
            {say({
              language,
              en: "The hierarchy — the complete refinement graph",
            })}
          </h1>
          <span className="flex shrink-0 items-center gap-1 text-xs">
            <span className="mr-1 text-slate-600">
              {say({ language, en: "language: "})}
            </span>
            {(["en", "fr"] as Language[]).map((choice) => (
              <button type="button"
                key={choice}
                onClick={() => onChooseLanguage(choice)}
                className={
                  "rounded border px-1.5 py-0.5 font-bold uppercase " +
                  (language === choice
                    ? "border-slate-800 bg-slate-800 text-white"
                    : "border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-500 hover:border-slate-500")
                }
              >
                {choice}
              </button>
            ))}
          </span>
        </div>
        <div className="mt-2 flex flex-wrap gap-2 text-xs">
          <button type="button"
            onClick={() => navigate("landing")}
            className="rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1 text-slate-600 hover:border-slate-600"
          >
            {say({ language, en: "← home"})}
          </button>
          <button type="button"
            onClick={() => navigate("creation")}
            className="rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1 text-slate-600 hover:border-slate-600"
          >
            {say({ language, en: "create a formalism →"})}
          </button>
          <button type="button"
            onClick={() => navigate("workshop")}
            className="rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1 text-slate-600 hover:border-slate-600"
          >
            {say({ language, en: "the workshop →"})}
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-[95rem] p-4 sm:p-6">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={say({ language, en: "search a layer…"})}
            className="min-w-52 flex-1 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-1.5 font-mono text-xs focus:border-slate-500 focus:outline-none"
          />
          <span className="flex items-center gap-1 text-xs">
            <button type="button"
              onClick={() => setScale(Math.max(MINIMUM_SCALE, scale - SCALE_STEP))}
              disabled={scale <= MINIMUM_SCALE}
              className="rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1 font-semibold text-slate-600 hover:border-slate-600 disabled:opacity-40"
              aria-label={say({ language, en: "zoom out"})}
            >
              −
            </button>
            <span className="w-12 text-center font-mono text-[11px] text-slate-500">×{scale}</span>
            <button type="button"
              onClick={() => setScale(Math.min(MAXIMUM_SCALE, scale + SCALE_STEP))}
              disabled={scale >= MAXIMUM_SCALE}
              className="rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1 font-semibold text-slate-600 hover:border-slate-600 disabled:opacity-40"
              aria-label={say({ language, en: "zoom in"})}
            >
              ＋
            </button>
            <button type="button"
              onClick={() => setScale(1)}
              className="rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1 text-[11px] text-slate-600 hover:border-slate-600"
            >
              {say({ language, en: "reset"})}
            </button>
          </span>
          <span className="text-[11px] text-slate-600">
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
            {layout.rows.length + " "}
            {say({ language, en: "generations"})}
          </span>
        </div>

        <div className="overflow-auto rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
          <div style={{ position: "relative", width: layout.W * scale, height: layout.H * scale }}>
            <div
              style={{
                position: "absolute",
                left: 0,
                top: 0,
                width: layout.W,
                height: layout.H,
                transform: "scale(" + scale + ")",
                transformOrigin: "top left",
              }}
            >
              <svg
                width={layout.W}
                height={layout.H}
                style={{ position: "absolute", left: 0, top: 0 }}
              >
                <defs>
                  <marker
                    id="hierarchy-arrow"
                    markerWidth="7"
                    markerHeight="7"
                    refX="6"
                    refY="3"
                    orient="auto"
                  >
                    <path d="M0,0 L6,3 L0,6 Z" fill="#64748b" />
                  </marker>
                </defs>
                {layout.rows.map((row, rowIndex) => (
                  <rect
                    key={"band" + rowIndex}
                    x={0}
                    y={30 + rowIndex * layout.ROW - 12}
                    width={layout.W}
                    height={layout.ROW}
                    fill="#f1f5f9"
                    opacity={0.55}
                  />
                ))}
                {edges}
              </svg>
              {layerNames.map((layerName) => {
                const position = layout.position(layerName);
                const inAncestors = ancestors.has(layerName);
                const inDescendants = descendants.has(layerName);
                const matches = !needle || layerName.toLowerCase().includes(needle);
                return (
                  <button type="button"
                    key={layerName}
                    onClick={() => navigate("formalism", layerName)}
                    onMouseEnter={() => setHovered(layerName)}
                    onMouseLeave={() => setHovered(null)}
                    style={{
                      position: "absolute",
                      left: position.x,
                      top: position.y + 2,
                      width: position.w,
                    }}
                    title={localized({
                      language,
                      text: LAYER_ROLE[layerName] ?? { en: layerName},
                    })}
                    className={
                      "flex items-center gap-1.5 rounded-full border px-2 py-0.5 font-mono text-[9px] leading-4 transition-opacity " +
                      (layerName === focus
                        ? "border-slate-900 ring-2 ring-slate-900 "
                        : inAncestors
                          ? "border-slate-500 "
                          : "border-slate-300 dark:border-slate-600 ") +
                      (!matches
                        ? "opacity-10"
                        : inAncestors
                          ? "font-semibold opacity-100"
                          : inDescendants
                            ? "opacity-60"
                            : needle
                              ? "opacity-50"
                              : "opacity-20")
                    }
                  >
                    <span
                      className={
                        "h-2 w-2 shrink-0 rounded-full " +
                        (LAYER_COLOR[layerName] ?? "bg-slate-300")
                      }
                    />
                    {layerName}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* The viewpoints — the looks that read one model through
            one lens; they live with the hierarchy, the whole
            corpus in one glance. */}
        <section className="mt-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-3">
          <h2 className="mb-1 text-sm font-bold text-slate-800 dark:text-slate-100">
            {say({ language, en: "The viewpoints"})}
          </h2>
          <p className="mb-2 text-[10px] leading-4 text-slate-600">
            {say({
              language,
              en: "A viewpoint is a layer that chooses a model and a lens: the data does not move, the reading changes. Click one: the formalism page opens on it.",
            })}
          </p>
          <div className="grid gap-2 md:grid-cols-2">
            {VIEWPOINT_LAYERS.map((view) => {
              const modelBinding = bindingOf({ space: KERNEL.space, view, key: "model" }).value;
              const modelLayer = modelBinding instanceof AddressView ? modelBinding.layer : null;
              const displayBinding = bindingOf({ space: KERNEL.space, view, key: "display" }).value;
              const displayLayer =
                displayBinding instanceof AddressView ? displayBinding.layer : null;
              return (
                <div
                  key={view}
                  className="rounded-md border border-slate-100 bg-slate-50 dark:bg-slate-900 p-2 text-[11px] leading-4"
                >
                  <div className="flex flex-wrap items-center gap-1.5">
                    <button type="button"
                      onClick={() => navigate("formalism", view)}
                      className="font-mono font-semibold underline decoration-slate-300 hover:text-slate-900"
                    >
                      <span
                        className={
                          "mr-1 inline-block h-2 w-2 rounded-full " +
                          (LAYER_COLOR[view] ?? "bg-slate-300")
                        }
                      />
                      {view}
                    </button>
                    {modelLayer !== null && (
                      <>
                        <span className="text-slate-600">
                          {say({ language, en: "model: "})}
                        </span>
                        <button type="button"
                          onClick={() => navigate("formalism", modelLayer)}
                          className="font-mono underline decoration-slate-300 hover:text-slate-900"
                        >
                          {modelLayer}
                        </button>
                      </>
                    )}
                    {displayLayer !== null && (
                      <>
                        <span className="text-slate-600">
                          {say({ language, en: "lens: "})}
                        </span>
                        <button type="button"
                          onClick={() => navigate("formalism", displayLayer)}
                          className="font-mono underline decoration-slate-300 hover:text-slate-900"
                        >
                          {displayLayer}
                        </button>
                      </>
                    )}
                  </div>
                  <p className="mt-1 text-slate-600">
                    {localized({
                      language,
                      text: VIEW_NOTES[view] ?? ({ en: view} as BilingualText),
                    })}
                  </p>
                </div>
              );
            })}
          </div>
        </section>

        <p className="mt-2 text-[11px] leading-4 text-slate-500">
          {focus !== null
            ? localized({
                language,
                text: LAYER_ROLE[focus] ?? { en: focus},
              })
            : say({
                language,
                en: "Hover a layer: its closure (upward) and its descendants (downward) come to the front; click it: the formalism page opens on it.",
              })}
          {" — "}
          {say({
            language,
            en: "the bands are the generations (the rank is the longest path towards a base); one curve is one refinement; the search fades the non-matching layers.",
          })}
        </p>
      </main>
    </div>
  );
}
