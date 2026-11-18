// The SVG glyphs of panel ④: one node glyph (circle, ellipse,
// rectangle, box — dashed when the lens dresses the type with no
// shape) and one edge glyph (plain line, two-port arc, plain
// arrowhead — dashed when undressed). Pure rendering, no kernel
// reads.

import type { NodeSize, RawGlyph } from "../domain/views.ts";
import { labelPosition, svgDataElement, vertexGlyphElement } from "./glyphShape.tsx";
import { arcPathData, glyphBounds, scaledGlyph } from "./glyphGeometry.ts";
import {
  resolveDrawFn,
  resolveGlyphList,
  type DisplayFnContext,
} from "./displayFunctions.ts";
import type { Glyph } from "../domain/views.ts";

/** One drawn vertex: the glyphs decided by the lens for its type,
 * overlaid in the order posed, the name inside, dashed when the lens
 * knows nothing of it. The node's size datum (issue #285) scales the
 * glyphs and rotates them around the node's centre. Display functions
 * (ADR-0119) resolve here, per node, against the fn context. */
export function NodeGlyph({
  name,
  shape,
  draw,
  fnContext,
  position,
  size,
  selected,
  onPick,
}: {
  name: string;
  shape: RawGlyph[] | null;
  draw?: import("../domain/displayFunctions.ts").DisplayFn | null;
  fnContext?: DisplayFnContext | undefined;
  position: { x: number; y: number };
  size?: NodeSize | undefined;
  selected: boolean;
  onPick: () => void;
}) {
  const { x, y } = position;
  const glyphs = resolveGlyphList(shape ?? [], fnContext);
  const drawTree = resolveDrawFn(draw ?? null, fnContext);
  const shapeKind = glyphs.length > 0 ? (glyphs[0]?.shape ?? null) : null;
  const stroke = "#94a3b8";
  const strokeWidth = selected ? 2.5 : 1.5;
  const nodeAngle = size?.angle ?? 0;
  const label =
    glyphs.length > 0
      ? labelPosition({ glyph: scaledGlyph(glyphs[0] as Glyph, size?.scale ?? 1), x, y, angle: nodeAngle })
      : null;
  return (
    <g onClick={onPick} style={{ cursor: "pointer" }}>
      {glyphs.map((glyph, index) => (
        <g key={index}>{vertexGlyphElement({ glyph, x, y, strokeWidth, size })}</g>
      ))}
      {drawTree !== null && (
        <g transform={"translate(" + x + " " + y + ")"}>{svgDataElement(drawTree, 0)}</g>
      )}
      {glyphs.length === 0 && drawTree === null && (
        <circle cx={x} cy={y} r={16} fill="none" stroke={stroke} strokeDasharray="3 3" />
      )}
      <text
        x={label?.x ?? x}
        y={label?.y ?? y + 3}
        textAnchor={label?.textAnchor ?? "middle"}
        fontSize={9}
        className={shapeKind === "rectangle" ? "fill-slate-50 dark:fill-slate-100" : shapeKind === null ? "fill-slate-700 dark:fill-slate-300" : "fill-slate-700"}
      >
        {name}
      </text>
    </g>
  );
}

/** One drawn edge between two vertices: a wide transparent polyline
 * under the visible one (the click target), two-port squares, a
 * plain arrowhead, the weight as label — dashed when the lens knows
 * nothing of the edge type. The arc may carry waypoints (issue #220):
 * the line then bends through them, and a selected arc shows them as
 * draggable handles. */
export function EdgeGlyph({
  name,
  shape,
  fnContext,
  from,
  to,
  waypoints = [],
  weight,
  fromShape = null,
  fromSize,
  toShape = null,
  toSize,
  selected,
  onPick,
  onAddWaypoint,
  onWaypointPointerDown,
  onWaypointDoubleClick,
  waypointDragIndex = null,
}: {
  name: string;
  shape: RawGlyph[] | null;
  fnContext?: DisplayFnContext | undefined;
  weight?: number | null;
  from: { x: number; y: number };
  to: { x: number; y: number };
  waypoints?: { x: number; y: number }[];
  fromShape?: RawGlyph[] | null;
  fromSize?: NodeSize | undefined;
  toShape?: RawGlyph[] | null;
  toSize?: NodeSize | undefined;
  selected: boolean;
  onPick: () => void;
  onAddWaypoint?: (event: React.MouseEvent<SVGGElement>) => void;
  onWaypointPointerDown?: (index: number, event: React.PointerEvent<SVGCircleElement>) => void;
  onWaypointDoubleClick?: (index: number) => void;
  waypointDragIndex?: number | null;
}) {
  const glyphs = resolveGlyphList(shape ?? [], fnContext).filter(
    (glyph): glyph is Glyph & { shape: "line" } => glyph.shape === "line",
  );
  const hasPorts = glyphs.some((glyph) => glyph.shape === "line" && glyph.ports === 2);
  const hasArrow = glyphs.some((glyph) => glyph.shape === "line" && glyph.arrow === "plain");
  const curve = glyphs.find((glyph) => glyph.shape === "line" && glyph.curve !== undefined)?.curve ?? "polyline";
  const edgeDash = glyphs.some((glyph) => glyph.shape === "line" && glyph.dash === true);
  const stroke = glyphs.length > 0 ? (glyphs[0]?.stroke ?? "#94a3b8") : "#94a3b8";
  const strokeWidth = selected ? 2.5 : 1.5;

  // the polyline the arc follows: from → waypoints → to, then the
  // ends are trimmed so the line does not run under the vertex
  // glyphs — the trim is the distance from the node's centre to the
  // EFFECTIVE bounds (scaled, rotated — issue #285), not a constant
  const polyline = [from, ...waypoints, to];
  const trimDistance = (
    endpointShape: RawGlyph[] | null,
    endpointSize: NodeSize | undefined,
    dx: number,
    dy: number,
  ): number => {
    const glyphs = resolveGlyphList(endpointShape ?? [], fnContext);
    if (glyphs.length === 0) return 20;
    const scale = endpointSize?.scale ?? 1;
    const angle = endpointSize?.angle ?? 0;
    let distance = 0;
    for (const glyph of glyphs) {
      if (glyph.shape === "line") continue;
      const bounds = glyphBounds(scaledGlyph(glyph, scale), angle);
      const alongX = dx !== 0 ? Math.max(bounds.x1, -bounds.x0) / Math.abs(dx) : Infinity;
      const alongY = dy !== 0 ? Math.max(bounds.y1, -bounds.y0) / Math.abs(dy) : Infinity;
      distance = Math.max(distance, Math.min(alongX, alongY));
    }
    return distance > 0 ? distance : 20;
  };
  const trimEnd = (points: { x: number; y: number }[], atStart: boolean) => {
    const a = atStart ? points[0] : points[points.length - 1];
    const b = atStart ? points[1] : points[points.length - 2];
    if (a === undefined || b === undefined) return a;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const length = Math.sqrt(dx * dx + dy * dy) || 1;
    const trim =
      (atStart
        ? trimDistance(fromShape, fromSize, dx, dy)
        : trimDistance(toShape, toSize, -dx, -dy)) / length;
    return atStart
      ? { x: a.x + dx * trim, y: a.y + dy * trim }
      : { x: a.x - dx * trim, y: a.y - dy * trim };
  };
  const drawn = polyline.map((point, index) =>
    index === 0
      ? trimEnd(polyline, true)
      : index === polyline.length - 1
        ? trimEnd(polyline, false)
        : point,
  );
  const pathData = arcPathData({
    points: drawn.map((point) => point ?? from),
    curve,
  });
  const labelAnchor = drawn[Math.floor(drawn.length / 2)] ?? from;

  // the arrowhead follows the last segment's direction
  const tailA = drawn[drawn.length - 2] ?? from;
  const tailB = drawn[drawn.length - 1] ?? to;
  const dx = tailB.x - tailA.x;
  const dy = tailB.y - tailA.y;
  const length = Math.sqrt(dx * dx + dy * dy) || 1;
  const unitX = dx / length;
  const unitY = dy / length;
  const x2 = tailB.x;
  const y2 = tailB.y;
  const x1 = drawn[0]?.x ?? from.x;
  const y1 = drawn[0]?.y ?? from.y;

  return (
    <g
      onClick={onPick}
      onDoubleClick={onAddWaypoint}
      style={{ cursor: "pointer" }}
      data-edge={name}
    >
      <path d={pathData} stroke="transparent" strokeWidth={12} fill="none" />
      <path
        d={pathData}
        stroke={stroke}
        strokeWidth={strokeWidth}
        fill="none"
        strokeDasharray={glyphs.length > 0 ? (edgeDash ? "3 3" : undefined) : "3 3"}
      />
      {hasPorts && (
        <>
          <rect x={x1 - 2.5} y={y1 - 2.5} width={5} height={5} className="fill-slate-600 dark:fill-slate-400" />
          <rect x={x2 - 2.5} y={y2 - 2.5} width={5} height={5} className="fill-slate-600 dark:fill-slate-400" />
        </>
      )}
      {hasArrow && (
        <polygon
          points={
            `${x2},${y2} ${x2 - unitX * 8 - unitY * 3},${y2 - unitY * 8 + unitX * 3} ` +
            `${x2 - unitX * 8 + unitY * 3},${y2 - unitY * 8 - unitX * 3}`
          }
          className="fill-slate-600 dark:fill-slate-400"
        />
      )}
      <text x={labelAnchor.x} y={labelAnchor.y - 3} textAnchor="middle" fontSize={8} fill="#94a3b8">
        {name}
        {weight !== null && weight !== undefined ? " · poids " + weight : ""}
      </text>
      {selected &&
        waypoints.map((point, index) => (
          <circle
            key={index}
            cx={point?.x ?? 0}
            cy={point?.y ?? 0}
            r={waypointDragIndex === index ? 5 : 4}
            className="fill-sky-500 stroke-white dark:stroke-slate-800"
            strokeWidth={1}
            style={{ cursor: "grab" }}
            data-waypoint={name + "/" + index}
            onPointerDown={(event) => onWaypointPointerDown?.(index, event)}
            onDoubleClick={(event) => {
              event.stopPropagation();
              onWaypointDoubleClick?.(index);
            }}
          />
        ))}
    </g>
  );
}
