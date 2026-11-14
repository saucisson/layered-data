// The re-pin harness checks (issue #153, ADR-0116): the conformance
// measurement extended to quantify, PER DEPENDENT, the observational
// impact of changing a pinned major — the pin displacement and the
// measured dump diff — with the observationally-inert certification
// (changedDumpLines === 0) that grounds the one-click re-pin
// suggestions of issue #154.
//
//     node tests/repin-harness-checks.mts   (exit 1 on any failure)

import { LayerReference } from "../src/domain/addresses.ts";
import { asLayerName } from "../src/domain/identifiers.ts";
import { Space } from "../src/domain/space.ts";
import {
  dependentsOf,
  measureRepinImpact,
} from "../src/application/repinHarness.ts";

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
  lonely: {},
} as never);

// ---- the dependents are exactly the layers whose closure pins the major --

{
  const dependents = dependentsOf({ space: diamond, formalism: "f", fromMajor: 1 });
  check(
    "the dependents of @f@1 are a and c (b pins @f@2, lonely refines nothing)",
    dependents.join(",") === "a,c",
  );
  check(
    "the dependents of @f@2 are b and c",
    dependentsOf({ space: diamond, formalism: "f", fromMajor: 2 }).join(",") === "b,c",
  );
  check(
    "a major nobody pins has no dependent",
    dependentsOf({ space: diamond, formalism: "f", fromMajor: 7 }).length === 0,
  );
}

// ---- the per-dependent impact measurement --------------------------------

{
  const impacts = measureRepinImpact({
    space: diamond,
    formalism: "f",
    fromMajor: 1,
    toMajor: 2,
  });
  check("one impact row per dependent", impacts.length === 2);
  const impactA = impacts.find((impact) => impact.dependent === "a");
  const impactC = impacts.find((impact) => impact.dependent === "c");
  check(
    "a's re-pin displaces exactly one pin (f@1 → f@2)",
    impactA !== undefined && impactA.changedPins === 1,
  );
  check(
    "c's re-pin displaces exactly one pin (its f@1 path moves to f@2)",
    impactC !== undefined && impactC.changedPins === 1,
  );
  check(
    "the re-pin is observationally inert on every dependent (the measured dump is unchanged)",
    impacts.every((impact) => impact.inert && impact.changedDumpLines === 0),
  );
  check(
    "the impact rows carry the from/to majors",
    impacts.every(
      (impact) => impact.fromMajor === 1 && impact.toMajor === 2 && impact.formalism === "f",
    ),
  );
}

// ---- a re-pin to the major a dependent already pins is a no-op -----------

{
  const impacts = measureRepinImpact({
    space: diamond,
    formalism: "f",
    fromMajor: 2,
    toMajor: 2,
  });
  check(
    "re-pinning to the same major displaces no pin",
    impacts.every((impact) => impact.changedPins === 0 && impact.inert),
  );
}

// ---- the original space is never mutated by the measurement --------------

{
  measureRepinImpact({ space: diamond, formalism: "f", fromMajor: 1, toMajor: 2 });
  const originalA = (diamond.layers as never as Record<string, { refines: LayerReference[] }>)[
    "a"
  ];
  check(
    "the measurement leaves the original pins untouched",
    originalA !== undefined &&
      originalA.refines[0] instanceof LayerReference &&
      originalA.refines[0].major === 1,
  );
}

// ---- the verdict ----------------------------------------------------------

if (failures.length > 0) {
  console.error("FAIL — " + failures.length + " of " + assertions + " checks failed:");
  for (const failure of failures) console.error("  - " + failure);
  process.exit(1);
}
console.log("OK — " + assertions + " re-pin harness checks passed");
