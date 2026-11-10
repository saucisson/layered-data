// The shared position resolution: grid x/y (y optional), polar
// r/theta (degrees, zero east), and the relative chain (relative_to
// cites an upstream position and carries an offset) — resolved to the
// first absolute point; a cycle answers null and nothing is drawn.
// One implementation for the workshop's view tree and the graphical
// editor — the resolution idiom is the reader's, never duplicated.

import { asLayerName, asLayerPath } from "../domain/identifiers.ts";
import { AddressView } from "../domain/addresses.ts";
import type { Space } from "../domain/space.ts";

/** The resolved absolute position of one address, or null when the
 * chain is cyclic or carries no absolute base. */
export function resolvePositionAt({
  space,
  layer,
  path,
  visited,
}: {
  space: Space;
  layer: string;
  path: string[];
  visited: Set<string>;
}): { x: number; y: number } | null {
  const visitKey = layer + "::" + path.join("/");
  if (visited.has(visitKey)) return null;
  visited.add(visitKey);

  let baseX = 0;
  let baseY = 0;
  const readAt = (key: string) =>
    space.read({ layer: asLayerName(layer), path: asLayerPath(path), key });
  const relativeTo = readAt("relative_to");
  if (relativeTo instanceof AddressView) {
    const upstream = resolvePositionAt({
      space,
      layer: relativeTo.layer,
      path: relativeTo.path,
      visited,
    });
    if (upstream === null) return null;
    baseX = upstream.x;
    baseY = upstream.y;
  }
  const system = readAt("system");
  if (system === "polar") {
    const radius = readAt("r");
    const theta = readAt("theta");
    if (typeof radius !== "number" || typeof theta !== "number") return null;
    const angle = (theta * Math.PI) / 180;
    return { x: baseX + radius * Math.cos(angle), y: baseY + radius * Math.sin(angle) };
  }
  const x = readAt("x");
  const y = readAt("y");
  if (typeof x !== "number") return null;
  return { x: baseX + x, y: baseY + (typeof y === "number" ? y : 0) };
}
