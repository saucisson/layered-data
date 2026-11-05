// Order conflicts: the diamond, made visible.
//
// First-wins is the single read semantics — and when the two
// providers of a key are INCOMPARABLE (neither lives in the other's
// closure), the first of the two wins by the ORDER of the refines
// lists: a convention the reading never blesses (ADR-0023: the
// algebra is two regimes, specificity is the only judge of values).
// This module makes the convention observable without blessing it:
// the lint inventories it, the strict staging refuses it.
//
// A conflict is a divergence of LEAF VALUE — a scalar, a
// reference, a list: what a read can return directly. Two
// incomparable dict providers are NOT a conflict: a dict opens a
// sub-address whose closure re-merges both branches, the divergence
// does not survive the scalar read (measured on the bedrock: 59 such
// topological crossings, 0 leaf-value conflicts — the ADR-0017
// records the choice).
//
// Vertical inheritance (the winner refined from the loser) is never
// a conflict: the specificity order is a declared structure, not a
// convention. Notes (__note:…) document, they do not provide.
//
// Everything here is pure: the space arrives as a parameter, the
// kernel is only read, never written.

import {
  LayerReference,
  PathReference,
  type Address,
  isDictionary,
} from "./addresses.ts";
import type { LayerName } from "./identifiers.ts";
import { walkAddresses } from "./views.ts";
import type { Space } from "./space.ts";

/** One order conflict: the read address, the contested key, the
 * winner (first provider in closure order) and a losing contender,
 * with their laid values, formatted for the observable vocabulary. */
export interface OrderConflict {
  address: Address;
  key: string;
  winner: Address;
  winnerValue: string;
  loser: Address;
  loserValue: string;
}

/** Structural equality of two laid values — never resolved: the
 * comparison stays faithful to O6 (late binding), two references
 * are equal when they designate the same address. */
function sameLaidValue(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((item, index) => sameLaidValue(item, b[index]));
  }
  if (a instanceof PathReference && b instanceof PathReference) {
    return (
      a.anchor === b.anchor &&
      a.path.length === b.path.length &&
      a.path.every((segment, index) => segment === b.path[index])
    );
  }
  if (a instanceof LayerReference && b instanceof LayerReference) return a.layer === b.layer;
  return false;
}

/** Format a laid value for a message fact — the readable trace of
 * what each side posed. A dict never reaches here (not a conflict). */
function formatLaidValue(value: unknown): string {
  if (value instanceof PathReference) {
    return "@" + value.anchor + (value.path.length ? "/" + value.path.join("/") : "");
  }
  if (value instanceof LayerReference) return "@" + value.layer;
  if (Array.isArray(value)) return "[" + value.map(formatLaidValue).join(", ") + "]";
  if (typeof value === "string") return JSON.stringify(value);
  return String(value);
}

/** The address as the vocabulary writes it: layer::path. */
export function formatAddress(address: Address): string {
  return address[0] + "::" + (address[1].join("/") || ".");
}

/** The leaf-value order conflicts of ONE address: for every visible
 * key, the providers in closure order; the first wins, every later
 * incomparable provider with a different laid value conflicts.
 * Vertical providers (the loser in the winner's closure) are
 * specificity, not order — skipped. */
export function orderConflictsAt({ space, address }: { space: Space; address: Address }): Omit<OrderConflict, "address">[] {
  const conflicts: Omit<OrderConflict, "address">[] = [];
  const [layer, path] = address;
  const closure = space.closure({ layer, path });
  for (const key of space.keys({ layer, path })) {
    // a note documents a key, it never provides one
    if (key.startsWith("__note:")) continue;
    const providers: { address: Address; value: unknown }[] = [];
    for (const source of closure) {
      const node = space.raw({ layer: source[0], path: source[1] });
      if (!isDictionary(node)) continue;
      const laid = node[key];
      // absent and transparent (null) sources do not provide; a dict
      // opens a sub-address, it lays no leaf value
      if (laid === undefined || laid === null || isDictionary(laid)) continue;
      providers.push({ address: [source[0], [...source[1]]], value: laid });
    }
    if (providers.length < 2) continue;
    const winner = providers[0];
    // the winner's own closure: every source IT is refined from —
    // a loser in there was outranked by structure, not by order
    const winnerClosure = space.closure({ layer: winner.address[0], path: winner.address[1] });
    const inWinnerClosure = (candidate: Address): boolean =>
      winnerClosure.some(
        ([closureLayer, closurePath]) =>
          closureLayer === candidate[0] &&
          closurePath.length === candidate[1].length &&
          closurePath.every((segment, index) => segment === candidate[1][index]),
      );
    for (const loser of providers.slice(1)) {
      if (sameLaidValue(winner.value, loser.value)) continue;
      if (inWinnerClosure(loser.address)) continue;
      conflicts.push({
        key,
        winner: winner.address,
        winnerValue: formatLaidValue(winner.value),
        loser: loser.address,
        loserValue: formatLaidValue(loser.value),
      });
    }
  }
  return conflicts;
}

/** The order conflicts of a set of layers: every conflict of every
 * address — the convention made visible, nothing silenced it
 * anymore (ADR-0023: no act blesses an order-decided read; to
 * resolve one is to restructure). */
export function orderConflictsOf({
  space,
  layerNames,
}: {
  space: Space;
  layerNames: readonly LayerName[];
}): OrderConflict[] {
  const output: OrderConflict[] = [];
  for (const layerName of layerNames) {
    for (const address of walkAddresses({ space, layer: layerName })) {
      for (const conflict of orderConflictsAt({ space, address })) {
        output.push({ address, ...conflict });
      }
    }
  }
  return output;
}
