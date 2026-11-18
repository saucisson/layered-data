// The pure geometry of the glyph vocabulary (issue #284): bounds,
// declared label placement, bezier arc path — no React, so the
// harnesses can import them. The SVG element itself lives in
// glyphShape.tsx.

import type { Glyph, LabelSide } from "../domain/views.ts";

/** The local bounds of one vertex glyph, centred on the node (the
 * `path` genre's bounds are scanned from its `d` numbers — an
 * approximation good enough for the label, the selection ring and
 * the miniature). */
export function glyphBounds(glyph: Glyph): { x0: number; y0: number; x1: number; y1: number } {
  if (glyph.shape === "circle") {
    const r = glyph.r ?? 16;
    return { x0: -r, y0: -r, x1: r, y1: r };
  }
  if (glyph.shape === "ellipse") {
    const rx = glyph.rx ?? 24;
    const ry = glyph.ry ?? 14;
    return { x0: -rx, y0: -ry, x1: rx, y1: ry };
  }
  if (glyph.shape === "rectangle" || glyph.shape === "box") {
    const w = glyph.w ?? (glyph.shape === "box" ? 52 : 44);
    const h = glyph.h ?? 24;
    return { x0: -w / 2, y0: -h / 2, x1: w / 2, y1: h / 2 };
  }
  if (glyph.shape === "path") {
    const numbers = glyph.d.match(/-?\d*\.?\d+(?:[eE][-+]?\d+)?/g)?.map(Number) ?? [];
    let x0 = 0, y0 = 0, x1 = 0, y1 = 0;
    for (let index = 0; index + 1 < numbers.length; index += 2) {
      const x = numbers[index] ?? 0;
      const y = numbers[index + 1] ?? 0;
      x0 = Math.min(x0, x); x1 = Math.max(x1, x);
      y0 = Math.min(y0, y); y1 = Math.max(y1, y);
    }
    if (numbers.length === 0) return { x0: -16, y0: -16, x1: 16, y1: 16 };
    return { x0, y0, x1, y1 };
  }
  return { x0: -16, y0: -16, x1: 16, y1: 16 };
}

/** The label position for a glyph at (x, y): `inside` keeps the
 * historical placement (centred, slightly low); a side places the
 * text on the glyph's bounds, on the named side, with the optional
 * label-dx/label-dy offset. */
export function labelPosition({
  glyph,
  x,
  y,
}: {
  glyph: Glyph;
  x: number;
  y: number;
}): { x: number; y: number; textAnchor: "middle" | "start" | "end" } {
  const side: LabelSide =
    "label-side" in glyph && glyph["label-side"] !== undefined ? glyph["label-side"] : "inside";
  const dx = "label-dx" in glyph ? (glyph["label-dx"] ?? 0) : 0;
  const dy = "label-dy" in glyph ? (glyph["label-dy"] ?? 0) : 0;
  if (side === "inside") return { x: x + dx, y: y + 3 + dy, textAnchor: "middle" };
  const bounds = glyphBounds(glyph);
  if (side === "north")
    return { x: x + (bounds.x0 + bounds.x1) / 2 + dx, y: y + bounds.y0 - 3 + dy, textAnchor: "middle" };
  if (side === "south")
    return { x: x + (bounds.x0 + bounds.x1) / 2 + dx, y: y + bounds.y1 + 9 + dy, textAnchor: "middle" };
  if (side === "east") return { x: x + bounds.x1 + 3 + dx, y: y + 3 + dy, textAnchor: "start" };
  return { x: x + bounds.x0 - 3 + dx, y: y + 3 + dy, textAnchor: "end" };
}

/** A smooth path through the points (Catmull-Rom as cubic segments)
 * for the `curve = "bezier"` arcs (issue #284); the polyline stays
 * the default. */
export function arcPathData({
  points,
  curve,
}: {
  points: { x: number; y: number }[];
  curve: "polyline" | "bezier";
}): string {
  if (curve === "polyline" || points.length < 3) {
    return points.map((point, index) => (index === 0 ? "M" : "L") + point.x + "," + point.y).join(" ");
  }
  const at = (index: number): { x: number; y: number } =>
    points[Math.max(0, Math.min(points.length - 1, index))] ?? { x: 0, y: 0 };
  const first = points[0] ?? { x: 0, y: 0 };
  let data = "M" + first.x + "," + first.y;
  for (let index = 0; index < points.length - 1; index += 1) {
    const p0 = at(index - 1);
    const p1 = at(index);
    const p2 = at(index + 1);
    const p3 = at(index + 2);
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    data += " C" + c1x + "," + c1y + " " + c2x + "," + c2y + " " + p2.x + "," + p2.y;
  }
  return data;
}
