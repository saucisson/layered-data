// The re-pin harness (issue #153, ADR-0116): quantify, PER DEPENDENT,
// the observational impact of changing a pinned major — not just the
// diff between two versions of a dependency (the classifier's job),
// but what the re-pin does to every assembly that depends on it.
//
// Two measurements per dependent layer:
//   - changedPins: how many closure entries of the dependent move to
//     the new major (the pin displacement the re-pin causes);
//   - changedDumpLines: the measured line diff of the dependent's
//     flattened dump before and after the re-pin.
// A re-pin with changedDumpLines === 0 is observationally inert —
// the certification behind the one-click re-pin suggestions of
// issue #154.

import type { LayerName } from "../domain/identifiers.ts";
import { Space } from "../domain/space.ts";
import { layerClosurePaths } from "../domain/versioning.ts";
import { writeFlattenedLayerSource } from "./flattenSource.ts";
import { repinSpace } from "./stratigraphy.ts";

/** The measured impact of one re-pin on one dependent layer. */
export type RepinImpact = {
  dependent: string;
  formalism: string;
  fromMajor: number;
  toMajor: number;
  changedPins: number;
  changedDumpLines: number;
  inert: boolean;
};

/** The dependents of a formalism pinned at `fromMajor`: every layer
 * whose closure carries the formalism at that major. */
export function dependentsOf({
  space,
  formalism,
  fromMajor,
}: {
  space: Space;
  formalism: string;
  fromMajor: number;
}): string[] {
  const dependents: string[] = [];
  for (const layerName of Object.keys(space.layers)) {
    const closure = layerClosurePaths({ space, layer: layerName as LayerName });
    if (
      closure.some((entry) => entry.name === formalism && entry.major === fromMajor)
    ) {
      dependents.push(layerName);
    }
  }
  return dependents.sort();
}

/** The line diff of two texts, as a multiset symmetric difference:
 * lines added plus lines removed. */
function lineDiffSize({ before, after }: { before: string; after: string }): number {
  const count = (text: string): Map<string, number> => {
    const counts = new Map<string, number>();
    for (const line of text.split("\n")) {
      counts.set(line, (counts.get(line) ?? 0) + 1);
    }
    return counts;
  };
  const beforeCounts = count(before);
  const afterCounts = count(after);
  let diff = 0;
  for (const [line, beforeCount] of beforeCounts) {
    diff += Math.max(0, beforeCount - (afterCounts.get(line) ?? 0));
  }
  for (const [line, afterCount] of afterCounts) {
    diff += Math.max(0, afterCount - (beforeCounts.get(line) ?? 0));
  }
  return diff;
}

/** Measure the impact of re-pinning `formalism` from `fromMajor` to
 * `toMajor` on every dependent, one row per dependent. The original
 * space is never mutated: the after-measurement runs on a re-pinned
 * copy. */
export function measureRepinImpact({
  space,
  formalism,
  fromMajor,
  toMajor,
}: {
  space: Space;
  formalism: string;
  fromMajor: number;
  toMajor: number;
}): RepinImpact[] {
  const repinned = repinSpace({ space, formalism, targetMajor: toMajor });
  const impacts: RepinImpact[] = [];
  for (const dependent of dependentsOf({ space, formalism, fromMajor })) {
    const layer = dependent as LayerName;
    const beforeClosure = layerClosurePaths({ space, layer });
    const afterClosure = layerClosurePaths({ space: repinned, layer });
    let changedPins = 0;
    if (fromMajor !== toMajor) {
      for (const entry of beforeClosure) {
        if (entry.name !== formalism || entry.major !== fromMajor) continue;
        const moved = afterClosure.some(
          (after) => after.name === formalism && after.major === toMajor,
        );
        if (moved) changedPins++;
      }
    }
    const changedDumpLines = lineDiffSize({
      before: writeFlattenedLayerSource({ space, layer }),
      after: writeFlattenedLayerSource({ space: repinned, layer }),
    });
    impacts.push({
      dependent,
      formalism,
      fromMajor,
      toMajor,
      changedPins,
      changedDumpLines,
      inert: changedDumpLines === 0,
    });
  }
  return impacts;
}
