// Version-conflict detection at assembly (ADR-0116 rule 3, issue #151).
//
// The transitive closure of an assembly must contain at most ONE
// major per formalism name. A diamond with divergent majors
// (A refines @x/f@1, B refines @x/f@2, C refines A and B) is a
// version-conflict: the key space is global, there is no per-module
// isolation (Maven's dependency-convergence rule). Minor divergence
// within one major never conflicts.

import { LayerReference } from "./addresses.ts";
import type { LayerName } from "./identifiers.ts";
import type { Space } from "./space.ts";

/** One detected conflict: the formalism name, the divergent majors,
 * and the two diamond paths that brought them in. */
export type VersionConflict = {
  formalism: string;
  majors: number[];
  paths: string[][];
};

/** The transitive LRef closure of a layer, as (name, major) pairs.
 * `major` is the pinned major of the reference that brought the layer
 * in, or null for an unpinned (bare-name) reference. */
export function layerClosureMajors({
  space,
  layer,
}: {
  space: Space;
  layer: LayerName;
}): { name: string; major: number | null }[] {
  const seen = new Set<string>();
  const result: { name: string; major: number | null }[] = [];
  const visit = (name: string, major: number | null): void => {
    const key = name + "@" + String(major);
    if (seen.has(key)) return;
    seen.add(key);
    result.push({ name, major });
    const refinements = space.layers[name as LayerName]?.["refines"] ?? [];
    if (Array.isArray(refinements)) {
      for (const entry of refinements) {
        if (entry instanceof LayerReference) visit(String(entry.layer), entry.major);
      }
    }
  };
  visit(String(layer), null);
  return result;
}

/** Detect the divergent-major diamonds of an assembly: for every
 * layer, group its closure by formalism name; more than one distinct
 * pinned major for the same name is a conflict. Unpinned (null)
 * references never conflict — they resolve to the latest frozen of
 * the latest major. */
export function detectVersionConflicts({ space }: { space: Space }): VersionConflict[] {
  const conflicts: VersionConflict[] = [];
  const seenConflicts = new Set<string>();
  for (const layerName of Object.keys(space.layers)) {
    const closure = layerClosureMajors({ space, layer: layerName as LayerName });
    const byName = new Map<string, { majors: Set<number>; paths: string[][] }>();
    for (const entry of closure) {
      if (entry.major === null) continue;
      const bucket = byName.get(entry.name) ?? { majors: new Set<number>(), paths: [] };
      bucket.majors.add(entry.major);
      bucket.paths.push([layerName, entry.name + "@" + String(entry.major)]);
      byName.set(entry.name, bucket);
    }
    for (const [name, bucket] of byName) {
      if (bucket.majors.size > 1) {
        const key = name + ":" + [...bucket.majors].sort((a, b) => a - b).join(",");
        if (!seenConflicts.has(key)) {
          seenConflicts.add(key);
          conflicts.push({
            formalism: name,
            majors: [...bucket.majors].sort((a, b) => a - b),
            paths: bucket.paths,
          });
        }
      }
    }
  }
  return conflicts;
}
