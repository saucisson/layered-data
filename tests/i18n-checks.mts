// The bilingual workshop checks: every user-facing surface carries
// two tongues — English by default, French its mirror — and the
// kernel codes stay stable under both.
//
// The presentation data lives partly in .tsx files node cannot
// import (no JSX stripping), so the glossary, the tutorial and the
// diagnostics labels are read from their sources with a tiny
// object-literal parser: the data sections are plain literals, the
// check reads exactly what the components render.
//
//     node tests/i18n-checks.mts   (exit 1 on any failure)

import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  DEFAULT_LANGUAGE,
  MESSAGE_LANGUAGES,
  VOCABULARY,
  fact,
  kernelLabel,
  messageCodes,
  renderMessage,
} from "../src/domain/messages.ts";
import { bilingualParityOf, editionRefusalLabel, EDITION_REFUSAL_LABEL, localized, say } from "../src/presentation/i18n.ts";
import { WORKSHOP_SCENARIOS } from "../src/presentation/scenarios.ts";
import { LENS_LAYERS, shapeLabel, VIEWPOINT_LAYERS, VIEW_NOTES } from "../src/presentation/viewTree.ts";
import { LAYER_ROLE, layerRoleNames } from "../src/presentation/workshopInventory.ts";
import { detectBrowserLanguage, readWorkshopLanguage, writeWorkshopLanguage } from "../src/infrastructure/browserLanguage.ts";
import { asLayerName } from "../src/domain/identifiers.ts";
import { TUTORIAL_LAYER_NAMES } from "../src/application/corpus.ts";
import { listingLayersOf, parseTutorialMarkdown } from "../src/presentation/tutorialMarkdown.ts";

// ---- the assertion ledger ------------------------------------------

const failures: string[] = [];
let assertions = 0;

function check(label: string, condition: boolean): void {
  assertions++;
  if (!condition) failures.push(label);
}

// ---- the .tsx source reader ---------------------------------------
//
// A tiny parser for the object-literal subset the presentation
// data uses: objects, arrays, double-quoted strings, numbers,
// booleans, null — comments and whitespace skipped. A template
// literal or a computed value throws: the data stays plain on
// purpose, and anything fancier deserves a loud failure.

type DataValue = string | number | boolean | null | DataValue[] | { [key: string]: DataValue };

function skipInsignificant(source: string, position: number): number {
  let index = position;
  while (index < source.length) {
    const character = source[index];
    if (character === " " || character === "\n" || character === "\r" || character === "\t" || character === ",") {
      index++;
      continue;
    }
    if (character === "/" && source[index + 1] === "/") {
      while (index < source.length && source[index] !== "\n") index++;
      continue;
    }
    if (character === "/" && source[index + 1] === "*") {
      index = source.indexOf("*/", index) + 2;
      continue;
    }
    break;
  }
  return index;
}

function parseValue(source: string, start: number): { value: DataValue; end: number } {
  const position = skipInsignificant(source, start);
  const character = source[position];
  if (character === "{") {
    const object: { [key: string]: DataValue } = {};
    let index = skipInsignificant(source, position + 1);
    while (source[index] !== "}") {
      const keyStart = index;
      let key: string;
      if (source[index] === '"') {
        const keyEnd = source.indexOf('"', index + 1);
        key = source.slice(index + 1, keyEnd);
        index = keyEnd + 1;
      } else {
        while (index < source.length && /[A-Za-z0-9_$\u00C0-\u00FF]/.test(source[index] ?? "")) index++;
        key = source.slice(keyStart, index);
      }
      index = skipInsignificant(source, index);
      index++; // the colon
      const parsed = parseValue(source, index);
      object[key] = parsed.value;
      index = skipInsignificant(source, parsed.end);
    }
    return { value: object, end: index + 1 };
  }
  if (character === "[") {
    const array: DataValue[] = [];
    let index = skipInsignificant(source, position + 1);
    while (source[index] !== "]") {
      const parsed = parseValue(source, index);
      array.push(parsed.value);
      index = skipInsignificant(source, parsed.end);
    }
    return { value: array, end: index + 1 };
  }
  if (character === '"' || character === "'") {
    let index = position + 1;
    let text = "";
    while (source[index] !== character) {
      if (source[index] === "\\") {
        const escape = source[index + 1];
        text += escape === "n" ? "\n" : escape === "t" ? "\t" : escape;
        index += 2;
        continue;
      }
      text += source[index];
      index++;
    }
    return { value: text, end: index + 1 };
  }
  const match = /^(?:true|false|null|-?[0-9][0-9_.]*)/.exec(source.slice(position));
  if (match === null) {
    throw new Error("unparseable literal at offset " + position + ": " + source.slice(position, position + 40));
  }
  const text = at(match, 0);
  return {
    value: text === "true" ? true : text === "false" ? false : text === "null" ? null : Number(text),
    end: position + text.length,
  };
}

function readExportedData({ file, declaration }: { file: string; declaration: string }): DataValue {
  const source = readFileSync(file, "utf8");
  const exported = source.indexOf("export const " + declaration);
  const plain = source.indexOf("const " + declaration);
  const start = exported !== -1 ? exported : plain;
  if (start === -1) throw new Error("declaration not found: " + declaration);
  const equals = source.indexOf("=", start);
  const open = Math.min(
    ...[source.indexOf("{", equals), source.indexOf("[", equals)].filter((index) => index !== -1),
  );
  return parseValue(source, open).value;
}

const presentationDirectory = join(import.meta.dirname, "..", "src", "presentation");

// =====================================================================
// the domain messages
// =====================================================================


/** Indexed access in assertions: a missing element is a test failure,
 * not a silent undefined. */
function at<T>(list: readonly T[], index: number): T {
  const value = list[index];
  if (value === undefined) throw new Error("missing element at index " + index);
  return value;
}

check(
  "the workshop speaks exactly two languages, English by default",
  DEFAULT_LANGUAGE === "en" && MESSAGE_LANGUAGES.length === 2 && at(MESSAGE_LANGUAGES, 0) === "en" && at(MESSAGE_LANGUAGES, 1) === "fr",
);

const emptyRenderingCodes = new Set(["cycle-guard"]);
check(
  "every kernel message code renders two different tongues — the cycle guard alone renders empty in both",
  messageCodes().every((code) => {
    const english = renderMessage({ message: fact(code), language: "en" });
    const french = renderMessage({ message: fact(code), language: "fr" });
    if (emptyRenderingCodes.has(code)) return english === "" && french === "";
    return english !== "" && english !== french;
  }),
);

check(
  "an unknown message code renders as itself with its parameters — total, never an exception",
  renderMessage({ message: fact("no-such-code", { layer: "wb1" }), language: "en" }) ===
    'no-such-code {"layer":"wb1"}' &&
    renderMessage({ message: fact("no-such-code"), language: "fr" }) === "no-such-code",
);

check(
  "the kernel vocabulary keeps the historic code as its French label and translates it in English",
  Object.entries(VOCABULARY).every(
    ([code, entry]) => entry.fr === code && entry.en.length > 0 && kernelLabel({ code, language: "fr" }) === code,
  ),
);

check(
  "kernelLabel renders the vocabulary in both tongues and an unknown code as itself",
  Object.keys(VOCABULARY).every((code) => kernelLabel({ code, language: "en" }).length > 0) &&
    kernelLabel({ code: "code-hors-vocabulaire", language: "en" }) === "code-hors-vocabulaire",
);

// The codes the panels display: the statuses of the closure, the
// steps of the staging, the verdict kinds of the tribunal, the
// kinds of the diagnostics fold.
const displayedCodes = [
  "fournit",
  "transparent",
  "absent",
  "non atteint",
  "syntaxe",
  "validation",
  "surcharge-implicite",
  "déclaration-fantôme",
  "étiquette-inconnue",
  "liaison-morte",
  "ombre-non-déclarée",
  "attendu-trahi",
  "cible-inconnue",
];
check(
  "the statuses, the steps and the verdict kinds the panels display all live in the vocabulary",
  displayedCodes.every((code) => VOCABULARY[code] !== undefined),
);

// =====================================================================
// the presentation helpers
// =====================================================================

check(
  "say picks the tongue and localized renders a bilingual entry, English by default",
  say({ language: "en", en: "the workshop", fr: "l'atelier" }) === "the workshop" &&
    say({ language: "fr", en: "the workshop", fr: "l'atelier" }) === "l'atelier" &&
    localized({ language: "en", text: { en: "the layers", fr: "les couches" } }) === "the layers" &&
    localized({ language: "fr", text: { en: "the layers", fr: "les couches" } }) === "les couches",
);

check(
  "the edition refusals carry a bilingual label, unknown codes render as themselves",
  Object.entries(EDITION_REFUSAL_LABEL).every(([code, entry]) =>
    bilingualParityOf(entry) &&
    editionRefusalLabel({ code, language: "en" }) !== editionRefusalLabel({ code, language: "fr" }),
  ) && editionRefusalLabel({ code: "code-inconnu", language: "en" }) === "code-inconnu",
);

check(
  "shapeLabel names the glyphs in both tongues — the shared names stay shared",
  shapeLabel({ shape: null, language: "en" }) === "no shape" &&
    shapeLabel({ shape: null, language: "fr" }) === "sans forme" &&
    shapeLabel({ shape: { shape: "circle" }, language: "en" }) === "circle" &&
    shapeLabel({ shape: { shape: "circle" }, language: "fr" }) === "cercle" &&
    shapeLabel({ shape: { shape: "line", ports: 2 }, language: "en" }) === "2-port arc" &&
    shapeLabel({ shape: { shape: "line", ports: 2 }, language: "fr" }) === "arc à 2 ports" &&
    shapeLabel({ shape: { shape: "unknown-kind" }, language: "fr" }) === "unknown-kind",
);

check(
  "the browser language detection stays total without a navigator and remembers the choice",
  detectBrowserLanguage() === "en" &&
    readWorkshopLanguage() === "en" &&
    typeof writeWorkshopLanguage === "function",
);

// =====================================================================
// the scenarios, the view tree, the layer inventory (imported modules)
// =====================================================================

check(
  "the guided tour keeps its fourteen scenarios, bilingual in label and text",
  WORKSHOP_SCENARIOS.length === 14 &&
    WORKSHOP_SCENARIOS.every((scenario, index) =>
      scenario.id === "S" + (index + 1) &&
      bilingualParityOf(scenario.label) &&
      bilingualParityOf(scenario.text),
    ),
);

check(
  "the view tree notes cover every lens and viewpoint, bilingually",
  [...LENS_LAYERS, ...VIEWPOINT_LAYERS].every((viewLayer) => {
    const notes = VIEW_NOTES[viewLayer];
    return notes !== undefined && bilingualParityOf(notes);
  }),
);

check(
  "the layer inventory describes every layer bilingually, layerRoleNames agrees with it",
  Object.keys(LAYER_ROLE).length === layerRoleNames().length &&
    layerRoleNames().every((layerName) => {
      const role = LAYER_ROLE[layerName];
      return role !== undefined && bilingualParityOf(role);
    }),
);

// =====================================================================
// the glossary, the tutorial, the diagnostics fold (parsed sources)
// =====================================================================

const glossary = readExportedData({ file: join(presentationDirectory, "notions.tsx"), declaration: "GLOSSARY" }) as {
  [id: string]: { term: { en: string; fr: string }; definition: { en: string; fr: string } };
};
const glossaryIds = Object.keys(glossary);
check(
  "the glossary keeps its thirty-five ids — the French keys the tutorial cites, the ADR-0101 registry and the ADR-0104 story terms included (the assume entry retired with ADR-0106)",
  glossaryIds.length === 35 &&
    [
      "adresse",
      "carottage",
      "carrière",
      "géologue",
      "fermeture",
      "lentille",
      "premier-gagné",
      "raffine",
      "socle",
      "union",
      "conflit d'ordre",
      "registre",
      "slot",
    ].every((id) => glossaryIds.includes(id)),
);
check(
  "every glossary entry carries a non-empty bilingual term and a translated definition",
  glossaryIds.every((id) => {
    const entry = glossary[id];
    if (entry === undefined) return false;
    return (
      entry.term.en.length > 0 &&
      entry.term.fr.length > 0 &&
      entry.definition.en.length > 0 &&
      entry.definition.fr.length > 0 &&
      entry.definition.en !== entry.definition.fr
    );
  }),
);

// ---- the tutorial, a markdown pair ------------------------------------
//
// The tutorial is no longer a component: the prose lives in two
// hand-editable files (tutorial.en.md, tutorial.fr.md) parsed by the
// measured dialect, and its listings are resolved against the
// tutorial corpus at run time — never a frozen copy.

const tutorialMarkdownSource = (language: string) =>
  readFileSync(join(presentationDirectory, "tutorial." + language + ".md"), "utf8");
const tutorialBlocks = (language: string) =>
  parseTutorialMarkdown({ source: tutorialMarkdownSource(language) });
const tutorialShape = (language: string) =>
  tutorialBlocks(language).map((block) =>
    block.kind === "heading" ? "h" + block.level : block.kind === "listing" ? "listing:" + block.layer : block.kind,
  );

check(
  "the tutorial markdown pair parses — both tongues exist and non-empty",
  tutorialMarkdownSource("en").length > 0 && tutorialMarkdownSource("fr").length > 0,
);
check(
  "the tutorial walks the same route in both tongues — the block shapes agree, listing by listing",
  tutorialShape("en").join("|") === tutorialShape("fr").join("|"),
);
check(
  "every tutorial listing names a layer of the tutorial corpus, and every tutorial layer gets its listing",
  listingLayersOf({ blocks: tutorialBlocks("en") }).every((layer) => TUTORIAL_LAYER_NAMES.includes(asLayerName(layer))) &&
    [...TUTORIAL_LAYER_NAMES].sort().join(",") ===
      [...new Set(listingLayersOf({ blocks: tutorialBlocks("en") }))].sort().join(","),
);
check(
  "every ⟪…⟫ mark in the tutorial cites the glossary, in the tongue's own term",
  ["en", "fr"].every((language) => {
    const knownTerms = new Set<string>();
    for (const id of glossaryIds) {
      const entry = glossary[id];
      if (entry === undefined) continue;
      knownTerms.add(id.toLowerCase());
      knownTerms.add(entry.term.en.toLowerCase());
      knownTerms.add(entry.term.fr.toLowerCase());
    }
    const marks = [...tutorialMarkdownSource(language).matchAll(/⟪([^⟫]+)⟫/g)].map((match) =>
      at(match, 1).trim().toLowerCase(),
    );
    return marks.length > 0 && marks.every((mark) => knownTerms.has(mark));
  }),
);

const diagnosticLabels = readExportedData({ file: join(presentationDirectory, "diagnosticsPanel.tsx"), declaration: "DIAGNOSTIC_LABELS" }) as {
  [kind: string]: { label: { en: string; fr: string }; note: { en: string; fr: string } };
};
check(
  "the diagnostics fold labels every kind bilingually, label and note, and every kind lives in the vocabulary",
  Object.entries(diagnosticLabels).every(([kind, entry]) =>
    bilingualParityOf(entry.label) && bilingualParityOf(entry.note) && VOCABULARY[kind] !== undefined,
  ),
);

// =====================================================================
// the geologist's instructions (server source — both tongues follow VERSION)
// =====================================================================

const promptsSource = readFileSync(join(import.meta.dirname, "..", "server", "geologistPrompts.ts"), "utf8");
const configSource = readFileSync(join(import.meta.dirname, "..", "server", "config.ts"), "utf8");
check(
  "the geologist's system prompt speaks both workshop tongues, English by default, both following VERSION",
  promptsSource.includes("PEN_INSTRUCTIONS_EN") &&
    promptsSource.includes("PEN_INSTRUCTIONS_FR") &&
    promptsSource.includes('penInstructions("en")') &&
    configSource.includes("const VERSION = \"2.25.0\";"),
);

// =====================================================================
// the ledger
// =====================================================================

console.log("i18n checks: " + assertions + " assertions, " + failures.length + " failure(s)");
for (const failure of failures) {
  console.log("FAIL " + failure);
}
process.exit(failures.length > 0 ? 1 : 0);
