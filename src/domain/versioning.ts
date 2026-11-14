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

/** One entry of the transitive closure with the full path that
 * brought it in: the chain of layer names from the root layer down
 * to this entry (issue #154 — the diamond paths are displayed as
 * such). */
export type ClosurePathEntry = {
  name: string;
  major: number | null;
  path: string[];
};

/** The transitive LRef closure of a layer, each entry carrying the
 * path of layer names that brought it in. Same walk as
 * `layerClosureMajors`, path-tracking added. */
export function layerClosurePaths({
  space,
  layer,
}: {
  space: Space;
  layer: LayerName;
}): ClosurePathEntry[] {
  const seen = new Set<string>();
  const result: ClosurePathEntry[] = [];
  const visit = (name: string, major: number | null, path: string[]): void => {
    const key = name + "@" + String(major);
    if (seen.has(key)) return;
    seen.add(key);
    result.push({ name, major, path });
    const refinements = space.layers[name as LayerName]?.["refines"] ?? [];
    if (Array.isArray(refinements)) {
      for (const entry of refinements) {
        if (entry instanceof LayerReference) {
          const label =
            entry.major === null ? String(entry.layer) : String(entry.layer) + "@" + String(entry.major);
          visit(String(entry.layer), entry.major, [...path, label]);
        }
      }
    }
  };
  visit(String(layer), null, [String(layer)]);
  return result;
}

/** One diamond conflict inside the closure of ONE layer: the
 * formalism, the divergent majors, and one full path per divergent
 * major (root → … → formalism@major) — the two paths of the diamond. */
export type ClosureConflict = {
  formalism: string;
  majors: number[];
  paths: string[][];
};

/** The divergent-major diamonds of the closure of a single layer,
 * with full paths (issue #154). Unpinned (null) references never
 * conflict — they resolve to the latest frozen of the latest major. */
export function conflictPathsInClosure({
  space,
  layer,
}: {
  space: Space;
  layer: LayerName;
}): ClosureConflict[] {
  const closure = layerClosurePaths({ space, layer });
  const byName = new Map<string, { majors: Set<number>; paths: string[][] }>();
  for (const entry of closure) {
    if (entry.major === null) continue;
    const bucket = byName.get(entry.name) ?? { majors: new Set<number>(), paths: [] };
    bucket.majors.add(entry.major);
    bucket.paths.push(entry.path);
    byName.set(entry.name, bucket);
  }
  const conflicts: ClosureConflict[] = [];
  for (const [name, bucket] of byName) {
    if (bucket.majors.size > 1) {
      conflicts.push({
        formalism: name,
        majors: [...bucket.majors].sort((a, b) => a - b),
        paths: bucket.paths,
      });
    }
  }
  return conflicts;
}

/** One detected drift: the host assembly whose measured dump changed
 * after a minor lift of a dependency, with the old and new
 * fingerprints. */
export type Drift = {
  assembly: string;
  dependency: string;
  previousFingerprint: string;
  currentFingerprint: string;
};

/** Drift policing (ADR-0116 rule 4, issue #152): compare the
 * certified dump fingerprint of each frozen dependency with the
 * fingerprint the host assembly now measures. A difference means the
 * minor lift displaced something in the host (namespace collision,
 * first-provider displacement) — a drift verdict, never silent. */
export function detectDrift({
  certified,
  measured,
  assembly,
}: {
  /** certified fingerprints: dependency name → fingerprint */
  certified: Readonly<Record<string, string>>;
  /** measured fingerprints of the host assembly per dependency */
  measured: Readonly<Record<string, string>>;
  assembly: string;
}): Drift[] {
  const drifts: Drift[] = [];
  for (const [dependency, previousFingerprint] of Object.entries(certified)) {
    const currentFingerprint = measured[dependency];
    if (currentFingerprint !== undefined && currentFingerprint !== previousFingerprint) {
      drifts.push({
        assembly,
        dependency,
        previousFingerprint,
        currentFingerprint,
      });
    }
  }
  return drifts;
}
