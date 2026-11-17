// The wrapped layout of the SHARED refinement graph (issue #217): each
// generation wraps onto as many lines as the container width needs,
// then barycenter sweeps + a crossing descent order the generations so
// the curves cross as little as possible. Deterministic: ties keep the
// inventory order. Pure geometry — no React, so the checks can import
// it directly.

import { computeGraphLayout, RefinementDag } from "./workshopInventory.ts";

// Layout metrics for the wrapped graph (font-mono text-[10px] pills).
const CHARACTER_WIDTH = 6.4;
const NODE_PADDING = 40;
const HORIZONTAL_GAP = 12;
const VERTICAL_GAP = 10;
const ROW = 34;
export const NODE_HEIGHT = 26;
const MARGIN = 8;

interface WrappedPosition {
  x: number;
  y: number;
  w: number;
}

export interface RefinementGraphLayout {
  W: number;
  H: number;
  position: (layerName: string) => WrappedPosition;
  bands: { y: number; h: number }[];
}

/** Wrap each generation onto as many lines as needed to fit `width`,
 * then re-order the generations in the wrapped geometry (barycenter
 * sweeps: parents pull their children, children pull their parents) so
 * the curves cross as little as possible. Deterministic: ties keep the
 * inventory order. */
export function computeRefinementGraphLayout({
  layerNames,
  dag,
  width,
}: {
  layerNames: readonly string[];
  dag: RefinementDag;
  width: number;
}): RefinementGraphLayout {
  const base = computeGraphLayout({ layerNames, dag });
  const widthOf = (layerName: string) =>
    Math.ceil(layerName.length * CHARACTER_WIDTH) + NODE_PADDING;

  const wrap = (rows: readonly string[][]) => {
    const positions: Record<string, WrappedPosition> = {};
    const bands: { y: number; h: number }[] = [];
    let cursorY = MARGIN;
    for (const row of rows) {
      const bandTop = cursorY;
      let cursorX = MARGIN;
      for (const layerName of row) {
        const w = widthOf(layerName);
        if (cursorX > MARGIN && cursorX + w > width - MARGIN) {
          cursorX = MARGIN;
          cursorY += ROW + VERTICAL_GAP;
        }
        positions[layerName] = { x: cursorX, y: cursorY, w };
        cursorX += w + HORIZONTAL_GAP;
      }
      cursorY += ROW;
      bands.push({ y: bandTop - 4, h: cursorY - bandTop + 4 });
      cursorY += VERTICAL_GAP;
    }
    return { positions, bands, H: cursorY + MARGIN };
  };

  const rows = base.rows.map((row) => [...row]);
  const maxRank = rows.length - 1;
  const centerXOf = (
    positions: Record<string, WrappedPosition>,
    layerName: string,
  ) => {
    const position = positions[layerName];
    return position ? position.x + position.w / 2 : 0;
  };
  const sortByBarycenter = (
    rank: number,
    neighboursOf: (layerName: string) => readonly string[],
    positions: Record<string, WrappedPosition>,
  ) => {
    const scored = (rows[rank] ?? []).map((layerName) => {
      const neighbours = neighboursOf(layerName);
      const barycenter = neighbours.length
        ? neighbours.reduce((total, neighbour) => total + centerXOf(positions, neighbour), 0) /
          neighbours.length
        : centerXOf(positions, layerName);
      return { layerName, barycenter };
    });
    scored.sort(
      (first, second) =>
        first.barycenter - second.barycenter ||
        layerNames.indexOf(first.layerName) - layerNames.indexOf(second.layerName),
    );
    rows[rank] = scored.map((scoredNode) => scoredNode.layerName);
  };

  for (let sweep = 0; sweep < 3; sweep++) {
    let wrapped = wrap(rows);
    for (let rank = 1; rank <= maxRank; rank++) {
      sortByBarycenter(rank, (layerName) => dag.targetsOf(layerName), wrapped.positions);
      wrapped = wrap(rows);
    }
    for (let rank = maxRank - 1; rank >= 0; rank--) {
      sortByBarycenter(rank, (layerName) => dag.childrenOf(layerName), wrapped.positions);
      wrapped = wrap(rows);
    }
  }

  // ---- crossing descent: try every adjacent swap inside a generation,
  // keep the ones that lower the real number of curve crossings ----
  const edgeList: { child: string; parent: string }[] = [];
  for (const layerName of layerNames)
    for (const parentName of dag.targetsOf(layerName))
      edgeList.push({ child: layerName, parent: parentName });

  const CURVE_SAMPLES = 6;
  const curveOf = (
    positions: Record<string, WrappedPosition>,
    edge: { child: string; parent: string },
  ): { points: [number, number][]; minX: number; maxX: number; minY: number; maxY: number } | null => {
    const from = positions[edge.child];
    const to = positions[edge.parent];
    if (!from || !to) return null;
    const x1 = from.x + from.w / 2;
    const y1 = from.y + NODE_HEIGHT;
    const x2 = to.x + to.w / 2;
    const y2 = to.y;
    const midY = (y1 + y2) / 2;
    const points: [number, number][] = [];
    for (let index = 0; index <= CURVE_SAMPLES; index++) {
      const t = index / CURVE_SAMPLES;
      const u = 1 - t;
      points.push([
        u * u * u * x1 + 3 * u * u * t * x1 + 3 * u * t * t * x2 + t * t * t * x2,
        u * u * u * y1 + 3 * u * u * t * midY + 3 * u * t * t * midY + t * t * t * y2,
      ]);
    }
    return {
      points,
      minX: Math.min(x1, x2),
      maxX: Math.max(x1, x2),
      minY: Math.min(y1, y2),
      maxY: Math.max(y1, y2),
    };
  };
  const segmentsCross = (
    first: [number, number],
    second: [number, number],
    third: [number, number],
    fourth: [number, number],
  ): boolean => {
    const denominator =
      (second[0] - first[0]) * (fourth[1] - third[1]) -
      (second[1] - first[1]) * (fourth[0] - third[0]);
    if (denominator === 0) return false;
    const t =
      ((third[0] - first[0]) * (fourth[1] - third[1]) -
        (third[1] - first[1]) * (fourth[0] - third[0])) /
      denominator;
    const u =
      ((third[0] - first[0]) * (second[1] - first[1]) -
        (third[1] - first[1]) * (second[0] - first[0])) /
      denominator;
    return t > 0 && t < 1 && u > 0 && u < 1;
  };
  const countCrossings = (positions: Record<string, WrappedPosition>): number => {
    const curves = edgeList
      .map((edge) => ({ edge, curve: curveOf(positions, edge) }))
      .filter(
        (entry): entry is { edge: { child: string; parent: string }; curve: { points: [number, number][]; minX: number; maxX: number; minY: number; maxY: number } } =>
          entry.curve !== null,
      );
    let crossings = 0;
    for (let first = 0; first < curves.length; first++) {
      for (let second = first + 1; second < curves.length; second++) {
        const a = curves[first];
        const b = curves[second];
        if (!a || !b) continue;
        if (a.edge.child === b.edge.child || a.edge.child === b.edge.parent) continue;
        if (a.edge.parent === b.edge.child || a.edge.parent === b.edge.parent) continue;
        if (a.curve.maxY < b.curve.minY || b.curve.maxY < a.curve.minY) continue;
        if (a.curve.maxX < b.curve.minX || b.curve.maxX < a.curve.minX) continue;
        let hit = false;
        for (let i = 0; i < a.curve.points.length - 1 && !hit; i++)
          for (let j = 0; j < b.curve.points.length - 1 && !hit; j++) {
            const pointA = a.curve.points[i];
            const pointB = a.curve.points[i + 1];
            const pointC = b.curve.points[j];
            const pointD = b.curve.points[j + 1];
            if (pointA && pointB && pointC && pointD && segmentsCross(pointA, pointB, pointC, pointD))
              hit = true;
          }
        if (hit) crossings++;
      }
    }
    return crossings;
  };

  let best = wrap(rows);
  let bestCrossings = countCrossings(best.positions);
  for (let sweep = 0; sweep < 6 && bestCrossings > 0; sweep++) {
    let improved = false;
    for (let rank = 0; rank <= maxRank; rank++) {
      const row = rows[rank] ?? [];
      for (let index = 0; index + 1 < row.length; index++) {
        const left = row[index];
        const right = row[index + 1];
        if (left === undefined || right === undefined) continue;
        row[index] = right;
        row[index + 1] = left;
        const candidate = wrap(rows);
        const crossings = countCrossings(candidate.positions);
        if (crossings < bestCrossings) {
          best = candidate;
          bestCrossings = crossings;
          improved = true;
        } else {
          row[index] = left;
          row[index + 1] = right;
        }
      }
    }
    if (!improved) break;
  }
  const { positions, bands, H } = best;
  return {
    W: width,
    H,
    position: (layerName) => positions[layerName] ?? { x: 0, y: 0, w: 0 },
    bands,
  };
}

