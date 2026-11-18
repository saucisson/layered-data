// The shared refinement-graph view (issue #217): ONE component renders
// the refinement DAG for the workshop header and the hierarchy page —
// the wrapped layout (each generation wraps onto as many lines as the
// container width needs), the SVG routes through its empty channels,
// the pill nodes. The two pages differ only in their callbacks: the
// workshop picks a layer, the hierarchy page opens the formalism page.

import React, { useEffect, useId, useMemo, useRef, useState } from "react";
import { LAYER_COLOR, LAYER_ROLE, RefinementDag } from "./workshopInventory.ts";
import { computeRefinementGraphLayout, CORNER_RADIUS, NODE_HEIGHT } from "./refinementGraphLayout.ts";
import type { RoutePoint } from "./refinementGraphLayout.ts";
import { localized } from "./i18n.ts";
import { hashOf } from "../components/Router.tsx";
import type { Language } from "../domain/messages.ts";

/** The SVG path of a routed edge: straight legs, the corners between
 * them rounded with a quadratic curve — the marker rides the final
 * leg and lands on the edge of the target pill. Null draws nothing
 * (an end missing from the inventory has nothing to point at). */
function routePath(route: RoutePoint[] | null): string | null {
  if (route === null || route.length < 2) return null;
  const start = route[0];
  if (!start) return null;
  let d = "M " + start.x + " " + start.y;
  for (let index = 1; index < route.length - 1; index++) {
    const previous = route[index - 1];
    const corner = route[index];
    const next = route[index + 1];
    if (!previous || !corner || !next) continue;
    const inLength = Math.hypot(corner.x - previous.x, corner.y - previous.y);
    const outLength = Math.hypot(next.x - corner.x, next.y - corner.y);
    if (inLength === 0 || outLength === 0) continue;
    const radius = Math.min(CORNER_RADIUS, inLength / 2, outLength / 2);
    const beforeX = corner.x - ((corner.x - previous.x) / inLength) * radius;
    const beforeY = corner.y - ((corner.y - previous.y) / inLength) * radius;
    const afterX = corner.x + ((next.x - corner.x) / outLength) * radius;
    const afterY = corner.y + ((next.y - corner.y) / outLength) * radius;
    d +=
      " L " + beforeX + " " + beforeY +
      " Q " + corner.x + " " + corner.y + " " + afterX + " " + afterY;
  }
  const end = route[route.length - 1];
  if (!end) return d;
  d += " L " + end.x + " " + end.y;
  return d;
}

/** The shared refinement graph: bands, one route per refinement, one
 * pill per layer. The component measures its own container and wraps
 * the generations to its width (no horizontal scroll); the routes
 * travel the empty channels of the wrapped geometry, no arrow ever
 * crosses a pastille. `focus` drives the highlight (the hovered layer,
 * or the current layer in the workshop); `search` fades the
 * non-matching layers. */
export function RefinementGraph({
  layerNames,
  dag,
  focus,
  search,
  closureSet,
  onPick,
  onHover,
  language,
  familyOf,
  activeFamily = null,
}: {
  layerNames: readonly string[];
  dag: RefinementDag;
  /** the highlighted layer (ring + chain to the front), null for none */
  focus: string | null;
  search: string;
  closureSet?: Set<string>;
  /** absent on the hierarchy page: the pill is then a real link to
   *  #formalism/<layer>; present in the workshop, where picking a
   *  layer is an in-panel selection, not a page change */
  onPick?: (layerName: string) => void;
  onHover?: (layerName: string | null) => void;
  language: Language;
  /** the family grouping (issue #231): with activeFamily set, the
   * layers outside the family fade like non-matching search hits */
  familyOf?: (layerName: string) => string;
  activeFamily?: string | null;
}) {
  const markerId = "refinement-arrow-" + useId().replace(/[^a-zA-Z0-9]/g, "");
  const usageMarkerId = "refinement-usage-" + useId().replace(/[^a-zA-Z0-9]/g, "");
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
    () => computeRefinementGraphLayout({ layerNames, dag, width: containerWidth }),
    [layerNames, dag, containerWidth],
  );
  const ancestors = useMemo(
    () => (focus !== null ? dag.ancestorsOf(focus) : new Set<string>()),
    [dag, focus],
  );
  const descendants = useMemo(
    () => (focus !== null ? dag.descendantsOf(focus) : new Set<string>()),
    [dag, focus],
  );
  const needle = search.trim().toLowerCase();

  // One route per refinement: on the focus chain it goes dark and
  // thick, between two descendants half-tone, otherwise light.
  const edges: React.ReactNode[] = [];
  for (const layerName of layerNames) {
    for (const parentName of dag.targetsOf(layerName)) {
      const d = routePath(layout.route(layerName, parentName));
      if (d === null) continue;
      const onChain = ancestors.has(layerName) && ancestors.has(parentName);
      const betweenDescendants = descendants.has(layerName) && descendants.has(parentName);
      edges.push(
        <path
          key={layerName + "⇢" + parentName}
          d={d}
          fill="none"
          className={onChain ? "stroke-slate-800 dark:stroke-slate-200" : "stroke-slate-300 dark:stroke-slate-600"}
          strokeWidth={onChain ? 2 : 1}
          opacity={onChain ? 1 : betweenDescendants ? 0.5 : 0.25}
          markerEnd={"url(#" + markerId + ")"}
        />
      );
    }
  }

  // The USAGE edges (issue #235): dashed routes with a hollow
  // arrowhead, offset sideways through the router itself so they stay
  // readable beside the refinements. They never drive the layout —
  // only inheritance does; they climb, descend, or U exactly like the
  // refinements, whichever side of the user the used layer sits on.
  const usageEdges: React.ReactNode[] = [];
  for (const layerName of layerNames) {
    for (const usedName of dag.usesOf(layerName)) {
      const d = routePath(layout.route(layerName, usedName, 7));
      if (d === null) continue;
      usageEdges.push(
        <path
          key={"uses:" + layerName + "⇢" + usedName}
          d={d}
          fill="none"
          className="stroke-slate-400 dark:stroke-slate-500"
          strokeWidth={1}
          strokeDasharray="4 3"
          opacity={focus !== null && (layerName === focus || usedName === focus) ? 0.9 : 0.35}
          markerEnd={"url(#" + usageMarkerId + ")"}
        />,
      );
    }
  }

  return (
    <div
      ref={containerRef}
      className="relative w-full overflow-hidden"
      style={{ height: layout.H }}
    >
      <svg
        width={layout.W}
        height={layout.H}
        style={{ position: "absolute", left: 0, top: 0 }}
      >
        <defs>
          <marker
            id={markerId}
            markerWidth="8"
            markerHeight="8"
            refX="8"
            refY="4"
            orient="auto"
            markerUnits="userSpaceOnUse"
          >
            <path d="M0,0 L8,4 L0,8 Z" fill="#64748b" />
          </marker>
          <marker
            id={usageMarkerId}
            markerWidth="8"
            markerHeight="8"
            refX="8"
            refY="4"
            orient="auto"
            markerUnits="userSpaceOnUse"
          >
            <path d="M0,0 L8,4 L0,8 Z" fill="none" stroke="#64748b" strokeWidth="1.2" />
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
        {usageEdges}
      </svg>
      {layerNames.map((layerName) => {
        const position = layout.position(layerName);
        const inAncestors = ancestors.has(layerName);
        const inDescendants = descendants.has(layerName);
        const matches =
          (!needle || layerName.toLowerCase().includes(needle)) &&
          (activeFamily === null || familyOf === undefined || familyOf(layerName) === activeFamily);
        const pillClassName =
          "flex items-center gap-1.5 rounded-full border px-2 font-mono text-[10px] leading-4 transition-opacity " +
          (layerName === focus
            ? "border-slate-900 ring-2 ring-slate-900 dark:border-slate-100 dark:ring-slate-100 "
            : inAncestors
              ? "border-slate-500 dark:border-slate-400 "
              : "border-slate-300 dark:border-slate-600 ") +
          (!matches
            ? "opacity-10"
            : focus === null
              ? "opacity-100"
              : inAncestors || layerName === focus
                ? "font-semibold opacity-100"
                : inDescendants
                  ? "opacity-60"
                  : "opacity-40");
        const pillBody = (
          <>
            <span
              className={
                "h-2 w-2 shrink-0 rounded-full " +
                (LAYER_COLOR[layerName] ?? "bg-slate-300 dark:bg-slate-600")
              }
            />
            {layerName}
            {closureSet !== undefined && closureSet.has(layerName) && (
              <span
                title="in the closure of the current address"
                className="absolute -top-1 -right-1 h-2 w-2 rounded-full border border-amber-500 bg-amber-300"
              />
            )}
          </>
        );
        const sharedProps = {
          onMouseEnter: () => onHover?.(layerName),
          onMouseLeave: () => onHover?.(null),
          style: {
            position: "absolute" as const,
            left: position.x,
            top: position.y,
            width: position.w,
            height: NODE_HEIGHT,
          },
          title: localized({
            language,
            text: LAYER_ROLE[layerName] ?? { en: layerName },
          }),
          className: pillClassName,
        };
        // without onPick (hierarchy page) the pill is a real link to the
        // formalism page; with onPick (workshop) it is an in-panel pick
        return onPick ? (
          <button type="button" key={layerName} {...sharedProps} onClick={() => onPick(layerName)}>
            {pillBody}
          </button>
        ) : (
          <a key={layerName} {...sharedProps} href={hashOf("formalism", layerName)}>
            {pillBody}
          </a>
        );
      })}
    </div>
  );
}
