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

/** Wrap each generation onto as many lines as needed to fit `width`,
 * then re-order the generations in the wrapped geometry (barycenter
 * sweeps: parents pull their children, children pull their parents) so
 * the curves cross as little as possible. Deterministic: ties keep the
 * inventory order. */
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

  const wrap = (rows: readonly string[][]) => {
    const positions: Record<string, WrappedPosition> = {};
    const bands: { y: number; h: number }[] = [];
    let cursorY = MARGIN;
    for (const row of rows) {
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
    return { positions, bands, H: cursorY + MARGIN };
  };

  const rows = base.rows.map((row) => [...row]);
  const maxRank = rows.length - 1;
  const centerXOf = (
    positions: Record<string, WrappedPosition>,
    layerName: string,
  ) => {
    const position = positions[layerName];
    return position ? position.x + position.w / 2 : 0;
  };
  const sortByBarycenter = (
    rank: number,
    neighboursOf: (layerName: string) => readonly string[],
    positions: Record<string, WrappedPosition>,
  ) => {
    const scored = (rows[rank] ?? []).map((layerName) => {
      const neighbours = neighboursOf(layerName);
      const barycenter = neighbours.length
        ? neighbours.reduce((total, neighbour) => total + centerXOf(positions, neighbour), 0) /
          neighbours.length
        : centerXOf(positions, layerName);
      return { layerName, barycenter };
    });
    scored.sort(
      (first, second) =>
        first.barycenter - second.barycenter ||
        layerNames.indexOf(first.layerName) - layerNames.indexOf(second.layerName),
    );
    rows[rank] = scored.map((scoredNode) => scoredNode.layerName);
  };

  for (let sweep = 0; sweep < 3; sweep++) {
    let wrapped = wrap(rows);
    for (let rank = 1; rank <= maxRank; rank++) {
      sortByBarycenter(rank, (layerName) => dag.targetsOf(layerName), wrapped.positions);
      wrapped = wrap(rows);
    }
    for (let rank = maxRank - 1; rank >= 0; rank--) {
      sortByBarycenter(rank, (layerName) => dag.childrenOf(layerName), wrapped.positions);
      wrapped = wrap(rows);
    }
  }

  // ---- crossing descent: try every adjacent swap inside a generation,
  // keep the ones that lower the real number of curve crossings ----
  const edgeList: { child: string; parent: string }[] = [];
  for (const layerName of layerNames)
    for (const parentName of dag.targetsOf(layerName))
      edgeList.push({ child: layerName, parent: parentName });

  const CURVE_SAMPLES = 6;
  const curveOf = (
    positions: Record<string, WrappedPosition>,
    edge: { child: string; parent: string },
  ): { points: [number, number][]; minX: number; maxX: number; minY: number; maxY: number } | null => {
    const from = positions[edge.child];
    const to = positions[edge.parent];
    if (!from || !to) return null;
    const x1 = from.x + from.w / 2;
    const y1 = from.y + NODE_HEIGHT;
    const x2 = to.x + to.w / 2;
    const y2 = to.y;
    const midY = (y1 + y2) / 2;
    const points: [number, number][] = [];
    for (let index = 0; index <= CURVE_SAMPLES; index++) {
      const t = index / CURVE_SAMPLES;
      const u = 1 - t;
      points.push([
        u * u * u * x1 + 3 * u * u * t * x1 + 3 * u * t * t * x2 + t * t * t * x2,
        u * u * u * y1 + 3 * u * u * t * midY + 3 * u * t * t * midY + t * t * t * y2,
      ]);
    }
    return {
      points,
      minX: Math.min(x1, x2),
      maxX: Math.max(x1, x2),
      minY: Math.min(y1, y2),
      maxY: Math.max(y1, y2),
    };
  };
  const segmentsCross = (
    first: [number, number],
    second: [number, number],
    third: [number, number],
    fourth: [number, number],
  ): boolean => {
    const denominator =
      (second[0] - first[0]) * (fourth[1] - third[1]) -
      (second[1] - first[1]) * (fourth[0] - third[0]);
    if (denominator === 0) return false;
    const t =
      ((third[0] - first[0]) * (fourth[1] - third[1]) -
        (third[1] - first[1]) * (fourth[0] - third[0])) /
      denominator;
    const u =
      ((third[0] - first[0]) * (second[1] - first[1]) -
        (third[1] - first[1]) * (second[0] - first[0])) /
      denominator;
    return t > 0 && t < 1 && u > 0 && u < 1;
  };
  const countCrossings = (positions: Record<string, WrappedPosition>): number => {
    const curves = edgeList
      .map((edge) => ({ edge, curve: curveOf(positions, edge) }))
      .filter(
        (entry): entry is { edge: { child: string; parent: string }; curve: { points: [number, number][]; minX: number; maxX: number; minY: number; maxY: number } } =>
          entry.curve !== null,
      );
    let crossings = 0;
    for (let first = 0; first < curves.length; first++) {
      for (let second = first + 1; second < curves.length; second++) {
        const a = curves[first];
        const b = curves[second];
        if (!a || !b) continue;
        if (a.edge.child === b.edge.child || a.edge.child === b.edge.parent) continue;
        if (a.edge.parent === b.edge.child || a.edge.parent === b.edge.parent) continue;
        if (a.curve.maxY < b.curve.minY || b.curve.maxY < a.curve.minY) continue;
        if (a.curve.maxX < b.curve.minX || b.curve.maxX < a.curve.minX) continue;
        let hit = false;
        for (let i = 0; i < a.curve.points.length - 1 && !hit; i++)
          for (let j = 0; j < b.curve.points.length - 1 && !hit; j++) {
            const pointA = a.curve.points[i];
            const pointB = a.curve.points[i + 1];
            const pointC = b.curve.points[j];
            const pointD = b.curve.points[j + 1];
            if (pointA && pointB && pointC && pointD && segmentsCross(pointA, pointB, pointC, pointD))
              hit = true;
          }
        if (hit) crossings++;
      }
    }
    return crossings;
  };

  let best = wrap(rows);
  let bestCrossings = countCrossings(best.positions);
  for (let sweep = 0; sweep < 6 && bestCrossings > 0; sweep++) {
    let improved = false;
    for (let rank = 0; rank <= maxRank; rank++) {
      const row = rows[rank] ?? [];
      for (let index = 0; index + 1 < row.length; index++) {
        const left = row[index];
        const right = row[index + 1];
        if (left === undefined || right === undefined) continue;
        row[index] = right;
        row[index + 1] = left;
        const candidate = wrap(rows);
        const crossings = countCrossings(candidate.positions);
        if (crossings < bestCrossings) {
          best = candidate;
          bestCrossings = crossings;
          improved = true;
        } else {
          row[index] = left;
          row[index + 1] = right;
        }
      }
    }
    if (!improved) break;
  }
  const { positions, bands, H } = best;
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
    // The crossing descent costs a few hundred ms: debounce the
    // recomputation while the window is being dragged.
    let timer: ReturnType<typeof setTimeout> | undefined;
    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width ?? 0;
      if (width <= 0) return;
      clearTimeout(timer);
      timer = setTimeout(() => setContainerWidth(Math.floor(width)), 150);
    });
    observer.observe(element);
    return () => {
      observer.disconnect();
      clearTimeout(timer);
    };
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
            (from.y + NODE_HEIGHT) +
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
            to.y
          }
          fill="none"
          className={onChain ? "stroke-slate-800 dark:stroke-slate-200" : "stroke-slate-300 dark:stroke-slate-600"}
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
                markerWidth="8"
                markerHeight="8"
                refX="8"
                refY="4"
                orient="auto"
                markerUnits="userSpaceOnUse"
              >
                <path d="M0,0 L8,4 L0,8 Z" fill="#64748b" />
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
