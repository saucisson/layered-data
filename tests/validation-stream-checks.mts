// The streamed validation's equivalence checks (ADR-0108): the
// chunked validation must answer EXACTLY what the synchronous
// validateSpace answers — the same verdicts in the same order, the
// same stats — whether the stream is drained at once
// (collectValidation), consumed chunk by chunk by hand, paced on the
// event loop (scheduleValidation), or produced by a validation
// session after an edition.
//
//     node tests/validation-stream-checks.mts   (exit 1 on any failure)

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { KERNEL_LAYER_NAMES } from "../src/application/corpus.ts";
import { createValidationSession } from "../src/application/validationSession.ts";
import { scheduleValidation } from "../src/application/validationStream.ts";
import { parseLanguage } from "../src/domain/language/parser.ts";
import { compileLanguage } from "../src/domain/language/compiler.ts";
import {
  collectValidation,
  streamValidation,
  validateSpace,
  type ValidationChunk,
} from "../src/domain/validation.ts";
import { Space } from "../src/domain/space.ts";
import { asLayerName, type LayerName } from "../src/domain/identifiers.ts";

// ---- the assertion ledger ------------------------------------------

const failures: string[] = [];
let assertions = 0;

function check(label: string, condition: boolean): void {
  assertions++;
  if (!condition) failures.push(label);
}

// ---- the corpus: the kernel plus one living draft -------------------

const corpusDirectory = join(import.meta.dirname, "..", "formalisms", "kernel");
const draftSource =
  "layer users-draft refines @pn-philosophers-5\n" +
  "  override tests\n" +
  "    expect places/philo1.think1/marking = 1\n";
const sources: Record<string, string> = Object.fromEntries(
  KERNEL_LAYER_NAMES.map((layerName) => [
    layerName,
    readFileSync(join(corpusDirectory, layerName + ".ld"), "utf8"),
  ]),
);
sources["users-draft"] = draftSource;
const layerNames: LayerName[] = [...KERNEL_LAYER_NAMES, asLayerName("users-draft")];

const joinedSource = (): string =>
  layerNames
    .map((layerName) =>
      (sources[layerName] ?? "").endsWith("\n") ? (sources[layerName] ?? "") : (sources[layerName] ?? "") + "\n",
    )
    .join("");

const parsed = parseLanguage(joinedSource());
const compilation = compileLanguage(parsed.layers);
const space = new Space(compilation.layers);

const input = { space, parse: parsed, compilation, layerNames };
const reference = validateSpace(input);

// ---- (1) drained at once: collectValidation IS validateSpace --------

const drained = collectValidation(streamValidation(input));
check(
  "collectValidation(stream) equals validateSpace (verdicts, order, stats)",
  JSON.stringify(drained.verdicts) === JSON.stringify(reference.verdicts) &&
    JSON.stringify(drained.stats) === JSON.stringify(reference.stats),
);

// ---- (2) consumed chunk by chunk: the chunks concatenate exactly ----

const stream = streamValidation(input);
const manualChunks: ValidationChunk[] = [];
let manualStep = stream.next();
while (!manualStep.done) {
  manualChunks.push(manualStep.value);
  manualStep = stream.next();
}
const manualOutcome = manualStep.value;

const concatenated = manualChunks.flatMap((chunk) => chunk.verdicts);
check(
  "the chunks' verdicts concatenate to the full outcome's, in order",
  JSON.stringify(concatenated) === JSON.stringify(reference.verdicts),
);
check(
  "the stream's return value equals validateSpace (verdicts, stats)",
  JSON.stringify(manualOutcome.verdicts) === JSON.stringify(reference.verdicts) &&
    JSON.stringify(manualOutcome.stats) === JSON.stringify(reference.stats),
);
check("the stream yields chunks", manualChunks.length > 0);
check(
  "every chunk's progress is within its phase's bounds",
  manualChunks.every((chunk) => chunk.progress.done >= 0 && chunk.progress.done <= chunk.progress.total),
);
const phases = new Set(manualChunks.map((chunk) => chunk.phase));
for (const phase of ["étiquetage", "déclarations", "étiquettes", "ombres", "tests", "couples", "lisibilité"]) {
  check("the stream covers the phase « " + phase + " »", phases.has(phase));
}

// ---- (3) paced on the event loop: scheduleValidation -----------------

let chunksAtCallTime = -1;
let pacedChunks = 0;
const scheduled = scheduleValidation({
  stream: streamValidation(input),
  onChunk: () => {
    pacedChunks += 1;
  },
});
chunksAtCallTime = pacedChunks; // the first chunk runs on the first tick, not synchronously
const paced = await scheduled.promise;
check("the first chunk is not run synchronously", chunksAtCallTime === 0);
check("the paced run saw every chunk", pacedChunks === manualChunks.length);
check(
  "the paced outcome equals validateSpace (verdicts, stats)",
  JSON.stringify(paced.verdicts) === JSON.stringify(reference.verdicts) &&
    JSON.stringify(paced.stats) === JSON.stringify(reference.stats),
);

// ---- (4) the session's stream after an edition -----------------------

const session = createValidationSession({ space, parse: parsed, compilation, layerNames });
sources["users-draft"] = draftSource.replace("marking = 1", "marking = 7");
const editedParsed = parseLanguage(joinedSource());
const editedCompilation = compileLanguage(editedParsed.layers);
session.applyEdition({ layerName: asLayerName("users-draft"), parse: editedParsed, compilation: editedCompilation });
const sessionStreamed = collectValidation(session.outcomeStream());
const sessionReference = validateSpace({
  space,
  parse: editedParsed,
  compilation: editedCompilation,
  layerNames,
});
check(
  "the session's streamed outcome equals the full validation's after an edition",
  JSON.stringify(sessionStreamed.verdicts) === JSON.stringify(sessionReference.verdicts) &&
    JSON.stringify(sessionStreamed.stats) === JSON.stringify(sessionReference.stats),
);
check(
  "the edition's betrayed expect is seen by the stream",
  sessionStreamed.verdicts.some((verdict) => verdict.kind === "attendu-trahi"),
);

// ---- the report -------------------------------------------------------

console.log("validation stream checks: " + assertions + " assertions, " + failures.length + " failure(s)");
if (failures.length > 0) {
  for (const failure of failures) console.log("  FAIL: " + failure);
  process.exit(1);
}
