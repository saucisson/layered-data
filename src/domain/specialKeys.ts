// The special keys of the layer language: everything in a raw layer
// tree that is NOT a designed member. They never surface in `keys()`,
// but most of them are readable at an address.
//
//   - `refines` — the refinement entries of a node;
//   - `implicits` — entries copied into every non-special child at
//     desugaring time (late binding preserved: copied unresolved);
//   - `specification` — the node typing this one;
//   - `anchors` / `defaults` — anchor prefixes and default values;
//   - `checks` — the check tags the node carries;
//   - `check-definitions` — the check couples the node declares
//     (ADR-0105): a check is a name, a level, its judgments — closed
//     sentences in the reading language — and their message
//     templates. The container is INTERNAL: the surface language
//     fills it through the `check` act alone, it is never addressed
//     as a key, and it accumulates — a couple is never replaced;
//   - `bindings` — slot bindings of the checks: the parameterization
//     of a check lives in the layers, never in the registry;
//   - `note` — the comment of a layer is DATA (readable at the root),
//     never a visible member: it does not sediment, does not shadow,
//     does not copy — each layer carries its own;
//   - `tests` — the expected-reads contract of a layer. Same
//     discipline as `note`: it travels with the layer (file, disk,
//     staging), it never sediments.

export type SpecialKey =
  | "refines"
  | "implicits"
  | "specification"
  | "anchors"
  | "defaults"
  | "checks"
  | "check-definitions"
  | "bindings"
  | "note"
  | "tests";

export const SPECIAL_KEYS: readonly SpecialKey[] = [
  "refines",
  "implicits",
  "specification",
  "anchors",
  "defaults",
  "checks",
  "check-definitions",
  "bindings",
  "note",
  "tests",
];

export function isSpecialKey(key: string): key is SpecialKey {
  return (SPECIAL_KEYS as readonly string[]).includes(key);
}
