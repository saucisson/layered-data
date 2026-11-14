// The hierarchy page — the complete refinement graph of the
// workshop, given a whole page: one pill per layer of the living
// inventory, one curve per refinement, the generations in
// horizontal bands. The layout wraps each generation onto as many
// lines as needed to fit the page width (no horizontal scroll, no
// zoom); hovering a layer brings its closure (upward) and its
// descendants (downward) to the front; clicking a layer opens the
// formalism page on it — the address is the artifact.

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "../components/Router";
import { assembleLayeredDataKernel } from "../application/corpus.ts";
import { materializeSessionAdditions } from "../application/session.ts";
import { loadKernelLayerSources } from "../infrastructure/corpusLoader.ts";
import {
  computeGraphLayout,
  LAYER_COLOR,
  LAYER_ROLE,
  RefinementDag,
} from "../presentation/workshopInventory.ts";
import { localized, say } from "../presentation/i18n.ts";
import type { Language } from "../domain/messages.ts";

interface HierarchyPageProps {
  language: Language;
}

// The kernel of the page: assembled once from the corpus files.
// The session additions materialize into it at each mount.
const KERNEL = assembleLayeredDataKernel({ layerSources: loadKernelLayerSources() });

// Layout metrics for the wrapped graph (font-mono text-xs pills).
const CHARACTER_WIDTH = 7.2;
const NODE_PADDING = 44;
const HORIZONTAL_GAP = 12;
const VERTICAL_GAP = 10;
const ROW = 34;
const NODE_HEIGHT = 28;
const MARGIN = 8;

interface WrappedPosition {
  x: number;
  y: number;
  w: number;
}

interface WrappedLayout {
  W: number;
  H: number;
  position: (layerName: string) => WrappedPosition;
  bands: { y: number; h: number }[];
}

/** Wrap each generation onto as many lines as needed to fit `width`.
 * The order inside a generation is the deterministic barycenter order
 * of computeGraphLayout. */
function computeWrappedLayout({
  layerNames,
  dag,
  width,
}: {
  layerNames: readonly string[];
  dag: RefinementDag;
  width: number;
}): WrappedLayout {
  const base = computeGraphLayout({ layerNames, dag });
  const widthOf = (layerName: string) =>
    Math.ceil(layerName.length * CHARACTER_WIDTH) + NODE_PADDING;

  const positions: Record<string, WrappedPosition> = {};
  const bands: { y: number; h: number }[] = [];
  let cursorY = MARGIN;
  for (const row of base.rows) {
    const bandTop = cursorY;
    let cursorX = MARGIN;
    for (const layerName of row) {
      const w = widthOf(layerName);
      if (cursorX > MARGIN && cursorX + w > width - MARGIN) {
        cursorX = MARGIN;
        cursorY += ROW + VERTICAL_GAP;
      }
      positions[layerName] = { x: cursorX, y: cursorY, w };
      cursorX += w + HORIZONTAL_GAP;
    }
    cursorY += ROW;
    bands.push({ y: bandTop - 4, h: cursorY - bandTop + 4 });
    cursorY += VERTICAL_GAP;
  }
  const H = cursorY + MARGIN;
  return {
    W: width,
    H,
    position: (layerName) => positions[layerName] ?? { x: 0, y: 0, w: 0 },
    bands,
  };
}

export function HierarchyPage({ language }: HierarchyPageProps) {
  const { navigate } = useRouter();
  const session = useMemo(() => materializeSessionAdditions({ kernel: KERNEL }), []);
  const layerNames = session.layerNames;
  const dag = useMemo(() => new RefinementDag({ space: KERNEL.space, layerNames }), [layerNames]);
  const [search, setSearch] = useState("");
  const [hovered, setHovered] = useState<string | null>(null);

  // The graph fits the width of its container: measure it and re-wrap
  // on resize.
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(1200);
  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width ?? 0;
      if (width > 0) setContainerWidth(Math.floor(width));
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const layout = useMemo(
    () => computeWrappedLayout({ layerNames, dag, width: containerWidth }),
    [layerNames, dag, containerWidth],
  );

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

  // One curve per refinement: on the focus chain it goes dark and
  // thick, between two descendants half-tone, otherwise light.
  const edges: React.ReactNode[] = [];
  for (const layerName of layerNames) {
    for (const parentName of dag.targetsOf(layerName)) {
      const from = layout.position(layerName);
      const to = layout.position(parentName);
      const onChain = ancestors.has(layerName) && ancestors.has(parentName);
      const betweenDescendants = descendants.has(layerName) && descendants.has(parentName);
      const midHeight = (from.y + to.y + NODE_HEIGHT) / 2;
      edges.push(
        <path
          key={layerName + "⇢" + parentName}
          d={
            "M " +
            (from.x + from.w / 2) +
            " " +
            (from.y + NODE_HEIGHT - 2) +
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
            (to.y + 2)
          }
          fill="none"
          stroke={onChain ? "#1e293b" : "#cbd5e1"}
          strokeWidth={onChain ? 2 : 1}
          opacity={onChain ? 1 : betweenDescendants ? 0.5 : 0.25}
          markerEnd="url(#hierarchy-arrow)"
        />,
      );
    }
  }

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
            placeholder={say({ language, en: "search a layer…"})}
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
            {layout.bands.length + " "}
            {say({ language, en: "generations"})}
          </span>
        </div>

        <div
          ref={containerRef}
          className="relative w-full overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
          style={{ height: layout.H }}
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
            {layout.bands.map((band, bandIndex) => (
              <rect
                key={"band" + bandIndex}
                x={0}
                y={band.y}
                width={layout.W}
                height={band.h}
                className="fill-slate-100 dark:fill-slate-700"
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
                  top: position.y,
                  width: position.w,
                  height: NODE_HEIGHT,
                }}
                title={localized({
                  language,
                  text: LAYER_ROLE[layerName] ?? { en: layerName},
                })}
                className={
                  "flex items-center gap-1.5 rounded-full border px-2 font-mono text-xs leading-5 transition-opacity " +
                  (layerName === focus
                    ? "border-slate-900 ring-2 ring-slate-900 dark:border-slate-100 dark:ring-slate-100 "
                    : inAncestors
                      ? "border-slate-500 dark:border-slate-400 "
                      : "border-slate-300 dark:border-slate-600 ") +
                  (!matches
                    ? "opacity-10"
                    : focus === null
                      ? "opacity-100"
                      : inAncestors || inDescendants || layerName === focus
                        ? "font-semibold opacity-100"
                        : "opacity-40")
                }
              >
                <span
                  className={
                    "h-2.5 w-2.5 shrink-0 rounded-full " +
                    (LAYER_COLOR[layerName] ?? "bg-slate-300 dark:bg-slate-600")
                  }
                />
                {layerName}
              </button>
            );
          })}
        </div>

        <p className="mt-2 text-[11px] leading-4 text-slate-500 dark:text-slate-400">
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
            en: "the shaded bands are the generations (the rank is the longest path towards a base); one curve is one refinement; the search fades the non-matching layers.",
          })}
        </p>
      </div>
    </div>
  );
}
