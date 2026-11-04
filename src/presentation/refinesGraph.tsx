// The refinement graph of the workshop header: every layer of the
// living inventory (corpus + additions), laid out by deterministic
// barycenter, one pill per layer, one curve per refinement. The
// focus layer's chain goes to the front, the rest fades.

import React, { useMemo, useState } from "react";
import { computeGraphLayout, LAYER_COLOR, LAYER_ROLE, RefinementDag } from "./workshopInventory.ts";
import { localized, say } from "./i18n.ts";
import type { Language } from "../domain/messages.ts";

export function RefinesGraph({
  layer,
  closureSet,
  onPick,
  search,
  layerNames,
  dag,
  language,
}: {
  layer: string;
  closureSet: Set<string>;
  onPick: (layer: string) => void;
  search: string;
  layerNames: readonly string[];
  dag: RefinementDag;
  language: Language;
}) {
  const [hovered, setHovered] = useState<string | null>(null);
  const focus = hovered ?? layer;
  // Search: matching layers stay readable (50%), the others fade
  // to 10% — the focus highlight always wins over the search (the
  // current node's chain stays black).
  const needle = search.toLowerCase();
  // The living inventory — corpus + added layers; the layout
  // follows the inventory.
  const layout = useMemo(() => computeGraphLayout({ layerNames, dag }), [layerNames, dag]);
  const ancestors = useMemo(() => dag.ancestorsOf(focus), [dag, focus]);
  const descendants = useMemo(() => dag.descendantsOf(focus), [dag, focus]);
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
          d={"M " + (from.x + from.w / 2) + " " + (from.y + 2) +
             " C " + (from.x + from.w / 2) + " " + midHeight +
             " " + (to.x + to.w / 2) + " " + midHeight +
             " " + (to.x + to.w / 2) + " " + (to.y + 22)}
          fill="none"
          stroke={onChain ? "#1e293b" : "#cbd5e1"}
          strokeWidth={onChain ? 2 : 1}
          opacity={onChain ? 1 : betweenDescendants ? 0.5 : 0.15}
          markerEnd="url(#garrow)"
        />
      );
    }
  }
  return (
    <div>
      <div className="overflow-auto rounded border border-slate-200 bg-white">
        <div style={{ position: "relative", width: layout.W, height: layout.H }}>
          <svg width={layout.W} height={layout.H} style={{ position: "absolute", left: 0, top: 0 }}>
            <defs>
              <marker id="garrow" markerWidth="7" markerHeight="7" refX="6" refY="3" orient="auto">
                <path d="M0,0 L6,3 L0,6 Z" fill="#64748b" />
              </marker>
            </defs>
            {layout.rows.map((row, rowIndex) => (
              <rect
                key={"bande" + rowIndex}
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
              <button
                key={layerName}
                onClick={() => onPick(layerName)}
                onMouseEnter={() => setHovered(layerName)}
                onMouseLeave={() => setHovered(null)}
                style={{ position: "absolute", left: position.x, top: position.y + 2, width: position.w }}
                title={localized({
                  language,
                  text: LAYER_ROLE[layerName] ?? { en: layerName, fr: layerName },
                })}
                className={
                  "flex items-center gap-1.5 rounded-full border px-2 py-0.5 font-mono text-[9px] leading-4 transition-opacity " +
                  (layerName === layer
                    ? "border-slate-900 ring-2 ring-slate-900 "
                    : inAncestors
                      ? "border-slate-500 "
                      : "border-slate-300 ") +
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
                <span className={"h-2 w-2 shrink-0 rounded-full " + LAYER_COLOR[layerName]} />
                {layerName}
                {closureSet.has(layerName) && (
                  <span
                    title={say({
                      language,
                      en: "in the closure of the current address (③)",
                      fr: "dans la fermeture de l'adresse courante (③)",
                    })}
                    className="absolute -top-1 -right-1 h-2 w-2 rounded-full border border-amber-500 bg-amber-300"
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>
      <p className="mt-1 text-[10px] leading-4 text-slate-400">
        {localized({ language, text: LAYER_ROLE[focus] ?? { en: focus, fr: focus } })}{" "}
        {say({
          language,
          en: "— click a layer: the closure of its refinements (upward) and its descendants (downward) come to the front; the amber ring = layers of the current address's closure (③); the search (header) fades the non-matching layers.",
          fr: "— cliquez une couche : la fermeture de ses raffinements (vers le haut) et ses descendants (vers le bas) passent au premier plan ; l'anneau ambre = couches de la fermeture de l'adresse courante (③) ; la recherche (en-tête) efface les couches non correspondantes.",
        })}
      </p>
    </div>
  );
}
