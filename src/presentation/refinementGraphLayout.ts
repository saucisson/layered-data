// The layout of the SHARED refinement graph (issue #217, reworked in
// #236): dagre (the Sugiyama layered layout) computes the ranks and
// the crossing-minimized order inside each rank; then each rank wraps
// onto as many lines as the container width needs, so the graph always
// fits the page (no horizontal scroll), and a final descent on the
// wrapped geometry removes the crossings the wrapping may have
// re-introduced. The wrapped geometry leaves zones no pill ever
// enters — the inter-line gaps inside a band, the channel between two
// bands, the page margins — and the drawn edges are ROUTED through
// them: an arrow leaves its source pill, runs its horizontal legs
// inside a channel, climbs or descends a corridor that keeps clear of
// every pill on the lines it crosses, and lands on the edge of its
// target pill — no curve ever flows through a pastille. Only the
// inheritance edges drive the layout; the usage edges (issue #235)
// are drawn on top through the same router. Deterministic: dagre is
// deterministic for a fixed insertion order, ties keep the inventory
// order, the corridor search is exhaustive on the free columns. Pure
// geometry — no React, so the checks can import it.

import { graphlib } from "dagre";
import * as dagre from "dagre";
import type { RefinementDag } from "./workshopInventory.ts";

// dagre is CommonJS: under Node's ESM loader only some named exports
// are detected, so the layout function is reached through the default
// export (module.exports) when present — same object in the browser.
const dagreLayout = ((dagre as { default?: typeof dagre }).default ?? dagre).layout;

// Layout metrics for the wrapped graph (font-mono text-[10px] pills).
const CHARACTER_WIDTH = 6.4;
const NODE_PADDING = 40;
const HORIZONTAL_GAP = 12;
const VERTICAL_GAP = 10;
// the channel between two bands: enough room for the 8 px arrowheads
// to travel between the last line of a band and the first of the next.
const BAND_GAP = 24;
const ROW = 34;
export const NODE_HEIGHT = 26;
const MARGIN = 8;
// dagre metrics: gap between two nodes of the same rank, gap between
// two ranks (the layout only reads the ranks and the order from dagre).
const NODESEP = HORIZONTAL_GAP;
const RANKSEP = 34;
// routing: a vertical corridor keeps this distance from the pills it
// passes between; the renderer bends the corners of the routed legs on
// this radius; a pill pass-through outweighs a curve crossing in the
// descent score.
const CORRIDOR_MARGIN = 3;
export const CORNER_RADIUS = 6;
const PILL_PENALTY = 10;

interface WrappedPosition {
  x: number;
  y: number;
  w: number;
}

/** One waypoint of a routed edge; consecutive waypoints are straight
 * legs, the renderer rounds the corners between them. */
export interface RoutePoint {
  x: number;
  y: number;
}

/** One horizontal line of a wrapped rank: its y, its members, and the
 * kind of gap opening above and below it — the inter-line gap inside
 * its band, or the channel of a band boundary. */
interface WrappedLine {
  y: number;
  members: string[];
  bandAbove: boolean;
  bandBelow: boolean;
}

export interface RefinementGraphLayout {
  W: number;
  H: number;
  position: (layerName: string) => WrappedPosition;
  /** The routed waypoints of the edge sourceName ⇢ targetName — null
   * when either end is not inventoried (nothing must be drawn).
   * The pills' placement decides the shape: the route climbs when the
   * source sits below the target, descends when it sits above, and
   * makes a U when both sit on the same line. The legs are straight
   * and the renderer rounds the corners on CORNER_RADIUS. `offset`
   * shifts both end columns (the usage edges draw beside the
   * refinements), the corridor keeps clearing the pills. */
  route: (sourceName: string, targetName: string, offset?: number) => RoutePoint[] | null;
  bands: { y: number; h: number }[];
}

/** dagre ranks and orders the inheritance DAG (rankdir BT: children at
 * the bottom, parents at the top, like the drawn arrows), then each
 * rank wraps onto as many lines as `width` needs, and a descent on the
 * wrapped geometry removes the crossings the wrapping re-introduced.
 * The returned `route` draws one edge through the empty zones of the
 * wrapped geometry. Deterministic: dagre is deterministic for a fixed
 * insertion order, ties keep the inventory order. */
export function computeRefinementGraphLayout({
  layerNames,
  dag,
  width,
}: {
  layerNames: readonly string[];
  dag: RefinementDag;
  width: number;
}): RefinementGraphLayout {
  const widthOf = (layerName: string) =>
    Math.ceil(layerName.length * CHARACTER_WIDTH) + NODE_PADDING;

  const graph = new graphlib.Graph();
  graph.setGraph({ rankdir: "BT", nodesep: NODESEP, ranksep: RANKSEP });
  graph.setDefaultEdgeLabel(() => ({}));
  for (const layerName of layerNames) {
    graph.setNode(layerName, { width: widthOf(layerName), height: NODE_HEIGHT });
  }
  for (const layerName of layerNames) {
    for (const parentName of dag.targetsOf(layerName)) {
      graph.setEdge(layerName, parentName);
    }
  }
  dagreLayout(graph);

  // Group the nodes by rank (with rankdir BT, one rank = one y), top
  // rank first; inside a rank keep dagre's left-to-right order.
  const byRank = new Map<number, string[]>();
  for (const layerName of layerNames) {
    const rank = Math.round(graph.node(layerName).y);
    const row = byRank.get(rank) ?? [];
    row.push(layerName);
    byRank.set(rank, row);
  }
  const rows = [...byRank.entries()]
    .sort((first, second) => first[0] - second[0])
    .map(([, row]) =>
      [...row].sort((first, second) => graph.node(first).x - graph.node(second).x),
    );

  // Wrap each rank onto as many lines as the width needs, one band per
  // rank spanning all its lines. Each line remembers whether the gap
  // above and below it is the channel of a band boundary — the router
  // only knows lines and the kinds of gaps around them.
  const wrap = (rankRows: readonly string[][]) => {
    const positions: Record<string, WrappedPosition> = {};
    const lines: WrappedLine[] = [];
    const bands: { y: number; h: number }[] = [];
    let cursorY = MARGIN;
    for (const row of rankRows) {
      const bandTop = cursorY;
      let cursorX = MARGIN;
      for (const layerName of row) {
        const w = widthOf(layerName);
        if (cursorX > MARGIN && cursorX + w > width - MARGIN) {
          cursorX = MARGIN;
          cursorY += ROW + VERTICAL_GAP;
        }
        positions[layerName] = { x: cursorX, y: cursorY, w };
        let line = lines[lines.length - 1];
        if (!line || line.y !== cursorY) {
          line = { y: cursorY, members: [], bandAbove: cursorY === bandTop, bandBelow: false };
          lines.push(line);
        }
        line.members.push(layerName);
        cursorX += w + HORIZONTAL_GAP;
      }
      cursorY += ROW;
      bands.push({ y: bandTop - 4, h: cursorY - bandTop + 4 });
      cursorY += BAND_GAP;
      const lastLine = lines[lines.length - 1];
      if (lastLine) lastLine.bandBelow = true;
    }
    return { positions, lines, bands, H: cursorY + MARGIN };
  };

  // ---- barycenter sweeps on the wrapped geometry (parents pull
  // their children close, children pull their parents), seeded by
  // dagre's order ----
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
  const maxRank = rows.length - 1;
  for (let sweep = 0; sweep < 2; sweep++) {
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

  // ---- the wrapped geometry seen by the router: pills, the lines
  // they sit on, and the channels — the empty gaps no pill enters ----
  const edgeList: { child: string; parent: string }[] = [];
  for (const layerName of layerNames)
    for (const parentName of dag.targetsOf(layerName))
      edgeList.push({ child: layerName, parent: parentName });

  const lineIndexOf = (lines: readonly WrappedLine[], y: number): number => {
    for (let index = 0; index < lines.length; index++) {
      if (lines[index]?.y === y) return index;
    }
    return -1;
  };
  // the centre of the empty gap above (resp. below) a line: the band
  // channel at a boundary, the inter-line gap inside the band
  const channelAbove = (line: WrappedLine): number =>
    line.bandAbove ? Math.max(line.y - BAND_GAP / 2, 2) : line.y - VERTICAL_GAP / 2;
  const channelBelow = (line: WrappedLine): number =>
    line.bandBelow
      ? line.y + NODE_HEIGHT + BAND_GAP / 2
      : line.y + NODE_HEIGHT + VERTICAL_GAP / 2;

  // The corridor of a vertical leg: the free x column clear of every
  // pill of every crossed line (with a margin), the free column closest
  // to the mid-source/target column winning, the lowest x breaking
  // the ties — exhaustive on the free intervals, so the result only
  // depends on the wrapped geometry.
  const corridorOf = (
    positions: Record<string, WrappedPosition>,
    crossed: readonly WrappedLine[],
    sourceX: number,
    targetX: number,
  ): number => {
    let free: [number, number][] = [[-4, width + 4]];
    for (const line of crossed) {
      for (const member of line.members) {
        const pill = positions[member];
        if (!pill) continue;
        const low = pill.x - CORRIDOR_MARGIN;
        const high = pill.x + pill.w + CORRIDOR_MARGIN;
        const next: [number, number][] = [];
        for (const entry of free) {
          if (high <= entry[0] || low >= entry[1]) {
            next.push(entry);
            continue;
          }
          if (low > entry[0]) next.push([entry[0], low]);
          if (high < entry[1]) next.push([high, entry[1]]);
        }
        free = next;
      }
    }
    const ideal = (sourceX + targetX) / 2;
    let bestX = sourceX;
    let bestDistance = Number.POSITIVE_INFINITY;
    for (const entry of free) {
      const low = entry[0];
      const high = entry[1];
      if (high <= low) continue;
      for (const candidate of [low, high, ideal]) {
        const x = Math.min(Math.max(candidate, low), high);
        const distance = Math.abs(x - ideal);
        if (distance < bestDistance || (distance === bestDistance && x < bestX)) {
          bestX = x;
          bestDistance = distance;
        }
      }
    }
    return bestX;
  };

  /** Consecutive duplicate or aligned waypoints collapse into one
   * leg — the general construction branches leave some. */
  const collapse = (waypoints: RoutePoint[]): RoutePoint[] => {
    const kept: RoutePoint[] = [];
    for (const point of waypoints) {
      const last = kept[kept.length - 1];
      if (last && last.x === point.x && last.y === point.y) continue;
      const previous = kept[kept.length - 2];
      if (
        last && previous &&
        ((previous.x === last.x && last.x === point.x) ||
          (previous.y === last.y && last.y === point.y))
      ) {
        kept[kept.length - 1] = point;
        continue;
      }
      kept.push(point);
    }
    return kept;
  };

  /** The route of one edge through the empty zones of the wrapped
   * geometry. The arrow leaves the source pill at its bottom edge
   * (climbing, the first leg begins under the pill that hides it, as
   * the historical curves that started inside the pill), joins the
   * channel at its side, crosses the intermediate lines through the
   * free corridor, runs the target's channel, and lands on the edge
   * of the target facing the source — bottom edge above, top edge
   * below, a U-under-the-line when both ends sit on the same line.
   * Deterministic. */
  const routeOf = (
    positions: Record<string, WrappedPosition>,
    lines: readonly WrappedLine[],
    sourceName: string,
    targetName: string,
    offset: number,
  ): RoutePoint[] | null => {
    const source = positions[sourceName];
    const target = positions[targetName];
    if (!source || !target) return null;
    const sourceLineIndex = lineIndexOf(lines, source.y);
    const targetLineIndex = lineIndexOf(lines, target.y);
    const sourceLine = sourceLineIndex >= 0 ? lines[sourceLineIndex] : null;
    const targetLine = targetLineIndex >= 0 ? lines[targetLineIndex] : null;
    if (!sourceLine || !targetLine) return null;
    const sourceX = source.x + source.w / 2 + offset;
    const targetX = target.x + target.w / 2 + offset;
    const anchor: RoutePoint = { x: sourceX, y: source.y + NODE_HEIGHT };

    // both ends on one line: a U through the gap under the line,
    // landing on the target's bottom edge
    if (sourceLine === targetLine) {
      const under = channelBelow(sourceLine);
      return [
        anchor,
        { x: sourceX, y: under },
        { x: targetX, y: under },
        { x: targetX, y: target.y + NODE_HEIGHT },
      ];
    }

    const upward = target.y < source.y;
    const landing: RoutePoint = upward
      ? { x: targetX, y: target.y + NODE_HEIGHT }
      : { x: targetX, y: target.y };
    // the channel at each end's side: below the source line when it
    // descends, above it when it climbs (the first leg then begins
    // under the pill that hides it), symmetrically at the target
    const sourceChannel = upward ? channelAbove(sourceLine) : channelBelow(sourceLine);
    const targetChannel = upward ? channelBelow(targetLine) : channelAbove(targetLine);
    // the lines strictly between the two ends' lines
    const crossed = lines.slice(
      Math.min(sourceLineIndex, targetLineIndex) + 1,
      Math.max(sourceLineIndex, targetLineIndex),
    );

    const waypoints: RoutePoint[] = [anchor, { x: sourceX, y: sourceChannel }];
    if (Math.abs(sourceChannel - targetChannel) >= 0.5) {
      const corridor = corridorOf(positions, crossed, sourceX, targetX);
      waypoints.push({ x: corridor, y: sourceChannel });
      waypoints.push({ x: corridor, y: targetChannel });
    }
    waypoints.push({ x: targetX, y: targetChannel });
    waypoints.push(landing);
    return collapse(waypoints);
  };

  // ---- descent on the wrapped geometry: try every adjacent swap
  // inside a rank, keep the ones that lower the real number of route
  // crossings and pill pass-throughs (the corridor removes the latter
  // by construction; the count keeps the descent honest when no free
  // corridor exists) ----
  // The routes are polylines with a handful of legs: the descent scores
  // them EXACTLY on the legs (segment/segment and segment/rectangle
  // tests), never on samples — sampling every few px made the descent
  // quadratic in the route length and hung the page.
  interface Leg {
    from: RoutePoint;
    to: RoutePoint;
  }
  const legsOf = (route: RoutePoint[] | null): Leg[] => {
    const legs: Leg[] = [];
    if (!route) return legs;
    for (let index = 0; index + 1 < route.length; index++) {
      const from = route[index];
      const to = route[index + 1];
      if (from && to) legs.push({ from, to });
    }
    return legs;
  };
  const segmentsCross = (
    first: RoutePoint,
    second: RoutePoint,
    third: RoutePoint,
    fourth: RoutePoint,
  ): boolean => {
    const denominator =
      (second.x - first.x) * (fourth.y - third.y) -
      (second.y - first.y) * (fourth.x - third.x);
    if (denominator === 0) return false;
    const t =
      ((third.x - first.x) * (fourth.y - third.y) -
        (third.y - first.y) * (fourth.x - third.x)) /
      denominator;
    const u =
      ((third.x - first.x) * (second.y - first.y) -
        (third.y - first.y) * (second.x - first.x)) /
      denominator;
    return t > 0 && t < 1 && u > 0 && u < 1;
  };
  interface LeggedRoute {
    edge: { child: string; parent: string };
    legs: Leg[];
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
  }
  const routesOf = (
    positions: Record<string, WrappedPosition>,
    lines: readonly WrappedLine[],
  ): LeggedRoute[] => {
    const routes: LeggedRoute[] = [];
    for (const edge of edgeList) {
      const route = routeOf(positions, lines, edge.child, edge.parent, 0);
      const legs = legsOf(route);
      const xs = (route ?? []).map((point) => point.x);
      const ys = (route ?? []).map((point) => point.y);
      routes.push({
        edge,
        legs,
        minX: xs.length ? Math.min(...xs) : 0,
        maxX: xs.length ? Math.max(...xs) : 0,
        minY: ys.length ? Math.min(...ys) : 0,
        maxY: ys.length ? Math.max(...ys) : 0,
      });
    }
    return routes;
  };
  const countCrossings = (routes: readonly LeggedRoute[]): number => {
    let crossings = 0;
    for (let first = 0; first < routes.length; first++) {
      for (let second = first + 1; second < routes.length; second++) {
        const a = routes[first];
        const b = routes[second];
        if (!a || !b) continue;
        if (a.edge.child === b.edge.child || a.edge.child === b.edge.parent) continue;
        if (a.edge.parent === b.edge.child || a.edge.parent === b.edge.parent) continue;
        if (a.legs.length === 0 || b.legs.length === 0) continue;
        if (a.maxY < b.minY || b.maxY < a.minY) continue;
        if (a.maxX < b.minX || b.maxX < a.minX) continue;
        let hit = false;
        for (const legA of a.legs) {
          for (const legB of b.legs) {
            if (segmentsCross(legA.from, legA.to, legB.from, legB.to)) {
              hit = true;
              break;
            }
          }
          if (hit) break;
        }
        if (hit) crossings++;
      }
    }
    return crossings;
  };
  // does the leg enter the pill rectangle (an endpoint inside, or the
  // leg crossing one of its four edges)?
  const legHitsPill = (leg: Leg, pill: WrappedPosition): boolean => {
    const left = pill.x;
    const right = pill.x + pill.w;
    const top = pill.y;
    const bottom = pill.y + NODE_HEIGHT;
    const inside = (point: RoutePoint): boolean =>
      point.x >= left && point.x <= right && point.y >= top && point.y <= bottom;
    if (inside(leg.from) || inside(leg.to)) return true;
    const corners: RoutePoint[] = [
      { x: left, y: top },
      { x: right, y: top },
      { x: right, y: bottom },
      { x: left, y: bottom },
    ];
    for (let index = 0; index < 4; index++) {
      const cornerA = corners[index];
      const cornerB = corners[(index + 1) % 4];
      if (cornerA && cornerB && segmentsCross(leg.from, leg.to, cornerA, cornerB)) return true;
    }
    return false;
  };
  const countPillHits = (
    positions: Record<string, WrappedPosition>,
    routes: readonly LeggedRoute[],
  ): number => {
    let hits = 0;
    for (const entry of routes) {
      for (const layerName of layerNames) {
        if (layerName === entry.edge.child || layerName === entry.edge.parent) continue;
        const pill = positions[layerName];
        if (!pill) continue;
        if (entry.legs.some((leg) => legHitsPill(leg, pill))) hits++;
      }
    }
    return hits;
  };
  const scoreOf = (wrapped: ReturnType<typeof wrap>): number => {
    const routes = routesOf(wrapped.positions, wrapped.lines);
    return (
      countCrossings(routes) + PILL_PENALTY * countPillHits(wrapped.positions, routes)
    );
  };

  let best = wrap(rows);
  let bestScore = scoreOf(best);
  for (let sweep = 0; sweep < 4 && bestScore > 0; sweep++) {
    let improved = false;
    for (const row of rows) {
      for (let index = 0; index + 1 < row.length; index++) {
        const left = row[index];
        const right = row[index + 1];
        if (left === undefined || right === undefined) continue;
        row[index] = right;
        row[index + 1] = left;
        const candidate = wrap(rows);
        const score = scoreOf(candidate);
        if (score < bestScore) {
          best = candidate;
          bestScore = score;
          improved = true;
        } else {
          row[index] = left;
          row[index + 1] = right;
        }
      }
    }
    if (!improved) break;
  }

  const { positions, lines, bands, H } = best;
  return {
    W: width,
    H,
    position: (layerName) => positions[layerName] ?? { x: 0, y: 0, w: 0 },
    route: (sourceName, targetName, offset = 0) =>
      routeOf(positions, lines, sourceName, targetName, offset),
    bands,
  };
}
