// The flattened view of one layer: the effective state of every
// address, read through the kernel and laid out as a tree.
//
// The kernel answers address by address; the workshop panel needs a
// descent: a node per address after first-winner (visible keys plus
// the shown special keys read at the address, values resolved), and
// of the chain only the provenance remains — the layer that
// provides each value, a badge, not a walk. The descent follows only
// the structural child ([path, key], re-rooted in the layer being
// read); resolved references stay navigable leaves. Pure observer:
// nothing is written, no verdict changes (same discipline as the
// diagnostics channel).

import { type LayerName, asLayerName } from "../domain/identifiers.ts";
import { AddressView, type Address } from "../domain/addresses.ts";
import { SPECIAL_KEYS, type SpecialKey } from "../domain/specialKeys.ts";
import type { ReadObservation } from "../domain/space.ts";
import type { Space } from "../domain/space.ts";
import { asLayerPath, asPathSegment } from "../domain/identifiers.ts";

/** One visible key of a flattened node: the won value, or the
 * abstract slot ∅ with its declarer. */
export interface FlatEntry {
  key: string;
  /** won value, or abstract slot */
  status: "fournit" | "transparent";
  /** the layer that provides — or that declares the slot */
  winner: LayerName | null;
  /** the read value (an AddressView for a node; ∅ otherwise) */
  value: any;
  /** the address of the node if the value is one */
  target: Address | null;
}

/** One node of the flattened tree: an address, its effective
 * state, and one child per node-valued key. */
export interface FlatNode {
  addr: Address;
  entries: FlatEntry[];
  children: Record<string, FlatNode>;
  nKeys: number;
  nAddrs: number;
}

/** The whole flattened layer. */
export interface FlatLayer {
  root: FlatNode;
  addrs: number;
  keys: number;
  winners: LayerName[];
  chaîne: number;
}

// The special keys the view shows: `read` hides them from `keys()`
// but they are readable at the address — specification and the type
// declarations, bindings (first-winner slots), checks, defaults,
// implicits, anchors. `refines` stays out: the hierarchy is exactly
// what the view removes — the provenance badge keeps its trace, the
// graph panel shows it.
const FLAT_SPECIALS: SpecialKey[] = SPECIAL_KEYS.filter((key) => key !== "refines");

/** Depth guard of the descent: a structural child strictly extends
 * the path — the tree cannot cycle; the guard only serves against
 * pathological key stackings. Same discipline as the cycle guard:
 * the view stops, never throws. */
const MAX_DESCENT_DEPTH = 24;

/** Flatten one layer: the effective state of every address, with
 * provenance. Functional in spirit: `build` is the only recursion,
 * everything else maps and filters over the observable reads. */
export function flattenLayer({ space, layer }: { space: Space; layer: LayerName }): FlatLayer {
  const winners = new Set<LayerName>();
  let addrs = 0;
  let keys = 0;

  // ---- one observed read, classified: won value / abstract slot /
  // absent (nothing to show) ----
  const readEntry = ({ address, key }: { address: Address; key: string }): FlatEntry | null => {
    const scan: ReadObservation[] = [];
    const value = space.read({ layer: address[0], path: address[1], key, scan });

    const last = scan.length ? (scan[scan.length - 1] ?? null) : null;
    if (last !== null && last.status === "fournit") {
      const winner = asLayerName(last.source[0]);
      winners.add(winner);
      const target = value instanceof AddressView ? ([value.layer, value.path] as Address) : null;
      return { key, status: "fournit", winner, value, target };
    }

    // Abstract slot: the key is declared (present, value null) but
    // no layer provides its value — `keys()` lists it, the read
    // does not provide it. The view shows it ∅ with its declarer:
    // the effective state, the honesty of the kernel.
    const declaration = scan.find((observation) => observation.status === "transparent");
    if (declaration === undefined) return null; // absent: nothing to show
    const declarer = asLayerName(declaration.source[0]);
    winners.add(declarer);
    return { key, status: "transparent", winner: declarer, value: null, target: null };
  };

  // ---- the descent: one node per address, children for structural
  // node-valued keys only ----
  const build = (address: Address, depth: number): FlatNode => {
    addrs++;
    const entries: FlatEntry[] = [];
    const children: Record<string, FlatNode> = {};

    for (const key of space.keys({ layer: address[0], path: address[1] })) {
      const entry = readEntry({ address, key });
      if (entry === null) continue;
      entries.push(entry);
      keys++;
    }
    for (const key of FLAT_SPECIALS) {
      const entry = readEntry({ address, key });
      if (entry === null) continue;
      entries.push(entry);
      keys++;
    }

    for (const entry of entries) {
      if (entry.target === null) continue;

      // Structural child — the value view of a dictionary
      // re-roots as [path, key] in the layer being read, and it is
      // the only step the descent follows. A resolved reference
      // lands anywhere: another layer, or ANOTHER BRANCH of the
      // same one — following it would reopen the whole graph
      // (container → member is a network), the tree would become a
      // replicating DAG. It stays a leaf: the key, the provenance,
      // "go there" (panel ②).
      const targetPath = entry.target[1];
      const isStructuralChild =
        entry.target[0] === address[0] &&
        targetPath.length === address[1].length + 1 &&
        targetPath[targetPath.length - 1] === entry.key &&
        targetPath.slice(0, -1).join("\u0001") === address[1].join("\u0001");
      if (!isStructuralChild) continue;

      // A special key is not descended twice: the read re-roots
      // value views in the layer being read (the address grows by
      // the key at each step), and repeated `specification` steps
      // are unfounded — the address grows, the content does not
      // renew. One `specification` level stays descendable: the
      // type records are read there; the following steps are
      // navigated (panel ②, "go there").
      const isRepeatedSpecialKey =
        (SPECIAL_KEYS as readonly string[]).includes(entry.key) &&
        entry.target[1].slice(0, -1).includes(asPathSegment(entry.key));
      if (isRepeatedSpecialKey) continue;

      if (depth >= MAX_DESCENT_DEPTH) continue;
      children[entry.key] = build(entry.target, depth + 1);
    }
    return { addr: address, entries, children, nKeys: 0, nAddrs: 0 };
  };

  // ---- subtree counts, bottom-up ----
  const root = build([layer, asLayerPath([])], 0);
  const countSubtree = (node: FlatNode): void => {
    node.nAddrs = 1;
    node.nKeys = node.entries.length;
    for (const child of Object.values(node.children)) {
      countSubtree(child);
      node.nAddrs += child.nAddrs;
      node.nKeys += child.nKeys;
    }
  };
  countSubtree(root);

  return {
    root,
    addrs,
    keys,
    winners: Array.from(winners).sort(),
    chaîne: space.closure({ layer, path: asLayerPath([]) }).length,
  };
}
