// The refinement graph of the workshop header (issue #217): a thin
// wrapper over the shared RefinementGraph — the workshop picks a
// layer, the hierarchy page opens the formalism page; the rendering
// (layout, curves, pills) is the same component.

import { useState } from "react";
import { LAYER_ROLE, RefinementDag } from "./workshopInventory.ts";
import { RefinementGraph } from "./refinementGraph.tsx";
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
  filterMatches,
}: {
  layer: string;
  closureSet: Set<string>;
  onPick: (layer: string) => void;
  search: string;
  layerNames: readonly string[];
  dag: RefinementDag;
  language: Language;
  /** the family filter (issue #363): non-matching layers fade like
   * non-matching search hits — the layout and the bands never change */
  filterMatches?: (layerName: string) => boolean;
}) {
  const [hovered, setHovered] = useState<string | null>(null);
  const focus = hovered ?? layer;
  return (
    <div>
      <div className="overflow-auto rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
        <RefinementGraph
          layerNames={layerNames}
          dag={dag}
          focus={focus}
          search={search}
          closureSet={closureSet}
          {...(filterMatches !== undefined ? { filterMatches } : {})}
          onPick={onPick}
          onHover={setHovered}
          language={language}
        />
      </div>
      <p className="mt-1 text-[10px] leading-4 text-slate-600 dark:text-slate-400">
        {localized({ language, text: LAYER_ROLE[focus] ?? { en: focus } })}{" "}
        {say({
          language,
          en: "— click a layer: the closure of its refinements (upward) and its descendants (downward) come to the front; the amber ring = layers of the current address's closure (③); the search (header) fades the non-matching layers.",
        })}
      </p>
    </div>
  );
}
