// The performance invariants of the kernel's representation and
// manipulation (the memo, the shared walk, the validation passes).
// The assertions are RATIOS, never absolute times: a machine's
// speed is not kernel behavior, the RELATIONS between the costs
// are. What is asserted:
//   - the closure memo pays: a warm read pass is far cheaper than
//     the cold one that fills it;
//   - the touch invalidation is surgical: a re-read after an
//     isolated touch stays at the warm level, it does not cascade;
//   - the validation is warm-cheap (the memo survives a pass) and
//     the passes share ONE walk (the cold pass pays it once);
//   - the pipeline stays sub-quadratic when the corpus doubles;
//   - the memo stays bounded by the address space it serves, and a
//     long session of revalidations does not grow the heap.
//
//     node tests/perf-checks.mts   (exit 1 on any failure)
//     node --expose-gc tests/perf-checks.mts   (adds the heap check)

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { KERNEL_LAYER_NAMES } from "../src/application/corpus.ts";
import { parseLanguage } from "../src/domain/language/parser.ts";
import { compileLanguage } from "../src/domain/language/compiler.ts";
import { validateSpace } from "../src/domain/validation.ts";
import { Space } from "../src/domain/space.ts";
import { asLayerName, asPathSegment, type LayerName, type LayerPath } from "../src/domain/identifiers.ts";

// ---- the assertion ledger ------------------------------------------

const failures: string[] = [];
let assertions = 0;

function check(label: string, condition: boolean): void {
  assertions++;
  if (!condition) failures.push(label);
}

const median = (values: number[]): number =>
  [...values].sort((first, second) => first - second)[Math.floor(values.length / 2)] ?? 0;

const elapsed = (action: () => void): number => {
  const start = performance.now();
  action();
  return performance.now() - start;
};

// ---- the kernel corpus, assembled once ----------------------------

const corpusDirectory = join(import.meta.dirname, "..", "formalisms", "kernel");
const layerSources: Record<string, string> = Object.fromEntries(
  KERNEL_LAYER_NAMES.map((layerName) => [
    layerName,
    readFileSync(join(corpusDirectory, layerName + ".ld"), "utf8"),
  ]),
);
const languageSource = KERNEL_LAYER_NAMES.map((layerName) => layerSources[layerName]).join("");
const parsed = parseLanguage(languageSource);
const compiled = compileLanguage(parsed.layers);

// ---- (1) the memo pays: cold vs warm read passes -------------------

// A workload of every leaf address of every layer, read through the
// closure — the same reads the panels and the harnesses perform.
const referenceSpace = new Space(compiled.layers);
type ReadTarget = { layer: LayerName; path: LayerPath; key: string };
const workload: ReadTarget[] = [];
const collect = (layer: LayerName, node: unknown, path: LayerPath): void => {
  for (const key of Object.keys((node ?? {}) as Record<string, unknown>)) {
    const value = (node as Record<string, unknown>)[key];
    if (value !== null && typeof value === "object" && !Array.isArray(value)) {
      collect(layer, value, [...path, asPathSegment(key)]);
    } else {
      workload.push({ layer, path, key });
    }
  }
};
for (const layerName of KERNEL_LAYER_NAMES) {
  collect(layerName, referenceSpace.raw({ layer: layerName, path: [] }), []);
}
const readAll = (space: Space): void => {
  for (const target of workload) {
    space.read({ layer: target.layer, path: target.path, key: target.key });
  }
};

const coldSpace = new Space(compiled.layers);
for (let index = 0; index < 3; index += 1) {
  coldSpace.closureMemo.clear();
  readAll(coldSpace);
}
const coldSamples: number[] = [];
for (let index = 0; index < 9; index += 1) {
  coldSpace.closureMemo.clear();
  coldSamples.push(elapsed(() => readAll(coldSpace)));
}
const warmSamples: number[] = [];
for (let index = 0; index < 9; index += 1) warmSamples.push(elapsed(() => readAll(coldSpace)));
const coldRead = median(coldSamples);
const warmRead = median(warmSamples);
check(
  "the memo pays: the warm read pass is at least 10x cheaper than the cold one (" +
    coldRead.toFixed(2) + " ms vs " + warmRead.toFixed(2) + " ms)",
  warmRead * 10 <= coldRead,
);

// ---- (2) the memo stays bounded by the address space ---------------

const walkedAddresses = coldSpace.closureMemo.size;
check(
  "the memo stays bounded: " + walkedAddresses + " entries for " + workload.length + " read targets",
  walkedAddresses <= workload.length * 2,
);

// ---- (3) the touch invalidation is surgical ------------------------

// The write protocol of the living space (edition.ts touches the
// whole layer): one touch, then the same read pass — the re-read
// must stay at the warm level, the invalidation must not cascade.
coldSpace.touch({ layer: asLayerName("record"), path: [] });
const touchedSamples: number[] = [];
for (let index = 0; index < 9; index += 1) touchedSamples.push(elapsed(() => readAll(coldSpace)));
const touchedRead = median(touchedSamples);
check(
  "the touch is surgical: the re-read stays under 3x the warm pass (" +
    touchedRead.toFixed(2) + " ms vs " + warmRead.toFixed(2) + " ms)",
  touchedRead <= warmRead * 3,
);

// ---- (4) the validation: warm-cheap, cold with one walk ------------

const fullValidation = (space: Space) =>
  elapsed(() =>
    validateSpace({ space, parse: parsed, compilation: compiled, layerNames: KERNEL_LAYER_NAMES }),
  );

const coldValidationSamples: number[] = [];
for (let index = 0; index < 7; index += 1) {
  coldValidationSamples.push(fullValidation(new Space(compiled.layers)));
}
const coldValidation = median(coldValidationSamples);

const warmValidationSpace = new Space(compiled.layers);
validateSpace({
  space: warmValidationSpace,
  parse: parsed,
  compilation: compiled,
  layerNames: KERNEL_LAYER_NAMES,
});
const warmValidationSamples: number[] = [];
for (let index = 0; index < 7; index += 1) {
  warmValidationSamples.push(fullValidation(warmValidationSpace));
}
const warmValidation = median(warmValidationSamples);
check(
  "the validation is warm-cheap: at least 2x cheaper warm than cold (" +
    coldValidation.toFixed(1) + " ms vs " + warmValidation.toFixed(1) + " ms)",
  warmValidation * 2 <= coldValidation,
);

// ---- (5) the pipeline stays sub-quadratic when the corpus doubles --

// The doubled corpus: every layer duplicated under a fresh name that
// refines the same parents (the same pipeline the staging assembles
// when a draft cites the corpus). What matters is the RATIO between
// the x2 and the x4 validation — a quadratic regression doubles it.
const scaledValidation = (copies: number): number => {
  const sources: Record<string, string> = {};
  const names = [...KERNEL_LAYER_NAMES];
  for (const layerName of KERNEL_LAYER_NAMES) sources[layerName] = layerSources[layerName] ?? "";
  for (let copy = 2; copy <= copies; copy += 1) {
    for (const layerName of KERNEL_LAYER_NAMES) {
      const clone = layerName + "-x" + copy;
      sources[clone] = (layerSources[layerName] ?? "").replace("layer " + layerName, "layer " + clone);
      names.push(asLayerName(clone));
    }
  }
  const joined = names.map((name) => sources[name]).join("");
  const scaledParsed = parseLanguage(joined);
  const scaledCompiled = compileLanguage(scaledParsed.layers);
  return elapsed(() => {
    validateSpace({
      space: new Space(scaledCompiled.layers),
      parse: scaledParsed,
      compilation: scaledCompiled,
      layerNames: names,
    });
  });
};
const doubled = median([scaledValidation(2), scaledValidation(2), scaledValidation(2)]);
const quadrupled = median([scaledValidation(4), scaledValidation(4), scaledValidation(4)]);
check(
  "the validation stays sub-quadratic: x4 corpus at most 3x the x2 cost (" +
    doubled.toFixed(0) + " ms vs " + quadrupled.toFixed(0) + " ms)",
  quadrupled <= doubled * 3,
);

// ---- (6) a long session does not grow the heap ----------------------

if (typeof (globalThis as any).gc === "function") {
  (globalThis as any).gc();
  const before = process.memoryUsage().heapUsed;
  for (let index = 0; index < 20; index += 1) fullValidation(warmValidationSpace);
  (globalThis as any).gc();
  const after = process.memoryUsage().heapUsed;
  check(
    "a session of 20 revalidations does not grow the heap beyond 2x (" +
      Math.round(before / 1024) + " KiB vs " +
      Math.round(after / 1024) + " KiB)",
    after <= before * 2,
  );
}

// =====================================================================
// the ledger
// =====================================================================

console.log("perf checks: " + assertions + " assertions, " + failures.length + " failure(s)");
for (const failure of failures) {
  console.log("FAIL " + failure);
}
process.exit(failures.length > 0 ? 1 : 0);
