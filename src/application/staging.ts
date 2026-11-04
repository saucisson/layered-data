// The staging pass: judging a draft layer before it enters the
// living space — analysis, compilation, one token space, one
// verdict. Wherever a verdict is, the addition is refused.
//
// Also here: the act of addition (the compiled nodes enter the
// living space — the only sanctioned mutation of the kernel, the
// staged corpus remains whole) and the deterministic assistant
// proposal (no network, no key, no randomness).

import { type LayerName, asLayerName } from "../domain/identifiers.ts";
import { LayerReference, type RawValue } from "../domain/addresses.ts";
import { Space } from "../domain/space.ts";
import { type ParsedLanguage, parseLanguage } from "../domain/language/parser.ts";
import { type CompiledLanguage, compileLanguage } from "../domain/language/compiler.ts";
import { type ValidationOutcome, validateSpace } from "../domain/validation.ts";
import { DEFAULT_LANGUAGE, fact, parseText, type Language } from "../domain/messages.ts";

/** The staging verdict of a draft: which step refused (syntax or
 * validation), with the full detail. `ok` false anywhere = the
 * addition is refused. */
export interface StagingOutcome {
  ok: boolean;
  step: "syntaxe" | "validation";
  errors: string[];
  verdicts: ValidationOutcome["verdicts"];
  layerNames: LayerName[];
  compiledLanguage: CompiledLanguage | null;
  /** the draft block of each new layer, for the source panel */
  blocks: Record<string, string>;
}

/** Extract the source block of one layer from a layer source text:
 * from the `layer name` line to the last indented line (the next
 * margin line closes it). Inter-layer comments (column 0) stay out,
 * indented comments stay in. A `layer` word inside a comment never
 * counts. Returns null when the layer is absent. */
export function extractLayerBlock({ name, source }: { name: string; source: string }): string | null {
  const lines = source.split("\n");
  let start = -1;
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index];
    if (line.startsWith("layer ") && line.slice(6).trim().split(/\s+/)[0] === name) {
      start = index;
      break;
    }
  }
  if (start < 0) return null;
  let end = start;
  for (let index = start + 1; index < lines.length; index++) {
    const line = lines[index];
    // the block ends at the first margin line (an indented block can
    // contain comments at column 0 only between layers — they stay
    // out, indented comment lines stay in)
    if (line.length === 0 || line[0] === " " || line[0] === "\t") {
      if (line.trim().length > 0) end = index;
    } else {
      break;
    }
  }
  return lines.slice(start, end + 1).join("\n");
}

/** Stage a draft layer: analyze + compile + one token space over
 * corpus + previous additions + draft; any verdict anywhere refuses.
 * The parser exception becomes a readable refusal — the composer
 * never dies of a typo (same discipline as the kernel: total, never
 * an exception towards the UI). */
export function stageLayerAddition({
  languageSource,
  previousAdditionSources,
  draftSource,
  livingLayerNames,
  language = DEFAULT_LANGUAGE,
}: {
  languageSource: string;
  previousAdditionSources: string[];
  draftSource: string;
  /** the layers the living space already holds — a draft layer of
   * the same name is neither re-judged nor re-added */
  livingLayerNames: readonly string[];
  /** the workshop language — the syntax errors of the refusal speak
   * it; verdicts stay facts, rendered by the panels */
  language?: Language;
}): StagingOutcome {
  const source = [languageSource, ...previousAdditionSources, draftSource.trim()].join("\n") + "\n";

  // ---- syntax step ----
  let parsed: ParsedLanguage;
  try {
    parsed = parseLanguage(source, language);
  } catch (error) {
    const message = (error && (error as Error).message) || String(error);
    return {
      ok: false,
      step: "syntaxe",
      errors: [parseText({ language, en: "syntax: " + message, fr: "syntaxe : " + message })],
      verdicts: [],
      layerNames: [],
      compiledLanguage: null,
      blocks: {},
    };
  }
  if (parsed.errors.length > 0) {
    return {
      ok: false,
      step: "syntaxe",
      errors: parsed.errors,
      verdicts: [],
      layerNames: [],
      compiledLanguage: null,
      blocks: {},
    };
  }

  // ---- validation step: one token space over the whole staging
  // text; the draft layers are the ones under judgment ----
  const compiledLanguage = compileLanguage(parsed.layers);
  const layerNames = parsed.layers.map((parsedLayer) => asLayerName(parsedLayer.name));
  const draftText = draftSource.trim();
  const blocks: Record<string, string> = {};
  const orphanVerdicts: ValidationOutcome["verdicts"] = [];

  for (const layerName of layerNames) {
    // only layers new to the living space are judged and blocked —
    // the loaded corpus keeps its own frozen verdicts
    if (livingLayerNames.includes(layerName)) continue;
    // the target of a refinement must exist in the assembly — a
    // phantom parent would break the graph of panel ① (the empty
    // position does not exist), the staging refuses it
    const layerTree = compiledLanguage.layers[layerName];
    for (const entry of (layerTree?.["refines"] ?? []) as RawValue[]) {
      if (entry instanceof LayerReference && !(entry.layer in compiledLanguage.layers)) {
        orphanVerdicts.push({
          kind: "cible-inconnue",
          fact: fact("unknown-target", { layer: layerName, target: entry.layer }),
        });
      }
    }
    blocks[layerName] = extractLayerBlock({ name: layerName, source: draftText }) ?? "";
  }

  const space = new Space(compiledLanguage.layers);
  const validation = validateSpace({
    space,
    parse: parsed,
    compilation: compiledLanguage,
    layerNames,
  });
  const verdicts = [...validation.verdicts, ...orphanVerdicts];

  return {
    ok: verdicts.length === 0,
    step: "validation",
    errors: [],
    verdicts,
    layerNames,
    compiledLanguage,
    blocks,
  };
}

/** What the workshop must know about the layers that just entered
 * the living space: their names (in order) and, for each, the
 * refinement targets it declares. */
export interface AppliedAddition {
  newLayerNames: LayerName[];
  refinementTargetsOf: Record<string, string[]>;
}

/** The act of addition: the compiled nodes of the staged new layers
 * enter the living space. The structures of the graph panel
 * (refinements, children, ranks, parents, roles) extend — the ranks
 * and nodes of the loaded corpus stay frozen, only the living
 * inventory grows. Returns what the workshop needs to extend its
 * own tables. */
export function applyStagedAddition({
  space,
  staging,
  knownLayerNames,
}: {
  space: Space;
  staging: StagingOutcome;
  knownLayerNames: readonly string[];
}): AppliedAddition {
  const newLayerNames: LayerName[] = [];
  const refinementTargetsOf: Record<string, string[]> = {};

  // ---- the staged nodes enter the living space ----
  // A refinement target counts only if it is already known (corpus
  // or previously applied) — a self- or forward-reference within the
  // same draft does not found a graph position
  const processedLayerNames: string[] = [];
  for (const layerName of staging.layerNames) {
    if (knownLayerNames.includes(layerName)) continue;
    processedLayerNames.push(layerName);
    newLayerNames.push(layerName);
    space.layers[layerName] = staging.compiledLanguage!.layers[layerName];
    const layerTree = space.layers[layerName];
    refinementTargetsOf[layerName] = ((layerTree?.["refines"] ?? []) as RawValue[])
      .filter((entry): entry is LayerReference => entry instanceof LayerReference)
      .map((entry) => entry.layer)
      .filter(
        (parent: string) =>
          knownLayerNames.includes(parent) || processedLayerNames.slice(0, -1).includes(parent),
      );
  }

  return { newLayerNames, refinementTargetsOf };
}

/** The simulated assistant: the degraded stream of the canvas — no
 * network, no key, no randomness; one deterministic proposal on the
 * idiom of the corpus (the edge annotation, mirror of
 * weighted-hypergraph: type-level default, abstract slot in the
 * record) — the staging will judge it like any quill. */
export function simulatedAssistantProposal({
  intention,
  language = DEFAULT_LANGUAGE,
}: {
  intention: string;
  language?: Language;
}): string {
  const rawName = intention
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const name = rawName ? rawName.slice(0, 24).replace(/-+$/, "") : "mon-axe";
  return [
    parseText({
      language,
      en: "// deterministic proposal — correct the pen freely,",
      fr: "// proposition déterministe — corrigez la plume librement,",
    }),
    parseText({
      language,
      en: "// the staging will judge corpus + supplement, 0 verdict demanded",
      fr: "// le staging jugera corpus + supplément, 0 verdict exigé",
    }),
    "layer " + name + " refines @weighted-hypergraph then @graph",
    "  extend edge_type",
    "    charge = 1",
    "    extend specification",
    "      extend record",
    "        abstract charge",
  ].join("\n");
}
