// The SVG glyphs of panel ④: one node glyph (circle, ellipse,
// rectangle, box — dashed when the lens dresses the type with no
// shape) and one edge glyph (plain line, two-port arc, plain
// arrowhead — dashed when undressed). Pure rendering, no kernel
// reads.

import type { Glyph } from "../domain/views.ts";

/** One vertex glyph of the closed vocabulary, at a position. */
function vertexGlyphElement({
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
  if (glyph.shape === "circle")
    return <circle cx={x} cy={y} r={16} fill={fill} stroke={stroke} strokeWidth={strokeWidth} />;
  if (glyph.shape === "ellipse")
    return (
      <ellipse
        cx={x}
        cy={y}
        rx={24}
        ry={14}
        fill={fill}
        stroke={stroke}
        strokeWidth={strokeWidth}
      />
    );
  if (glyph.shape === "rectangle")
    return (
      <rect
        x={x - 22}
        y={y - 12}
        width={44}
        height={24}
        rx={2}
        fill={fill}
        stroke={stroke}
        strokeWidth={strokeWidth}
      />
    );
  if (glyph.shape === "box")
    return (
      <rect
        x={x - 26}
        y={y - 12}
        width={52}
        height={24}
        rx={3}
        fill="#ffffff"
        stroke="#455555"
        strokeWidth={strokeWidth}
      />
    );
  return null;
}

/** One drawn vertex: the glyphs decided by the lens for its type,
 * overlaid in the order posed, the name inside, dashed when the lens
 * knows nothing of it. */
export function NodeGlyph({
  name,
  shape,
  position,
  selected,
  onPick,
}: {
  name: string;
  shape: Glyph[] | null;
  position: { x: number; y: number };
  selected: boolean;
  onPick: () => void;
}) {
  const { x, y } = position;
  const glyphs = shape ?? [];
  const shapeKind = glyphs.length > 0 ? (glyphs[0]?.shape ?? null) : null;
  const stroke = "#94a3b8";
  const strokeWidth = selected ? 2.5 : 1.5;
  return (
    <g onClick={onPick} style={{ cursor: "pointer" }}>
      {glyphs.map((glyph, index) => (
        <g key={index}>{vertexGlyphElement({ glyph, x, y, strokeWidth })}</g>
      ))}
      {glyphs.length === 0 && (
        <circle cx={x} cy={y} r={16} fill="none" stroke={stroke} strokeDasharray="3 3" />
      )}
      <text
        x={x}
        y={y + 3}
        textAnchor="middle"
        fontSize={9}
        fill={shapeKind === "rectangle" ? "#f8fafc" : "#334155"}
      >
        {name}
      </text>
    </g>
  );
}

/** One drawn edge between two vertices: a wide transparent line
 * under the visible one (the click target), two-port squares, a
 * plain arrowhead, the weight as label — dashed when the lens knows
 * nothing of the edge type. */
export function EdgeGlyph({
  name,
  shape,
  from,
  to,
  weight,
  selected,
  onPick,
}: {
  name: string;
  shape: Glyph[] | null;
  weight?: number | null;
  from: { x: number; y: number };
  to: { x: number; y: number };
  selected: boolean;
  onPick: () => void;
}) {
  const glyphs = (shape ?? []).filter((glyph) => glyph.shape === "line");
  const hasPorts = glyphs.some((glyph) => glyph.shape === "line" && glyph.ports === 2);
  const hasArrow = glyphs.some((glyph) => glyph.shape === "line" && glyph.arrow === "plain");
  const stroke = glyphs.length > 0 ? (glyphs[0]?.stroke ?? "#94a3b8") : "#94a3b8";
  const strokeWidth = selected ? 2.5 : 1.5;

  // trim the line ends so it does not run under the vertex glyphs
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.sqrt(dx * dx + dy * dy) || 1;
  const unitX = dx / length;
  const unitY = dy / length;
  const trim = 20 / length;
  const x1 = from.x + dx * trim;
  const y1 = from.y + dy * trim;
  const x2 = to.x - dx * trim;
  const y2 = to.y - dy * trim;

  return (
    <g onClick={onPick} style={{ cursor: "pointer" }}>
      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="transparent" strokeWidth={12} />
      <line
        x1={x1}
        y1={y1}
        x2={x2}
        y2={y2}
        stroke={stroke}
        strokeWidth={strokeWidth}
        strokeDasharray={glyphs.length > 0 ? undefined : "3 3"}
      />
      {hasPorts && (
        <>
          <rect x={x1 - 2.5} y={y1 - 2.5} width={5} height={5} fill="#455555" />
          <rect x={x2 - 2.5} y={y2 - 2.5} width={5} height={5} fill="#455555" />
        </>
      )}
      {hasArrow && (
        <polygon
          points={
            `${x2},${y2} ${x2 - unitX * 8 - unitY * 3},${y2 - unitY * 8 + unitX * 3} ` +
            `${x2 - unitX * 8 + unitY * 3},${y2 - unitY * 8 - unitX * 3}`
          }
          fill="#455555"
        />
      )}
      <text x={(x1 + x2) / 2} y={(y1 + y2) / 2 - 3} textAnchor="middle" fontSize={8} fill="#94a3b8">
        {name}
        {weight !== null && weight !== undefined ? " · poids " + weight : ""}
      </text>
    </g>
  );
}
