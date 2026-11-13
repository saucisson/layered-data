// Addresses, references and raw layer trees.
//
// Three notions live here and are distinct on purpose:
//   - an `Address` is where one reads: a layer and a path within it;
//   - a `PathReference` / `LayerReference` is what the language writes
//     (`@anchor/path`, `@layer`) — unresolved, it keeps late binding;
//   - an `AddressView` is a value seen THROUGH an address: the space
//     hands it back when the raw value at a key is itself a node.

import { type LayerName, type LayerPath } from "./identifiers.ts";

/** A reference to a node: `@anchor/first/second`, re-rootable.
 * `major` is the pinned major version (`@anchor@2`, ADR-0116 rule 2)
 * — null when the reference is unpinned. */
export class PathReference {
  readonly anchor: LayerName;
  readonly path: LayerPath;
  readonly major: number | null;

  constructor(anchor: LayerName, path: LayerPath, major: number | null = null) {
    this.anchor = anchor;
    this.path = path;
    this.major = major;
  }
}

/** A reference to a whole layer: `@layer`, optionally major-pinned
 * (`@layer@2`, ADR-0116 rule 2). */
export class LayerReference {
  readonly layer: LayerName;
  readonly major: number | null;

  constructor(layer: LayerName, major: number | null = null) {
    this.layer = layer;
    this.major = major;
  }
}

/** An address in the space: a layer and a path within it. */
export type Address = [LayerName, LayerPath];

/** Address equality — same layer, same segments in the same order.
 * Null never equals anything, not even null (a missing address is
 * not an address). */
export function addressesEqual(first: Address | null, second: Address | null): boolean {
  if (first === null || second === null) return false;
  return first[0] === second[0] && first[1].join("\u0001") === second[1].join("\u0001");
}

/** A value seen through an address: the space resolved it to a node. */
export class AddressView {
  readonly layer: LayerName;
  readonly path: LayerPath;

  constructor(layer: LayerName, path: LayerPath) {
    this.layer = layer;
    this.path = path;
  }
}

/** The raw tree of one layer, as the compiler emits it. */
export type RawTree = { [key: string]: RawValue };
export type RawValue =
  RawTree | RawValue[] | PathReference | LayerReference | string | number | boolean | null;

/** Narrow test: a plain mutable dictionary — not an array, not a
 * reference class, not an address view (those are objects too, but
 * they are never raw tree nodes). */
export function isDictionary(value: unknown): value is RawTree {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    !(value instanceof PathReference) &&
    !(value instanceof LayerReference) &&
    !(value instanceof AddressView)
  );
}
