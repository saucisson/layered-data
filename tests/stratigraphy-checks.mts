// The stratigraphy checks (issue #154, ADR-0116): the strata of a
// closure (formalism, pinned major, what it refines), the diamond
// conflicts displayed as two full paths, the re-pin space (original
// never mutated), the observational-inertness certification of a
// re-pin, and the one-click session re-pin that rewrites the layer's
// block in its addition source.
//
//     node tests/stratigraphy-checks.mts   (exit 1 on any failure)

import { LayerReference } from "../src/domain/addresses.ts";
import { asLayerName } from "../src/domain/identifiers.ts";
import { Space } from "../src/domain/space.ts";
import {
  conflictPathsInClosure,
  layerClosurePaths,
} from "../src/domain/versioning.ts";
import {
  conflictsOf,
  isRepinObservationallyInert,
  repinSpace,
  repinSuggestions,
  strataOf,
} from "../src/application/stratigraphy.ts";
import {
  readSessionAdditions,
  readSessionVersion,
  writeSessionAddition,
  writeSessionRepin,
} from "../src/application/session.ts";

// ---- the assertion ledger ----------------------------------------------

const failures: string[] = [];
let assertions = 0;

function check(label: string, condition: boolean): void {
  assertions++;
  if (!condition) failures.push(label);
}

// ---- a diamond space ----------------------------------------------------
// c refines a and b; a pins @f@1, b pins @f@2 — the divergent-major
// diamond of ADR-0116 rule 3.

const diamond = new Space({
  f: {},
  a: { refines: [new LayerReference(asLayerName("f"), 1)] },
  b: { refines: [new LayerReference(asLayerName("f"), 2)] },
  c: {
    refines: [new LayerReference(asLayerName("a")), new LayerReference(asLayerName("b"))],
  },
} as never);

// ---- the closure paths carry the full diamond paths ---------------------

{
  const closure = layerClosurePaths({ space: diamond, layer: asLayerName("c") });
  const f1 = closure.find((entry) => entry.name === "f" && entry.major === 1);
  const f2 = closure.find((entry) => entry.name === "f" && entry.major === 2);
  check(
    "the closure path of f@1 is the full chain c → a → f@1",
    f1 !== undefined && f1.path.join(" → ") === "c → a → f@1",
  );
  check(
    "the closure path of f@2 is the full chain c → b → f@2",
    f2 !== undefined && f2.path.join(" → ") === "c → b → f@2",
  );
}

// ---- the conflict is detected with its two paths -------------------------

{
  const conflicts = conflictPathsInClosure({ space: diamond, layer: asLayerName("c") });
  check("one conflict in the closure of c", conflicts.length === 1);
  const conflict = conflicts[0];
  check(
    "the conflict names f with majors 1,2",
    conflict !== undefined &&
      conflict.formalism === "f" &&
      conflict.majors.join(",") === "1,2",
  );
  check(
    "the conflict carries the two diamond paths",
    conflict !== undefined &&
      conflict.paths.length === 2 &&
      conflict.paths.some((path) => path.join(" → ") === "c → a → f@1") &&
      conflict.paths.some((path) => path.join(" → ") === "c → b → f@2"),
  );
  check(
    "conflictsOf exposes the same conflicts to the view",
    conflictsOf({ space: diamond, layer: asLayerName("c") }).length === 1,
  );
  check(
    "a layer outside the diamond sees no conflict",
    conflictPathsInClosure({ space: diamond, layer: asLayerName("a") }).length === 0,
  );
}

// ---- the strata ----------------------------------------------------------

{
  const strata = strataOf({ space: diamond, layer: asLayerName("c") });
  const stratumA = strata.find((stratum) => stratum.name === "a");
  check(
    "the stratum of a reports its pinned refinement @f@1",
    stratumA !== undefined &&
      stratumA.refines.length === 1 &&
      stratumA.refines[0]?.name === "f" &&
      stratumA.refines[0]?.major === 1,
  );
  const stratumC = strata.find((stratum) => stratum.name === "c");
  check(
    "the root stratum is unpinned and refines a and b",
    stratumC !== undefined &&
      stratumC.major === null &&
      stratumC.refines.map((refinement) => refinement.name).join(",") === "a,b",
  );
}

// ---- the re-pin space never mutates the original -------------------------

{
  const repinned = repinSpace({ space: diamond, formalism: "f", targetMajor: 2 });
  const repinnedA = (repinned.layers as never as Record<string, { refines: LayerReference[] }>)[
    "a"
  ];
  check(
    "the re-pinned space pins a's reference to @f@2",
    repinnedA !== undefined &&
      repinnedA.refines[0] instanceof LayerReference &&
      repinnedA.refines[0].major === 2,
  );
  const originalA = (diamond.layers as never as Record<string, { refines: LayerReference[] }>)[
    "a"
  ];
  check(
    "the original space still pins a's reference to @f@1",
    originalA !== undefined &&
      originalA.refines[0] instanceof LayerReference &&
      originalA.refines[0].major === 1,
  );
}

// ---- the observational-inertness certification ---------------------------

{
  check(
    "re-pinning f to major 2 is certified observationally inert (the measured dump is unchanged)",
    isRepinObservationallyInert({
      space: diamond,
      layer: asLayerName("c"),
      formalism: "f",
      targetMajor: 2,
    }),
  );
  const suggestions = repinSuggestions({ space: diamond, layer: asLayerName("c") });
  check(
    "both divergent majors yield a one-click re-pin suggestion",
    suggestions.length === 2 &&
      suggestions.some((suggestion) => suggestion.targetMajor === 1) &&
      suggestions.some((suggestion) => suggestion.targetMajor === 2),
  );
  check(
    "a layer outside the diamond has no suggestion",
    repinSuggestions({ space: diamond, layer: asLayerName("a") }).length === 0,
  );
}

// ---- the one-click session re-pin ----------------------------------------

{
  writeSessionAddition({
    addition: { source: "layer repin-me refines @f@1\n", layerNames: ["repin-me"] },
  });
  writeSessionAddition({
    addition: { source: "layer repin-bare refines @f\n", layerNames: ["repin-bare"] },
  });
  const versionBefore = readSessionVersion();
  check(
    "the re-pin of a session layer succeeds",
    writeSessionRepin({ layer: "repin-me", formalism: "f", targetMajor: 2 }),
  );
  check("the session version moved", readSessionVersion() === versionBefore + 1);
  const additions = readSessionAdditions();
  const repinnedAddition = additions.find((addition) =>
    addition.layerNames.includes("repin-me"),
  );
  check(
    "the addition source now pins @f@2 and no longer @f@1",
    repinnedAddition !== undefined &&
      repinnedAddition.source.includes("@f@2") &&
      !repinnedAddition.source.includes("@f@1"),
  );
  check(
    "a bare @f reference is pinned by the re-pin",
    writeSessionRepin({ layer: "repin-bare", formalism: "f", targetMajor: 3 }),
  );
  const bareAddition = readSessionAdditions().find((addition) =>
    addition.layerNames.includes("repin-bare"),
  );
  check(
    "the bare reference became @f@3",
    bareAddition !== undefined && bareAddition.source.includes("@f@3"),
  );
  check(
    "re-pinning a layer no session addition carries fails honestly",
    !writeSessionRepin({ layer: "no-such-layer", formalism: "f", targetMajor: 2 }),
  );
}

// ---- the verdict ----------------------------------------------------------

if (failures.length > 0) {
  console.error("FAIL — " + failures.length + " of " + assertions + " checks failed:");
  for (const failure of failures) console.error("  - " + failure);
  process.exit(1);
}
console.log("OK — " + assertions + " stratigraphy checks passed");
