// The shared geometry of the glyph vocabulary (issue #284): one
// renderer for the three drawing sites (workshop panel, model
// editor, palette miniature) — dimensions, offset, rotation, dashed
// stroke, the `path` genre, and the declared label placement. Pure
// rendering over the narrowed Glyph, no kernel reads.

import type { Glyph } from "../domain/views.ts";

export { arcPathData, glyphBounds, labelPosition } from "./glyphGeometry.ts";

/** One vertex glyph element at (x, y), with its offset and rotation
 * applied around the node's centre. */
export function vertexGlyphElement({
  glyph,
  x,
  y,
  strokeWidth,
}: {
  glyph: Glyph;
  x: number;
  y: number;
  strokeWidth: number;
}): React.ReactNode {
  const stroke = glyph.stroke ?? "#94a3b8";
  const fill = glyph.shape !== "line" && glyph.fill ? glyph.fill : "none";
  const dash = "dash" in glyph && glyph.dash === true ? "3 3" : undefined;
  const offset = glyph.shape === "line" ? { dx: 0, dy: 0, angle: 0 } : glyph;
  const transform =
    offset.dx !== undefined || offset.dy !== undefined || offset.angle !== undefined
      ? "translate(" + (x + (offset.dx ?? 0)) + " " + (y + (offset.dy ?? 0)) + ")" +
        (offset.angle !== undefined && offset.angle !== 0 ? " rotate(" + offset.angle + ")" : "")
      : "translate(" + x + " " + y + ")";
  const inner = (() => {
    if (glyph.shape === "circle")
      return <circle cx={0} cy={0} r={glyph.r ?? 16} fill={fill} stroke={stroke} strokeWidth={strokeWidth} strokeDasharray={dash} />;
    if (glyph.shape === "ellipse")
      return <ellipse cx={0} cy={0} rx={glyph.rx ?? 24} ry={glyph.ry ?? 14} fill={fill} stroke={stroke} strokeWidth={strokeWidth} strokeDasharray={dash} />;
    if (glyph.shape === "rectangle")
      return <rect x={-(glyph.w ?? 44) / 2} y={-(glyph.h ?? 24) / 2} width={glyph.w ?? 44} height={glyph.h ?? 24} rx={2} fill={fill} stroke={stroke} strokeWidth={strokeWidth} strokeDasharray={dash} />;
    if (glyph.shape === "box")
      return <rect x={-(glyph.w ?? 52) / 2} y={-(glyph.h ?? 24) / 2} width={glyph.w ?? 52} height={glyph.h ?? 24} rx={3} fill="#ffffff" className="stroke-slate-600 dark:stroke-slate-400" strokeWidth={strokeWidth} strokeDasharray={dash} />;
    if (glyph.shape === "path")
      return <path d={glyph.d} fill={fill} stroke={stroke} strokeWidth={strokeWidth} strokeDasharray={dash} />;
    return null;
  })();
  return <g transform={transform}>{inner}</g>;
}
