// The shared geometry of the glyph vocabulary (issue #284): one
// renderer for the three drawing sites (workshop panel, model
// editor, palette miniature) — dimensions, offset, rotation, dashed
// stroke, the `path` genre, and the declared label placement. Pure
// rendering over the narrowed Glyph, no kernel reads.

import type { Glyph, NodeSize } from "../domain/views.ts";
import type { SvgDataNode } from "./displayFunctions.ts";
import { scaledGlyph } from "./glyphGeometry.ts";

export { arcPathData, glyphBounds, labelPosition, scaledGlyph } from "./glyphGeometry.ts";

/** One vertex glyph element at (x, y), with its offset and rotation
 * applied around the node's centre. The node's own size datum (issue
 * #285) scales the glyph's dimensions and adds its angle to the
 * glyph's rotation. */
export function vertexGlyphElement({
  glyph,
  x,
  y,
  strokeWidth,
  size,
}: {
  glyph: Glyph;
  x: number;
  y: number;
  strokeWidth: number;
  size?: NodeSize | undefined;
}): React.ReactNode {
  const scale = size?.scale ?? 1;
  const nodeAngle = size?.angle ?? 0;
  const drawn = scaledGlyph(glyph, scale);
  const stroke = drawn.stroke ?? "#94a3b8";
  const fill = drawn.shape !== "line" && drawn.fill ? drawn.fill : "none";
  const dash = "dash" in drawn && drawn.dash === true ? "3 3" : undefined;
  const offset = drawn.shape === "line" ? { dx: 0, dy: 0, angle: 0 } : drawn;
  const totalAngle = (offset.angle ?? 0) + nodeAngle;
  const transform =
    offset.dx !== undefined || offset.dy !== undefined || totalAngle !== 0
      ? "translate(" + (x + (offset.dx ?? 0)) + " " + (y + (offset.dy ?? 0)) + ")" +
        (totalAngle !== 0 ? " rotate(" + totalAngle + ")" : "")
      : "translate(" + x + " " + y + ")";
  const inner = (() => {
    if (drawn.shape === "circle")
      return <circle cx={0} cy={0} r={drawn.r ?? 16} fill={fill} stroke={stroke} strokeWidth={strokeWidth} strokeDasharray={dash} />;
    if (drawn.shape === "ellipse")
      return <ellipse cx={0} cy={0} rx={drawn.rx ?? 24} ry={drawn.ry ?? 14} fill={fill} stroke={stroke} strokeWidth={strokeWidth} strokeDasharray={dash} />;
    if (drawn.shape === "rectangle")
      return <rect x={-(drawn.w ?? 44) / 2} y={-(drawn.h ?? 24) / 2} width={drawn.w ?? 44} height={drawn.h ?? 24} rx={2} fill={fill} stroke={stroke} strokeWidth={strokeWidth} strokeDasharray={dash} />;
    if (drawn.shape === "box")
      return <rect x={-(drawn.w ?? 52) / 2} y={-(drawn.h ?? 24) / 2} width={drawn.w ?? 52} height={drawn.h ?? 24} rx={3} fill="#ffffff" className="stroke-slate-600 dark:stroke-slate-400" strokeWidth={strokeWidth} strokeDasharray={dash} />;
    if (drawn.shape === "path")
      return <path d={drawn.d} fill={fill} stroke={stroke} strokeWidth={strokeWidth} strokeDasharray={dash} />;
    return null;
  })();
  return <g transform={transform}>{inner}</g>;
}

/** One whitelisted SVG-data node as a React element — the ONLY way
 * display-function output (ADR-0119) reaches the DOM: React elements,
 * never markup in text, never innerHTML. */
export function svgDataElement(node: SvgDataNode, key: number): React.ReactNode {
  const attrs: Record<string, string | number> = { ...node.attrs, key };
  const Tag = node.tag as keyof React.JSX.IntrinsicElements;
  return <Tag {...attrs}>{node.children.map((child, index) => svgDataElement(child, index))}</Tag>;
}
