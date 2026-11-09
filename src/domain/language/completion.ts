// The layer language: completion.
//
// Completion is a read service, never a parallel analysis: it reuses
// the written shapes (acts, references, paths) and the space's keys,
// and it never throws — a half-written line is the normal input, not
// an error. The editor (vscode/completion.mts) feeds it the document
// text and the cursor; the answer is plain data.
//
// Four contexts, detected on the text before the cursor:
//   - `@…` — a reference: layer names after `@`, path segments after
//     `@layer/…` (read from the space's keys at that address);
//   - `refines` / `then` — layer names again;
//   - `expect …` — the keys of the current layer at the typed path;
//   - anywhere else — the acts of the current block (the `layer` act
//     at the margin, the member acts and the special keys deeper).

import { DEFAULT_LANGUAGE, parseText, type Language } from "../messages.ts";
import { asLayerName, asLayerPath } from "../identifiers.ts";
import { type Space } from "../space.ts";
import { SPECIAL_KEYS } from "../specialKeys.ts";

export type CompletionKind = "act" | "layer" | "key";

export interface CompletionSuggestion {
  label: string;
  kind: CompletionKind;
  detail: string;
}

export interface CompletionRequest {
  source: string;
  /** 1-based line of the cursor. */
  line: number;
  /** 0-based character offset of the cursor within the line. */
  character: number;
  /** The assembled space, when the corpus assembles — path completion
   * reads its keys; null degrades to acts and layer names. */
  space: Space | null;
  /** The layer names in scope: the kernel's, plus the layers the
   * edited source itself declares. */
  layerNames: readonly string[];
  language?: Language;
}

const LAYER_ACTS: readonly string[] = ["layer"];
const BLOCK_ACTS: readonly string[] = ["extend", "override", "abstract", "bind", "check", "expect"];

const detailOf = ({ kind, language }: { kind: CompletionKind; language: Language }): string =>
  parseText({
    language,
    en: kind === "act" ? "act" : kind === "layer" ? "layer" : "key",
    fr: kind === "act" ? "acte" : kind === "layer" ? "couche" : "clé",
  });

const suggestion = ({
  label,
  kind,
  language,
}: {
  label: string;
  kind: CompletionKind;
  language: Language;
}): CompletionSuggestion => ({ label, kind, detail: detailOf({ kind, language }) });

const startsWith = ({ label, prefix }: { label: string; prefix: string }): boolean =>
  prefix === "" || label.startsWith(prefix);

// The note keys (`__note:key`) are internal data of the compilation —
// never proposed as completions.
const visibleKeys = ({ keys }: { keys: string[] }): string[] => keys.filter((key) => !key.startsWith("__note:"));

// Layer declarations are read by a line scan, not by the parser: the
// cursor usually sits on a half-written line the parser would refuse,
// and completion must stay total on exactly those texts.
const LAYER_DECLARATION = /^layer\s+([A-Za-z0-9_.-]+)/;

const layerDeclarations = ({ source }: { source: string }): { name: string; line: number }[] => {
  const declarations: { name: string; line: number }[] = [];
  source.split("\n").forEach((text, index) => {
    const match = LAYER_DECLARATION.exec(text);
    if (match !== null) declarations.push({ name: match[1], line: index + 1 });
  });
  return declarations;
};

/** The layer whose block contains the given line, from the edited
 * source — the `expect` paths read inside it. */
const layerAtLine = ({ source, line }: { source: string; line: number }): string | null => {
  let found: string | null = null;
  for (const declaration of layerDeclarations({ source })) {
    if (declaration.line <= line) found = declaration.name;
    else break;
  }
  return found;
};

export function completeLanguage({
  source,
  line,
  character,
  space,
  layerNames,
  language = DEFAULT_LANGUAGE,
}: CompletionRequest): CompletionSuggestion[] {
  const lines = source.split("\n");
  const lineIndex = Math.min(Math.max(line - 1, 0), lines.length - 1);
  const text = lines[lineIndex] ?? "";
  const prefix = text.slice(0, Math.min(Math.max(character, 0), text.length));

  const allLayerNames = [...new Set([...layerNames, ...layerDeclarations({ source }).map((declaration) => declaration.name)])];

  // ---- `@…` — a reference: layers, then path segments
  const referenceMatch = /@([A-Za-z0-9_./-]*)$/.exec(prefix);
  if (referenceMatch !== null) {
    const typed = referenceMatch[1];
    if (!typed.includes("/")) {
      return allLayerNames
        .filter((name) => startsWith({ label: name, prefix: typed }))
        .map((name) => suggestion({ label: name, kind: "layer", language }));
    }
    if (space === null) return [];
    const segments = typed.split("/");
    const anchor = segments[0];
    const pathPrefix = segments.slice(1, -1);
    const lastSegment = segments[segments.length - 1];
    return visibleKeys({ keys: space.keys({ layer: asLayerName(anchor), path: asLayerPath(pathPrefix) }) })
      .filter((key) => startsWith({ label: key, prefix: lastSegment }))
      .map((key) => suggestion({ label: key, kind: "key", language }));
  }

  // ---- `refines` / `then` — the parents are layer references
  const refinesMatch = /(?:^|\s)(?:refines|then)\s+@?([A-Za-z0-9_.-]*)$/.exec(prefix);
  if (refinesMatch !== null) {
    const typed = refinesMatch[1];
    return allLayerNames
      .filter((name) => startsWith({ label: name, prefix: typed }))
      .map((name) => suggestion({ label: name, kind: "layer", language }));
  }

  // ---- `expect …` — the keys of the current layer at the typed path
  const expectMatch = /(?:^|\s)expect\s+([A-Za-z0-9_./-]*)$/.exec(prefix);
  if (expectMatch !== null) {
    if (space === null) return [];
    const layer = layerAtLine({ source, line: lineIndex + 1 });
    if (layer === null) return [];
    const typed = expectMatch[1];
    const segments = typed.split("/");
    // The last segment is the one being typed — the path prefix is
    // everything before it (an empty last segment means the cursor
    // sits right after a "/").
    const pathPrefix = segments.slice(0, -1);
    const lastSegment = segments[segments.length - 1];
    return visibleKeys({ keys: space.keys({ layer: asLayerName(layer), path: asLayerPath(pathPrefix) }) })
      .filter((key) => startsWith({ label: key, prefix: lastSegment }))
      .map((key) => suggestion({ label: key, kind: "key", language }));
  }

  // ---- anywhere else — the acts of the current block
  const margin = /^ */.exec(text)?.[0].length ?? 0;
  const word = /[A-Za-z0-9_.-]*$/.exec(prefix)?.[0] ?? "";
  const labels = margin === 0 ? LAYER_ACTS : [...BLOCK_ACTS, ...SPECIAL_KEYS];
  return labels
    .filter((label) => startsWith({ label, prefix: word }))
    .map((label) =>
      suggestion({ label, kind: BLOCK_ACTS.includes(label) || LAYER_ACTS.includes(label) ? "act" : "key", language }),
    );
}
