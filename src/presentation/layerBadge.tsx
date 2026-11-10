// The layer badge: the corpus color of a layer, as a small pill
// (panel ① uses it on every node, other panels on winners).

import { LAYER_COLOR } from "./workshopInventory.ts";

/** One layer as a colored badge. */
export function LayerBadge({ layer, small }: { layer: string; small?: boolean }) {
  return (
    <span
      className={
        "inline-flex items-center rounded-full font-medium text-white " +
        LAYER_COLOR[layer] +
        (small ? " px-1.5 py-0.5 text-[10px]" : " px-2 py-0.5 text-[11px]")
      }
    >
      {layer}
    </span>
  );
}
