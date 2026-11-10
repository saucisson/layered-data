// The vocabulary's treaty checks (ADR-0104): three strata, one
// story. The informatics words keep their established names —
// staging stays staging, the linter keeps the industry's word in
// both tongues — the ⟪…⟫ marks cite the glossary, each tongue its
// own term, and the story (the concepts informatics does not name)
// lives in ONE field, the geologist's: bedrock, quarry, geologist,
// stratigraphic column. The retired words — la linteuse, la plume,
// l'armoire, le tronc, la colonne vertébrale, la scène — appear in
// no rendered string, while the identifiers (penLoop.ts,
// wardrobeClient.ts, PEN_*) keep their established names: the
// treaty governs the words humans read, not the code's spine.
//
//     node tests/terminology-checks.mts   (exit 1 on any failure)

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { VOCABULARY } from "../src/domain/messages.ts";
import { EDITION_REFUSAL_LABEL } from "../src/presentation/i18n.ts";

// ---- the assertion ledger ------------------------------------------

const failures: string[] = [];
let assertions = 0;

function check(label: string, condition: boolean): void {
  assertions++;
  if (!condition) failures.push(label);
}

// ---- the .tsx source reader ---------------------------------------
//
// The same tiny object-literal parser the i18n harness uses: the
// presentation data lives partly in .tsx files node cannot import
// (no JSX stripping), and the data sections are plain literals —
// the check reads exactly what the components render.

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

const rootDirectory = join(import.meta.dirname, "..");
const presentationDirectory = join(rootDirectory, "src", "presentation");

// =====================================================================
// the treaty's ledger — the glossary and the tutorial, parsed sources
// =====================================================================

const glossary = readExportedData({ file: join(presentationDirectory, "notions.tsx"), declaration: "GLOSSARY" }) as {
  [id: string]: { term: { en: string; fr: string }; definition: { en: string; fr: string } };
};
const glossaryIds = Object.keys(glossary);

// The tutorial is a markdown pair now — the prose each tongue renders
// is the file itself, read whole.
const tutorialMarkdownSource = (language: string) =>
  readFileSync(join(presentationDirectory, "tutorial." + language + ".md"), "utf8");

// The per-tongue prose: every string a tongue renders, walked from
// the parsed data — { en: … } values feed the English corpus, { fr: … }
// values the French one, the rest recurses (code blocks feed both —
// they are the artifact, not the narration).
function bilingualStringsOf(value: DataValue, tongue: string, into: string[]): void {
  if (typeof value === "string") {
    into.push(value);
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) bilingualStringsOf(item, tongue, into);
    return;
  }
  if (value !== null && typeof value === "object") {
    for (const [key, item] of Object.entries(value)) {
      if ((key === "en" || key === "fr") && typeof item === "string") {
        if (key === tongue) into.push(item);
        continue;
      }
      bilingualStringsOf(item, tongue, into);
    }
  }
}

const englishProse: string[] = [];
const frenchProse: string[] = [];
englishProse.push(tutorialMarkdownSource("en"));
frenchProse.push(tutorialMarkdownSource("fr"));
bilingualStringsOf(glossary as unknown as DataValue, "en", englishProse);
bilingualStringsOf(glossary as unknown as DataValue, "fr", frenchProse);

// =====================================================================
// stratum 1 — the informatics words keep their adopted names
// =====================================================================


/** Indexed access in assertions: a missing element is a test failure,
 * not a silent undefined. */
function at<T>(list: readonly T[], index: number): T {
  const value = list[index];
  if (value === undefined) throw new Error("missing element at index " + index);
  return value;
}

check(
  "the linter wears the industry's name in both tongues — la linteuse is retired",
  glossary["linter"] !== undefined &&
    glossary["linter"].term.en === "linter" &&
    glossary["linter"].term.fr === "linter",
);

check(
  "staging keeps its borrowed name inside French prose — la scène is retired",
  frenchProse.some((text) => text.includes("staging")) && !frenchProse.some((text) => /\bscène\b/.test(text)),
);

// The retired narration words, measured over EVERY string literal of
// src and server.ts — double-quoted, single-quoted and template
// literals (their ${…} holes dropped). The identifiers keep their
// names: penLoop and wardrobeClient are code, not narration, and
// no identifier ever carries a retired French word.
const retiredNarration: { word: string; pattern: RegExp }[] = [
  { word: "la linteuse", pattern: /linteuse/ },
  { word: "la plume", pattern: /plume/ },
  { word: "l'armoire", pattern: /armoire/ },
  { word: "le tronc", pattern: /tronc/ },
  { word: "la colonne vertébrale", pattern: /colonne vertébrale/ },
  { word: "la scène", pattern: /scène/ },
  { word: "the trunk", pattern: /\btrunk\b/ },
  { word: "the spine", pattern: /\bspine\b/ },
  { word: "the wardrobe", pattern: /\bwardrobe\b/ },
  { word: "the pen", pattern: /\bpen\b/ },
];

function stringLiteralsOf(source: string): string[] {
  const literals: string[] = [];
  for (const match of source.matchAll(/"((?:[^"\\\n]|\\.)*)"/g)) literals.push(at(match, 1));
  for (const match of source.matchAll(/'((?:[^'\\\n]|\\.)*)'/g)) literals.push(at(match, 1));
  for (const match of source.matchAll(/`((?:[^`\\]|\\.)*)`/g)) {
    literals.push(at(match, 1).replace(/\$\{[^}]*\}/g, "…"));
  }
  return literals;
}

function sourceFilesUnder(directory: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const file = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...sourceFilesUnder(file));
    else if (entry.name.endsWith(".ts") || entry.name.endsWith(".tsx")) files.push(file);
  }
  return files;
}

const everyLiteral: string[] = [];
for (const file of [
  ...sourceFilesUnder(join(rootDirectory, "src")),
  ...sourceFilesUnder(join(rootDirectory, "server")),
  join(rootDirectory, "server.ts"),
]) {
  everyLiteral.push(...stringLiteralsOf(readFileSync(file, "utf8")));
}
// the tutorial's markdown pair is narration too — each file is read
// whole: the retired words stay out of the tongues' prose, not just
// out of the code's strings
everyLiteral.push(tutorialMarkdownSource("en"), tutorialMarkdownSource("fr"));

check(
  "the retired story words appear in no string literal — the identifiers keep their names, the rendered text speaks the treaty",
  everyLiteral.every((literal) => retiredNarration.every(({ pattern }) => !pattern.test(literal))),
);

// =====================================================================
// stratum 2 — the ⟪…⟫ marks cite the glossary, each tongue its term
// =====================================================================

const differingTerms = Object.values(glossary).filter((entry) => entry.term.en.toLowerCase() !== entry.term.fr.toLowerCase());
const frenchCitedTerms = new Set(differingTerms.map((entry) => entry.term.fr.toLowerCase()));
const englishCitedTerms = new Set(differingTerms.map((entry) => entry.term.en.toLowerCase()));

function markedWordsOf(text: string): string[] {
  const words: string[] = [];
  let match: RegExpExecArray | null;
  const pattern = /⟪([^⟫]+)⟫/g;
  while ((match = pattern.exec(text)) !== null) words.push(at(match, 1).trim().toLowerCase());
  return words;
}

check(
  "each tongue cites the glossary in its own term — a French word never wears the ⟪…⟫ marks inside English prose, nor the reverse",
  englishProse.every((text) => markedWordsOf(text).every((word) => !frenchCitedTerms.has(word))) &&
    frenchProse.every((text) => markedWordsOf(text).every((word) => !englishCitedTerms.has(word))),
);

// =====================================================================
// stratum 3 — the story lives in the geologist's field
// =====================================================================

check(
  "the glossary carries the story's three terms with their two-tongue pairs — carrière, géologue, socle",
  glossary["carrière"] !== undefined &&
    glossary["carrière"].term.en === "quarry" &&
    glossary["carrière"].term.fr === "carrière" &&
    glossary["géologue"] !== undefined &&
    glossary["géologue"].term.en === "geologist" &&
    glossary["géologue"].term.fr === "géologue" &&
    glossary["socle"] !== undefined &&
    glossary["socle"].term.en === "bedrock" &&
    glossary["socle"].term.fr === "socle",
);

check(
  "the tutorial reads along the stratigraphic column — the spine is retired, and both tongues walk it",
  glossary["colonne stratigraphique"] !== undefined &&
    glossary["colonne stratigraphique"].term.en === "stratigraphic column" &&
    glossary["colonne vertébrale"] === undefined &&
    frenchProse.some((text) => text.includes("colonne stratigraphique")) &&
    englishProse.some((text) => text.includes("stratigraphic column")),
);

check(
  "the kernel code follows the story: socle-occupé translates bedrock-occupied, and the trunk's code is retired",
  VOCABULARY["socle-occupé"] !== undefined &&
    VOCABULARY["socle-occupé"].en === "bedrock-occupied" &&
    VOCABULARY["socle-occupé"].fr === "socle-occupé" &&
    VOCABULARY["tronc-occupé"] === undefined,
);

check(
  "the edition refusal follows the story: socle-édité carries the bedrock in both tongues, and the trunk's code is retired",
  EDITION_REFUSAL_LABEL["socle-édité"] !== undefined &&
    EDITION_REFUSAL_LABEL["socle-édité"].en.includes("bedrock") &&
    EDITION_REFUSAL_LABEL["socle-édité"].fr.includes("socle") &&
    EDITION_REFUSAL_LABEL["socle-édité"].en !== EDITION_REFUSAL_LABEL["socle-édité"].fr &&
    EDITION_REFUSAL_LABEL["tronc-édité"] === undefined,
);

check(
  "the tutorial's anchor speaks the field: the geologist names the language in both tongues of the markdown pair",
  tutorialMarkdownSource("fr").includes("géologue") &&
    tutorialMarkdownSource("en").includes("geologist") &&
    !tutorialMarkdownSource("fr").includes("plume") &&
    !tutorialMarkdownSource("en").includes("plume"),
);

const serverSource = [join(rootDirectory, "server.ts"), ...sourceFilesUnder(join(rootDirectory, "server"))]
  .map((file) => readFileSync(file, "utf8"))
  .join("\n");

check(
  "the geologist's system prompt speaks the treaty in both tongues — the pen is retired from the words humans read",
  serverSource.includes("You are the geologist of the Layered Data") &&
    serverSource.includes("Tu es le géologue de l'atelier"),
);

check(
  "the server announces the quarry and guards the bedrock at its protocol",
  serverSource.includes("carrière Layered Data") && serverSource.includes("le socle est en lecture seule"),
);

check(
  "the glossary keeps thirty-five entries — the treaty's ledger, one entry per notion the workshop names (assume and masque retired with ADR-0106)",
  glossaryIds.length === 35,
);

// =====================================================================
// the ledger
// =====================================================================

console.log("terminology checks: " + assertions + " assertions, " + failures.length + " failure(s)");
for (const failure of failures) {
  console.log("FAIL " + failure);
}
process.exit(failures.length > 0 ? 1 : 0);
