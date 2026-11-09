// The kernel benchmark: the pipeline's cost across corpus sizes.
//
// Not a test — a measurement. The assertions live in
// tests/perf-checks.mts (ratios); this harness prints absolute
// numbers, as a markdown table, for the aspects that matter:
// parse, compile, validation (cold and warm), the read pass (cold
// and warm), the memo size, the heap — at 1x, 2x, 4x and 8x the
// kernel corpus (the layers are duplicated under fresh names that
// refine the same parents, the way staging assembles a draft citing
// the corpus). A validation-session row closes the table: the cost
// of one revalidation after a living draft's edition.
//
//     npm run bench
//     node --expose-gc benchmarks/kernel.mts   (adds precise heap numbers)

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { KERNEL_LAYER_NAMES } from "../src/application/corpus.ts";
import { createValidationSession } from "../src/application/validationSession.ts";
import { asLayerName, type LayerName, type LayerPath } from "../src/domain/identifiers.ts";
import { parseLanguage } from "../src/domain/language/parser.ts";
import { compileLanguage } from "../src/domain/language/compiler.ts";
import { validateSpace } from "../src/domain/validation.ts";
import { Space } from "../src/domain/space.ts";

// ---- helpers ----------------------------------------------------------

const median = (values: number[]): number =>
  [...values].sort((first, second) => first - second)[Math.floor(values.length / 2)];

const elapsed = (action: () => void): number => {
  const start = performance.now();
  action();
  return performance.now() - start;
};

const gc = (): void => {
  if (typeof (globalThis as { gc?: () => void }).gc === "function") (globalThis as { gc: () => void }).gc();
};

const heapMiB = (): number => {
  gc();
  return process.memoryUsage().heapUsed / 1024 / 1024;
};

// ---- the corpus at each size ------------------------------------------

const corpusDirectory = join(import.meta.dirname, "..", "formalisms", "kernel");
const kernelSources: Record<string, string> = Object.fromEntries(
  KERNEL_LAYER_NAMES.map((layerName) => [layerName, readFileSync(join(corpusDirectory, layerName + ".ld"), "utf8")]),
);

/** The corpus duplicated `copies` times: every layer cloned under a
 * fresh name refining the same parents. */
const scaledSources = (copies: number): { sources: Record<string, string>; layerNames: LayerName[] } => {
  const sources: Record<string, string> = { ...kernelSources };
  const layerNames: LayerName[] = [...KERNEL_LAYER_NAMES];
  for (let copy = 2; copy <= copies; copy += 1) {
    for (const layerName of KERNEL_LAYER_NAMES) {
      const clone = layerName + "-x" + copy;
      sources[clone] = kernelSources[layerName].replace("layer " + layerName, "layer " + clone);
      layerNames.push(asLayerName(clone));
    }
  }
  return { sources, layerNames };
};

const joinedSourceOf = ({ sources, layerNames }: { sources: Record<string, string>; layerNames: LayerName[] }): string =>
  layerNames.map((layerName) => (sources[layerName].endsWith("\n") ? sources[layerName] : sources[layerName] + "\n")).join("");

// ---- the read workload: every leaf address of every layer -------------

interface ReadTarget {
  layer: LayerName;
  path: LayerPath;
  key: string;
}

const leafWorkload = ({ compiledLayers }: { compiledLayers: Record<string, unknown> }): ReadTarget[] => {
  const workload: ReadTarget[] = [];
  const collect = (layer: LayerName, node: unknown, path: LayerPath): void => {
    if (node === null || typeof node !== "object" || Array.isArray(node)) return;
    for (const key of Object.keys(node as Record<string, unknown>)) {
      const value = (node as Record<string, unknown>)[key];
      if (value !== null && typeof value === "object" && !Array.isArray(value)) {
        collect(layer, value, [...path, key as LayerPath[number]]);
      } else {
        workload.push({ layer, path, key });
      }
    }
  };
  for (const layerName of Object.keys(compiledLayers)) {
    collect(asLayerName(layerName), compiledLayers[layerName], []);
  }
  return workload;
};

// ---- the table ----------------------------------------------------------

interface Row {
  layers: number;
  parseMs: number;
  compileMs: number;
  validateColdMs: number;
  validateWarmMs: number;
  readColdMs: number;
  readWarmMs: number;
  memoEntries: number;
  heapMiB: number;
}

const SIZES: { copies: number; repetitions: number }[] = [
  { copies: 1, repetitions: 7 },
  { copies: 2, repetitions: 5 },
  { copies: 4, repetitions: 3 },
  { copies: 8, repetitions: 3 },
];

const rows: Row[] = [];
for (const { copies, repetitions } of SIZES) {
  const { sources, layerNames } = scaledSources(copies);
  const source = joinedSourceOf({ sources, layerNames });

  const parseSamples: number[] = [];
  let parsed = parseLanguage(source);
  for (let index = 0; index < repetitions; index += 1) parseSamples.push(elapsed(() => (parsed = parseLanguage(source))));

  const compileSamples: number[] = [];
  let compiled = compileLanguage(parsed.layers);
  for (let index = 0; index < repetitions; index += 1) compileSamples.push(elapsed(() => (compiled = compileLanguage(parsed.layers))));

  const validateColdSamples: number[] = [];
  for (let index = 0; index < repetitions; index += 1) {
    validateColdSamples.push(
      elapsed(() => validateSpace({ space: new Space(compiled.layers), parse: parsed, compilation: compiled, layerNames })),
    );
  }

  const warmSpace = new Space(compiled.layers);
  validateSpace({ space: warmSpace, parse: parsed, compilation: compiled, layerNames });
  const validateWarmSamples: number[] = [];
  for (let index = 0; index < repetitions; index += 1) {
    validateWarmSamples.push(
      elapsed(() => validateSpace({ space: warmSpace, parse: parsed, compilation: compiled, layerNames })),
    );
  }

  const workload = leafWorkload({ compiledLayers: compiled.layers });
  const readAll = (space: Space): void => {
    for (const target of workload) space.read({ layer: target.layer, path: target.path, key: target.key });
  };
  readAll(warmSpace); // fill the memo once, to size it
  const readColdSamples: number[] = [];
  for (let index = 0; index < repetitions; index += 1) {
    warmSpace.closureMemo.clear();
    readColdSamples.push(elapsed(() => readAll(warmSpace)));
  }
  const readWarmSamples: number[] = [];
  for (let index = 0; index < repetitions; index += 1) readWarmSamples.push(elapsed(() => readAll(warmSpace)));

  rows.push({
    layers: layerNames.length,
    parseMs: median(parseSamples),
    compileMs: median(compileSamples),
    validateColdMs: median(validateColdSamples),
    validateWarmMs: median(validateWarmSamples),
    readColdMs: median(readColdSamples),
    readWarmMs: median(readWarmSamples),
    memoEntries: warmSpace.closureMemo.size,
    heapMiB: heapMiB(),
  });
}

// ---- the validation session: one revalidation after a draft edition ----

const draftSource =
  "layer users-draft refines @pn-philosophers-5\n" +
  "  override tests\n" +
  "    expect places/philo1.think1/marking = 1\n";
const sessionSources: Record<string, string> = { ...kernelSources, "users-draft": draftSource };
const sessionLayerNames: LayerName[] = [...KERNEL_LAYER_NAMES, asLayerName("users-draft")];
const sessionJoined = (): string =>
  sessionLayerNames.map((layerName) => sessionSources[layerName]).join("");
const sessionParsed = parseLanguage(sessionJoined());
const sessionCompiled = compileLanguage(sessionParsed.layers);
const sessionSpace = new Space(sessionCompiled.layers);
const session = createValidationSession({
  space: sessionSpace,
  parse: sessionParsed,
  compilation: sessionCompiled,
  layerNames: sessionLayerNames,
});
const sessionInitialMs = elapsed(() => session.outcome());
sessionSources["users-draft"] = draftSource.replace("marking = 1", "marking = 7");
const editedParsed = parseLanguage(sessionJoined());
const editedCompiled = compileLanguage(editedParsed.layers);
const sessionEditionMs = elapsed(() =>
  session.applyEdition({ layerName: asLayerName("users-draft"), parse: editedParsed, compilation: editedCompiled }),
);
const sessionRebuilt = session.rebuiltWalks();

// ---- the report ---------------------------------------------------------

const cell = (value: number, digits = 1): string => value.toFixed(digits);

console.log("# kernel benchmark — " + process.version + ", medians over " + SIZES.map((size) => size.copies + "x:" + size.repetitions).join(", ") + " runs");
console.log("");
console.log("| layers | parse (ms) | compile (ms) | validate cold (ms) | validate warm (ms) | read cold (ms) | read warm (ms) | memo entries | heap (MiB) |");
console.log("|---:|---:|---:|---:|---:|---:|---:|---:|---:|");
for (const row of rows) {
  console.log(
    "| " + row.layers +
    " | " + cell(row.parseMs) +
    " | " + cell(row.compileMs) +
    " | " + cell(row.validateColdMs) +
    " | " + cell(row.validateWarmMs) +
    " | " + cell(row.readColdMs) +
    " | " + cell(row.readWarmMs, 2) +
    " | " + row.memoEntries +
    " | " + cell(row.heapMiB) +
    " |",
  );
}
console.log("");
console.log("| session (1x + draft) | ms | walks rebuilt |");
console.log("|---|---:|---:|");
console.log("| initial validation | " + cell(sessionInitialMs) + " | — |");
console.log("| revalidation after a draft edition | " + cell(sessionEditionMs) + " | " + sessionRebuilt + " |");
