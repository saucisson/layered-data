// The workshop version classifier (ADR-0116 rule 1, issue #149).
//
// The workshop assigns PATCH / MINOR / MAJOR by inspecting the diff
// between two versions of a formalism — the author never chooses:
//
//   PATCH — no semantic difference (identical trees);
//   MINOR — pure additions: new keys, new aliases; no existing key
//           modified or removed, no first provider displaced;
//   MAJOR — everything else (removal, modification, displacement).
//
// The comparison is structural and order-sensitive where order is
// semantic (the `refines` list: reordering it displaces a first
// provider, hence MAJOR). This module is safety-critical: it gets a
// dedicated mutation/coverage gate (issue #162).

import {
  LayerReference,
  PathReference,
  isDictionary,
  type RawTree,
  type RawValue,
} from "./addresses.ts";

/** The three levels, ordered from the most to the least permissive. */
export type VersionLevel = "PATCH" | "MINOR" | "MAJOR";

export const VERSION_LEVELS: readonly VersionLevel[] = ["PATCH", "MINOR", "MAJOR"];

/** Structural equality of two raw values: dictionaries key by key in
 * order, arrays element by element in order, references by their
 * target (and pinned major), scalars by value. AddressView never
 * appears in raw trees. */
export function rawValuesEqual(first: RawValue, second: RawValue): boolean {
  if (first === second) return true;
  if (isDictionary(first) && isDictionary(second)) return rawTreesEqual(first, second);
  if (Array.isArray(first) && Array.isArray(second)) {
    return (
      first.length === second.length &&
      first.every((item, index) => rawValuesEqual(item, second[index] ?? null))
    );
  }
  if (first instanceof PathReference && second instanceof PathReference) {
    return (
      first.anchor === second.anchor &&
      first.path.join("") === second.path.join("") &&
      first.major === second.major
    );
  }
  if (first instanceof LayerReference && second instanceof LayerReference) {
    return first.layer === second.layer && first.major === second.major;
  }
  return false;
}

/** Strict structural equality of two trees: same keys, same order,
 * equal values. */
export function rawTreesEqual(first: RawTree, second: RawTree): boolean {
  const firstKeys = Object.keys(first);
  const secondKeys = Object.keys(second);
  if (firstKeys.length !== secondKeys.length) return false;
  return firstKeys.every(
    (key, index) => key === secondKeys[index] && rawValuesEqual(first[key] ?? null, second[key] ?? null),
  );
}

/** Is `nextValue` a pure addition over `previousValue`: equal, or a
 * list whose previous items are an ordered prefix (an added alias at
 * the end never displaces a first provider), or a dictionary that is
 * a pure addition. Anything else — modification, removal, reorder —
 * is not a pure addition. */
export function isPureValueAddition({
  previous,
  next,
}: {
  previous: RawValue;
  next: RawValue;
}): boolean {
  if (rawValuesEqual(previous, next)) return true;
  if (Array.isArray(previous) && Array.isArray(next)) {
    return (
      previous.length <= next.length &&
      previous.every((item, index) => rawValuesEqual(item, next[index] ?? null))
    );
  }
  if (isDictionary(previous) && isDictionary(next)) {
    return isPureAddition({ previous, next });
  }
  return false;
}

/** Is `next` a pure addition over `previous`: every key of `previous`
 * present in `next` with a pure-addition value, in the same relative
 * order; `next` may add keys (new members, aliases) at any position.
 * A key whose value changed, a removed key, or a reordered existing
 * key is NOT a pure addition. */
export function isPureAddition({ previous, next }: { previous: RawTree; next: RawTree }): boolean {
  const nextKeys = Object.keys(next);
  const nextIndex = new Map(nextKeys.map((key, index) => [key, index]));
  let cursor = -1;
  for (const key of Object.keys(previous)) {
    const index = nextIndex.get(key);
    if (index === undefined) return false; // removed key
    if (index < cursor) return false; // existing key displaced
    cursor = index;
    if (!isPureValueAddition({ previous: previous[key] ?? null, next: next[key] ?? null }))
      return false; // modified
  }
  return true;
}

/** Classify the diff between two versions of a formalism. */
export function classifyVersionDiff({
  previous,
  next,
}: {
  previous: RawTree;
  next: RawTree;
}): VersionLevel {
  if (rawTreesEqual(previous, next)) return "PATCH";
  if (isPureAddition({ previous, next })) return "MINOR";
  return "MAJOR";
}
