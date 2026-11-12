// The validation session's equivalence checks: after an edition, the
// session's incremental validation (cached walks, warm space) must
// answer EXACTLY what a full validateSpace answers on the same state
// — the same verdicts in the same order, the same stats.
//
// Two kinds of editions are proven:
//   - KERNEL layers (frozen in the workshop, but the equivalence
//     must hold anyway): a core layer's edition invalidates BROADLY
//     (the citations and refinements read it) — many walk rebuilds,
//     the equivalence is the assertion;
//   - a LIVING draft (the workshop's real flow): nobody reads it —
//     ONE walk rebuilds, and the revalidation is far cheaper than a
//     cold one.
//
// The editions chain on the same session, the way a working session
// actually goes.
//
//     node tests/validation-session-checks.mts   (exit 1 on any failure)

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { KERNEL_LAYER_NAMES } from "../src/application/corpus.ts";
import { createValidationSession } from "../src/application/validationSession.ts";
import { parseLanguage } from "../src/domain/language/parser.ts";
import { compileLanguage } from "../src/domain/language/compiler.ts";
import { validateSpace } from "../src/domain/validation.ts";
import { Space } from "../src/domain/space.ts";
import { asLayerName, type LayerName } from "../src/domain/identifiers.ts";

// ---- the assertion ledger ------------------------------------------

const failures: string[] = [];
let assertions = 0;

function check(label: string, condition: boolean): void {
  assertions++;
  if (!condition) failures.push(label);
}

const median = (values: number[]): number =>
  [...values].sort((first, second) => first - second)[
    Math.floor(values.length / 2)
  ] ?? 0;

// ---- the corpus: the kernel plus one living draft -------------------

const corpusDirectory = join(import.meta.dirname, "..", "formalisms", "kernel");
// The refined layer already declares its own `tests`, so the draft's
// block must announce itself as an override (a plain `tests` would be
// an implicit overload — exactly what the validation reports).
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
const initialSources: Record<string, string> = { ...sources };
const layerNames: LayerName[] = [
  ...KERNEL_LAYER_NAMES,
  "users-draft" as LayerName,
];

// Every layer source ends with exactly one newline — the join is part
// of the observable compilation input.
const joinedSource = (): string =>
  layerNames
    .map((layerName) =>
      (sources[layerName] ?? "").endsWith("\n")
        ? (sources[layerName] ?? "")
        : (sources[layerName] ?? "") + "\n",
    )
    .join("");

const freshParse = () => parseLanguage(joinedSource());
const freshCompilation = (parsed: ReturnType<typeof freshParse>) =>
  compileLanguage(parsed.layers);

// ---- the session and its reference ---------------------------------

const initialParse = freshParse();
const initialCompilation = freshCompilation(initialParse);
const space = new Space(initialCompilation.layers);
const session = createValidationSession({
  space,
  parse: initialParse,
  compilation: initialCompilation,
  layerNames,
});

// (1) the initial session outcome IS the full validation's
const sessionInitial = session.outcome();
const referenceInitial = validateSpace({
  space,
  parse: initialParse,
  compilation: initialCompilation,
  layerNames,
});
check(
  "the initial session outcome is the full validation's",
  JSON.stringify(sessionInitial.verdicts) ===
    JSON.stringify(referenceInitial.verdicts) &&
    JSON.stringify(sessionInitial.stats) ===
      JSON.stringify(referenceInitial.stats),
);
check(
  "the pristine assembly carries no verdict",
  sessionInitial.verdicts.length === 0,
);

// ---- the cold reference: a full validation on a pristine space -----

const pristineJoined = layerNames
  .map((layerName) =>
    (initialSources[layerName] ?? "").endsWith("\n")
      ? (initialSources[layerName] ?? "")
      : (initialSources[layerName] ?? "") + "\n",
  )
  .join("");
const pristineParsed = parseLanguage(pristineJoined);
const pristineCompiled = compileLanguage(pristineParsed.layers);
const coldSamples: number[] = [];
for (let index = 0; index < 5; index += 1) {
  const start = performance.now();
  validateSpace({
    space: new Space(pristineCompiled.layers),
    parse: pristineParsed,
    compilation: pristineCompiled,
    layerNames,
  });
  coldSamples.push(performance.now() - start);
}
const coldReference = median(coldSamples);
console.log(
  "  cold full validation reference: " + coldReference.toFixed(1) + " ms",
);

// ---- the chained editions ------------------------------------------

interface Edition {
  label: string;
  layerName: LayerName;
  mutate: (source: string) => string;
  expectVerdicts?: number;
  maxRebuiltWalks?: number; // core layers are read everywhere — broad invalidation is CORRECT
  expectCheap?: boolean; // must the revalidation beat the cold reference by 2x?
}

const editions: Edition[] = [
  {
    label: "a betrayed expect (pn-philosophers-5, core)",
    layerName: asLayerName("pn-philosophers-5"),
    mutate: (source) =>
      source.replace(
        "expect places/philo1.think1/marking = 1",
        "expect places/philo1.think1/marking = 7",
      ),
    expectVerdicts: 1,
  },
  {
    label: "an undeclared override (pn-philosophers, core)",
    layerName: asLayerName("pn-philosophers"),
    mutate: (source) =>
      source + "  tests\n    expect places/philo1.think1/marking absent\n",
    expectVerdicts: 2,
  },
  {
    label: "a new tests block (record, the ontology's root)",
    layerName: asLayerName("record"),
    mutate: (source) =>
      source + "\n  tests\n    expect specification/record/identifier = 999\n",
  },
  {
    label: "the betrayed expect reverted (pn-philosophers-5)",
    layerName: asLayerName("pn-philosophers-5"),
    mutate: (source) =>
      source.replace(
        "expect places/philo1.think1/marking = 7",
        "expect places/philo1.think1/marking = 1",
      ),
    expectVerdicts: 5,
  },
  {
    label:
      "a contract's reading level changed (sperner-hypergraph, peripheral)",
    layerName: asLayerName("sperner-hypergraph"),
    mutate: (source) =>
      source.replace(
        'check sperner\n    level = "root"',
        'check sperner\n    level = "instance"',
      ),
    maxRebuiltWalks: 3,
    expectCheap: true,
  },
  {
    label: "a living draft's expect betrayed (users-draft)",
    layerName: asLayerName("users-draft"),
    mutate: (source) =>
      source.replace(
        "expect places/philo1.think1/marking = 1",
        "expect places/philo1.think1/marking = 7",
      ),
    expectVerdicts: 7,
    maxRebuiltWalks: 1,
    expectCheap: true,
  },
];

let lastParsed: ReturnType<typeof freshParse> | null = null;
let lastCompilation: ReturnType<typeof freshCompilation> | null = null;
for (const edition of editions) {
  const before = sources[edition.layerName] ?? "";
  const after = edition.mutate(before);
  check("the mutation applied: " + edition.label, after !== before);
  sources[edition.layerName] = after;

  const parsed = freshParse();
  const compilation = freshCompilation(parsed);
  lastParsed = parsed;
  lastCompilation = compilation;

  const start = performance.now();
  const sessionOutcome = session.applyEdition({
    layerName: edition.layerName,
    parse: parsed,
    compilation,
  });
  const sessionMs = performance.now() - start;
  const rebuilt = session.rebuiltWalks();

  const referenceOutcome = validateSpace({
    space,
    parse: parsed,
    compilation,
    layerNames,
  });

  check(
    "verdicts identical after: " + edition.label,
    JSON.stringify(sessionOutcome.verdicts) ===
      JSON.stringify(referenceOutcome.verdicts),
  );
  check(
    "stats identical after: " + edition.label,
    JSON.stringify(sessionOutcome.stats) ===
      JSON.stringify(referenceOutcome.stats),
  );
  if (edition.expectVerdicts !== undefined) {
    check(
      "verdict count as expected after: " +
        edition.label +
        " (" +
        sessionOutcome.verdicts.length +
        ")",
      sessionOutcome.verdicts.length === edition.expectVerdicts,
    );
  }
  if (edition.maxRebuiltWalks !== undefined) {
    check(
      "walk rebuilds within bounds after: " +
        edition.label +
        " (" +
        rebuilt +
        ")",
      rebuilt <= edition.maxRebuiltWalks,
    );
  }
  if (edition.expectCheap === true) {
    check(
      "the revalidation is at least 2x cheaper than cold: " +
        edition.label +
        " (" +
        sessionMs.toFixed(1) +
        " ms vs " +
        coldReference.toFixed(1) +
        " ms)",
      sessionMs <= coldReference / 2,
    );
  }
  console.log(
    "  " +
      edition.label +
      ": " +
      sessionOutcome.verdicts.length +
      " verdict(s), " +
      rebuilt +
      " walk(s) rebuilt, " +
      sessionMs.toFixed(1) +
      " ms",
  );
}

// ---- the session keeps the caller's fresh parse and compilation ----

check("the session keeps the last parse", session.parse === lastParsed);
check(
  "the session keeps the last compilation",
  session.compilation === lastCompilation,
);

// =====================================================================
// the ledger
// =====================================================================

console.log(
  "validation session checks: " +
    assertions +
    " assertions, " +
    failures.length +
    " failure(s)",
);
for (const failure of failures) {
  console.log("FAIL " + failure);
}
process.exit(failures.length > 0 ? 1 : 0);
