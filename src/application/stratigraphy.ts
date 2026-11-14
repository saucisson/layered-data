// The stratigraphy of a formalism (issue #154, ADR-0116): the
// strata of its closure — one row per (formalism, pinned major), what
// each refines — the diamond conflicts with their two paths, and the
// re-pin suggestions that the observational-inertness certification
// unlocks. The certification is measured, never asserted: a re-pin is
// suggested only when the flattened dump of the assembly is
// byte-identical under the new pin.

import {
  LayerReference,
  PathReference,
  isDictionary,
  type RawTree,
  type RawValue,
} from "../domain/addresses.ts";
import type { LayerName } from "../domain/identifiers.ts";
import { Space } from "../domain/space.ts";
import {
  conflictPathsInClosure,
  layerClosurePaths,
  type ClosureConflict,
} from "../domain/versioning.ts";
import { writeFlattenedLayerSource } from "./flattenSource.ts";

/** One stratum of the closure: a formalism as the closure sees it —
 * the pinned major of the reference that brought it in (null for a
 * bare-name reference, which resolves to the latest frozen of the
 * latest major) — and what that layer itself refines. */
export type Stratum = {
  name: string;
  major: number | null;
  refines: { name: string; major: number | null }[];
};

/** The strata of the closure of a layer, in walk order (the root
 * first). */
export function strataOf({
  space,
  layer,
}: {
  space: Space;
  layer: LayerName;
}): Stratum[] {
  return layerClosurePaths({ space, layer }).map((entry) => {
    const refinements = space.layers[entry.name as LayerName]?.["refines"] ?? [];
    const refines: { name: string; major: number | null }[] = [];
    if (Array.isArray(refinements)) {
      for (const refinement of refinements) {
        if (refinement instanceof LayerReference) {
          refines.push({ name: String(refinement.layer), major: refinement.major });
        }
      }
    }
    return { name: entry.name, major: entry.major, refines };
  });
}

/** The diamond conflicts inside the closure of one layer, with their
 * full paths — the stratigraphy view displays them as two paths. */
export function conflictsOf({
  space,
  layer,
}: {
  space: Space;
  layer: LayerName;
}): ClosureConflict[] {
  return conflictPathsInClosure({ space, layer });
}

/** Rewrite one raw value with every reference to `formalism`
 * re-pinned to `targetMajor` — layer references and path anchors
 * alike. Other values pass through untouched. */
function repinValue({
  value,
  formalism,
  targetMajor,
}: {
  value: RawValue;
  formalism: string;
  targetMajor: number;
}): RawValue {
  if (value instanceof LayerReference) {
    return value.layer === formalism
      ? new LayerReference(value.layer, targetMajor)
      : value;
  }
  if (value instanceof PathReference) {
    return value.anchor === formalism
      ? new PathReference(value.anchor, value.path, targetMajor)
      : value;
  }
  if (isDictionary(value)) {
    const copy: Record<string, RawValue> = {};
    for (const [key, entry] of Object.entries(value)) {
      copy[key] = repinValue({ value: entry, formalism, targetMajor });
    }
    return copy;
  }
  if (Array.isArray(value)) {
    return value.map((entry) => repinValue({ value: entry, formalism, targetMajor }));
  }
  return value;
}

/** A copy of the space with every reference to `formalism` pinned to
 * `targetMajor` — the hypothetical assembly a re-pin would produce.
 * The original space is never mutated. */
export function repinSpace({
  space,
  formalism,
  targetMajor,
}: {
  space: Space;
  formalism: string;
  targetMajor: number;
}): Space {
  const layers: Record<string, RawTree> = {};
  for (const [name, tree] of Object.entries(space.layers)) {
    layers[name] = repinValue({ value: tree, formalism, targetMajor }) as RawTree;
  }
  return new Space(layers);
}

/** The observational-inertness certification of a re-pin (issue
 * #154): the flattened dump of the assembly is measured before and
 * after the re-pin — byte-identical means the change is
 * observationally inert and the re-pin can be suggested one-click. */
export function isRepinObservationallyInert({
  space,
  layer,
  formalism,
  targetMajor,
}: {
  space: Space;
  layer: LayerName;
  formalism: string;
  targetMajor: number;
}): boolean {
  const before = writeFlattenedLayerSource({ space, layer });
  const repinned = repinSpace({ space, formalism, targetMajor });
  const after = writeFlattenedLayerSource({ space: repinned, layer });
  return before === after;
}

/** One one-click re-pin suggestion: the formalism, the divergent
 * majors of the diamond, the certified-inert target major, and the
 * two paths of the diamond. */
export type RepinSuggestion = {
  formalism: string;
  majors: number[];
  targetMajor: number;
  paths: string[][];
};

/** The re-pin suggestions of the closure of a layer: for every
 * diamond conflict, every divergent major whose total re-pin leaves
 * the measured dump byte-identical. */
export function repinSuggestions({
  space,
  layer,
}: {
  space: Space;
  layer: LayerName;
}): RepinSuggestion[] {
  const suggestions: RepinSuggestion[] = [];
  for (const conflict of conflictPathsInClosure({ space, layer })) {
    for (const targetMajor of conflict.majors) {
      if (
        isRepinObservationallyInert({ space, layer, formalism: conflict.formalism, targetMajor })
      ) {
        suggestions.push({
          formalism: conflict.formalism,
          majors: conflict.majors,
          targetMajor,
          paths: conflict.paths,
        });
      }
    }
  }
  return suggestions;
}
