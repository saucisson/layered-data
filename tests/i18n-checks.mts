// The i18n mechanism checks: English-only content for now (ADR-0113),
// the translation plumbing alive and total — every helper tolerates
// absent French with an English fallback, so a French catalog can
// return as pure content without any code change.
//
//     node tests/i18n-checks.mts   (exit 1 on any failure)

import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  DEFAULT_LANGUAGE,
  VOCABULARY,
  fact,
  kernelLabel,
  messageCodes,
  renderMessage,
} from "../src/domain/messages.ts";
import {
  bilingualParityOf,
  editionRefusalLabel,
  EDITION_REFUSAL_LABEL,
  localized,
  say,
} from "../src/presentation/i18n.ts";
import { WORKSHOP_SCENARIOS } from "../src/presentation/scenarios.ts";
import {
  lensLayers,
  shapeLabel,
  viewNote,
  viewpointLayers,
} from "../src/presentation/viewTree.ts";
import {
  LAYER_ROLE,
  layerRoleNames,
} from "../src/presentation/workshopInventory.ts";
import {
  SUPPORTED_LANGUAGES,
  initI18n,
  t,
} from "../src/infrastructure/i18n.ts";
import { asLayerName } from "../src/domain/identifiers.ts";
import {
  assembleLayeredDataKernel,
  KERNEL_LAYER_NAMES,
  TUTORIAL_LAYER_NAMES,
} from "../src/application/corpus.ts";
import {
  listingLayersOf,
  parseTutorialMarkdown,
} from "../src/presentation/tutorialMarkdown.ts";

// ---- the assertion ledger ------------------------------------------

const failures: string[] = [];
let assertions = 0;

function check(label: string, condition: boolean): void {
  assertions++;
  if (!condition) failures.push(label);
}

// =====================================================================
// the domain messages: English renders, French falls back
// =====================================================================

check("English is the default language", DEFAULT_LANGUAGE === "en");

const emptyRenderingCodes = new Set(["cycle-guard"]);
check(
  "every kernel message code renders non-empty in English and falls back to English when asked for French — the cycle guard alone renders empty",
  messageCodes().every((code) => {
    const english = renderMessage({ message: fact(code), language: "en" });
    const french = renderMessage({ message: fact(code), language: "fr" });
    if (emptyRenderingCodes.has(code)) return english === "" && french === "";
    return english !== "" && french === english;
  }),
);

check(
  "an unknown message code renders as itself with its parameters — total, never an exception",
  renderMessage({
    message: fact("no-such-code", { layer: "wb1" }),
    language: "en",
  }) === 'no-such-code {"layer":"wb1"}' &&
    renderMessage({ message: fact("no-such-code"), language: "fr" }) ===
      "no-such-code",
);

check(
  "the kernel vocabulary keeps its stable French codes as keys and translates them in English; kernelLabel falls back to English for French",
  Object.entries(VOCABULARY).every(
    ([code, entry]) =>
      entry.en.length > 0 &&
      kernelLabel({ code, language: "en" }) === entry.en &&
      kernelLabel({ code, language: "fr" }) === (entry.fr ?? entry.en),
  ) &&
    kernelLabel({ code: "code-hors-vocabulaire", language: "fr" }) ===
      "code-hors-vocabulaire",
);

// =====================================================================
// the presentation helpers: the mechanism is alive, the fallback total
// =====================================================================

check(
  "say and localized render French when a French text is present, and fall back to English when it is absent",
  say({ language: "en", en: "the workshop", fr: "l'atelier" }) ===
    "the workshop" &&
    say({ language: "fr", en: "the workshop", fr: "l'atelier" }) ===
      "l'atelier" &&
    say({ language: "fr", en: "the workshop" }) === "the workshop" &&
    localized({ language: "fr", text: { en: "the layers" } }) === "the layers" &&
    localized({ language: "fr", text: { en: "the layers", fr: "les couches" } }) ===
      "les couches",
);

check(
  "the edition refusals carry a non-empty English label, unknown codes render as themselves",
  Object.entries(EDITION_REFUSAL_LABEL).every(
    ([code, entry]) =>
      bilingualParityOf(entry) &&
      editionRefusalLabel({ code, language: "en" }).length > 0 &&
      editionRefusalLabel({ code, language: "fr" }) ===
        editionRefusalLabel({ code, language: "en" }),
  ) &&
    editionRefusalLabel({ code: "code-inconnu", language: "fr" }) ===
      "code-inconnu",
);

check(
  "bilingualParityOf accepts English-only entries and rejects an empty English text",
  bilingualParityOf({ en: "only English" }) &&
    bilingualParityOf({ en: "the layers", fr: "les couches" }) &&
    !bilingualParityOf({ en: "" }) &&
    !bilingualParityOf({ en: "same", fr: "same" }) &&
    !bilingualParityOf({ en: "text", fr: "" }),
);

check(
  "shapeLabel names the glyphs in English, and French falls back to the English name",
  shapeLabel({ shape: null, language: "en" }) === "no shape" &&
    shapeLabel({ shape: null, language: "fr" }) === "no shape" &&
    shapeLabel({ shape: [{ shape: "circle" }], language: "fr" }) === "circle" &&
    shapeLabel({ shape: [{ shape: "line", ports: 2 }], language: "fr" }) ===
      "2-port arc",
);

// =====================================================================
// the i18next plumbing: one catalog, total fallback
// =====================================================================

check(
  "the workshop supports English only for now, and i18next initializes",
  SUPPORTED_LANGUAGES.length === 1 && SUPPORTED_LANGUAGES[0] === "en" &&
    (initI18n({ language: "en" }), true),
);

check(
  "t translates a known key and returns the key itself for an unknown one, in any language",
  t("layer") === "layer" &&
    t("no-such-key") === "no-such-key" &&
    (initI18n({ language: "fr" }), t("no-such-key") === "no-such-key"),
);

// =====================================================================
// the bilingual inventories: non-empty English everywhere
// =====================================================================

check(
  "the guided tour keeps its fourteen scenarios, each with a non-empty English label and text",
  WORKSHOP_SCENARIOS.length === 14 &&
    WORKSHOP_SCENARIOS.every(
      (scenario, index) =>
        scenario.id === "S" + (index + 1) &&
        bilingualParityOf(scenario.label) &&
        bilingualParityOf(scenario.text),
    ),
);

// The lens/viewpoint inventory is derived from the space (issue #283):
// the notes are the layers' head comments, read as data.
const corpusDirectory = join(import.meta.dirname, "..", "formalisms", "kernel");
const kernelSources: Record<string, string> = Object.fromEntries(
  KERNEL_LAYER_NAMES.map((layerName) => [
    layerName,
    readFileSync(join(corpusDirectory, layerName + ".ld"), "utf8"),
  ]),
);
const kernel = assembleLayeredDataKernel({ layerSources: kernelSources });
const derivedLenses = lensLayers({ space: kernel.space });
const derivedViewpoints = viewpointLayers({ space: kernel.space });

check(
  "the derived inventory finds the kernel lenses (graph-display included) and viewpoints",
  ["graph-display", "petrinet-display", "kahn-display", "logic-circuit-display"].every((lens) =>
    derivedLenses.includes(lens),
  ) &&
    ["petrinet-view", "pn-philosophers-5-course", "kahn-course", "wb-course"].every((viewpoint) =>
      derivedViewpoints.includes(viewpoint),
    ),
);

check(
  "the view tree notes cover every derived lens and viewpoint with a non-empty English note",
  [...derivedLenses, ...derivedViewpoints].every((viewLayer) =>
    bilingualParityOf(viewNote({ space: kernel.space, layer: viewLayer })),
  ),
);

check(
  "the layer inventory describes every layer with a non-empty English role, layerRoleNames agrees with it",
  Object.keys(LAYER_ROLE).length === layerRoleNames().length &&
    layerRoleNames().every((layerName) => {
      const role = LAYER_ROLE[layerName];
      return role !== undefined && bilingualParityOf(role);
    }),
);

// ---- the glossary (parsed source: .tsx is not importable by node) ----

const glossarySource = readFileSync(
  join(import.meta.dirname, "..", "src", "presentation", "notions.tsx"),
  "utf8",
);
const glossaryTermCount = (glossarySource.match(/term:\s*\{/g) ?? []).length;
check(
  "the glossary keeps its entries, each with a non-empty English term",
  glossaryTermCount === 45 &&
    !glossarySource.includes("term: { en: \"\" }"),
);

// every ⟪notion⟫ marker of the tutorial resolves to a glossary entry (#323)
const glossaryTerms = [
  ...glossarySource.matchAll(/term:\s*\{\s*en:\s*"([^"]+)"/g),
].map((match) => (match[1] ?? "").toLowerCase());
const glossaryIdsLower = [
  ...glossarySource.matchAll(/^ {2}"?([a-z0-9- ]+)"?:\s*\{/gm),
].map((match) => (match[1] ?? "").toLowerCase());
const tutorialMarkerSource = readFileSync(
  join(import.meta.dirname, "..", "src", "presentation", "tutorial.en.md"),
  "utf8",
);
const tutorialMarkers = [
  ...new Set([...tutorialMarkerSource.matchAll(/⟪([^⟫]+)⟫/g)].map((m) => (m[1] ?? "").toLowerCase())),
];
check(
  "every ⟪notion⟫ marker of the tutorial resolves to a glossary entry (#323)",
  tutorialMarkers.length > 0 &&
    tutorialMarkers.every(
      (marker) => glossaryTerms.includes(marker) || glossaryIdsLower.includes(marker),
    ),
);

// ---- the tutorial: one markdown file, English ------------------------

const tutorialSource = readFileSync(
  join(import.meta.dirname, "..", "src", "presentation", "tutorial.en.md"),
  "utf8",
);
const tutorialBlocks = parseTutorialMarkdown({ source: tutorialSource });
check(
  "the tutorial markdown parses, and every listing names a layer of the tutorial corpus — every tutorial layer gets its listing",
  tutorialSource.length > 0 &&
    listingLayersOf({ blocks: tutorialBlocks }).every((layer) =>
      TUTORIAL_LAYER_NAMES.includes(asLayerName(layer)),
    ) &&
    [...TUTORIAL_LAYER_NAMES].sort().join(",") ===
      [...new Set(listingLayersOf({ blocks: tutorialBlocks }))]
        .sort()
        .join(","),
);

// ---- the geologist's instructions: English only, signature kept -------

const promptsSource = readFileSync(
  join(import.meta.dirname, "..", "server", "geologistPrompts.ts"),
  "utf8",
);
check(
  "the geologist's system prompt is English-only, and penInstructions keeps its signature",
  promptsSource.includes("PEN_INSTRUCTIONS_EN") &&
    !promptsSource.includes("PEN_INSTRUCTIONS_FR") &&
    promptsSource.includes('penInstructions("en")'),
);

// =====================================================================
// the ledger
// =====================================================================

console.log(
  "i18n checks: " +
    assertions +
    " assertions, " +
    failures.length +
    " failure(s)",
);
for (const failure of failures) {
  console.log("FAIL " + failure);
}
process.exit(failures.length > 0 ? 1 : 0);
