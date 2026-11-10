// The SVG glyphs of panel ④: one node glyph (circle, ellipse,
// rectangle, box — dashed when the lens dresses the type with no
// shape) and one edge glyph (plain line, two-port arc, plain
// arrowhead — dashed when undressed). Pure rendering, no kernel
// reads.

/** One drawn vertex: the shape decided by the lens for its type,
 * the name inside, dashed when the lens knows nothing of it. */
export function NodeGlyph({
  name,
  shape,
  position,
  selected,
  onPick,
}: {
  name: string;
  shape: any;
  position: { x: number; y: number };
  selected: boolean;
  onPick: () => void;
}) {
  const { x, y } = position;
  const shapeKind = shape ? shape.shape : null;
  const stroke = shape ? shape.stroke : "#94a3b8";
  const fill = shape && shape.fill ? shape.fill : "none";
  const strokeWidth = selected ? 2.5 : 1.5;
  return (
    <g onClick={onPick} style={{ cursor: "pointer" }}>
      {shapeKind === "circle" && (
        <circle cx={x} cy={y} r={16} fill={fill} stroke={stroke} strokeWidth={strokeWidth} />
      )}
      {shapeKind === "ellipse" && (
        <ellipse
          cx={x}
          cy={y}
          rx={24}
          ry={14}
          fill={fill}
          stroke={stroke}
          strokeWidth={strokeWidth}
        />
      )}
      {shapeKind === "rectangle" && (
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
      )}
      {shapeKind === "box" && (
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
      )}
      {!shape && <circle cx={x} cy={y} r={16} fill="none" stroke={stroke} strokeDasharray="3 3" />}
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
  shape: any;
  weight?: any;
  from: { x: number; y: number };
  to: { x: number; y: number };
  selected: boolean;
  onPick: () => void;
}) {
  const hasPorts = shape && shape.ports === 2;
  const hasArrow = shape && shape.arrow === "plain";
  const stroke = shape ? shape.stroke : "#94a3b8";
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
        strokeDasharray={shape ? undefined : "3 3"}
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
