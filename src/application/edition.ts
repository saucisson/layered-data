// The living edition use case: a living layer re-enters the
// tribunal. The edited layer leaves the living context (it is
// judged again, exactly like a draft), every other living layer
// stays as context — its declared expectations are replayed, a
// betrayed contract refuses the edition. An accepted edition
// replaces the layer's tree in place, then declares the write
// through the touch protocol: every memo entry that depends on the
// layer — its own and the children's, O18 — is invalidated, the
// panels re-read the space, the workshop reacts. The corpus stays
// read-only BY PROTOCOL (ADR-0020), not by UI convention: the
// route itself carries the trunk's signature and refuses to touch
// it — an edition aimed at a trunk layer is « tronc-édité », and
// the act of edition never writes a readonly name, whoever calls
// it. Only the layers added at runtime are editable.

import { type LayerName, asLayerName, asLayerPath } from "../domain/identifiers.ts";
import { LayerReference, type RawValue } from "../domain/addresses.ts";
import { type Space } from "../domain/space.ts";
import { extractLayerBlock, stageLayerAddition, type StagingOutcome } from "./staging.ts";
import { DEFAULT_LANGUAGE, type Language } from "../domain/messages.ts";

/** One living addition as the edition sees it: the source text of an
 * accepted ＋ addition and the layers it brought into the space. */
export interface LivingAddition {
  source: string;
  layerNames: string[];
}

/** The outcome of staging an edition: the tribunal's answer (same
 * verdict kinds as an addition, plus the edition guards) — `ok`
 * false anywhere = the edition is refused and the space stays
 * intact. */
/** The edition guards: an edition edits, it never renames a layer
 * nor adds one alongside — and it never aims at the trunk. Each
 * guard is a stable refusal code, rendered by the panels. */
export type EditionRefusalCode = "couche-renomme" | "couche-glissée" | "tronc-édité";

export interface EditionOutcome {
  ok: boolean;
  staging: StagingOutcome;
  /** the edition guards — empty when ok */
  refusals: EditionRefusalCode[];
}

/** What the workshop must know about an applied edition: the edited
 * layer, its declared refinement targets (the graph re-aims the
 * layer — they may have changed), and its new source block (for
 * the language tab and the wardrobe). */
export interface AppliedEdition {
  layerName: LayerName;
  refinementTargetsOf: string[];
  block: string;
}

/** The source of an addition without one of its layers: the other
 * layer blocks keep their place in the staging context, the edited
 * layer leaves it (it is judged as the draft). */
function additionSourceWithoutLayer({
  addition,
  layerName,
}: {
  addition: LivingAddition;
  layerName: LayerName;
}): string {
  return addition.layerNames
    .filter((name) => name !== layerName)
    .map((name) => extractLayerBlock({ name, source: addition.source }) ?? "")
    .filter((block) => block.length > 0)
    .join("\n");
}

/** Judge the edited source of one living layer: same tribunal, same
 * verdicts as an addition — the edited layer alone is the draft,
 * the corpus and the other living additions are re-validated whole.
 * Two edition guards complete the tribunal: the draft must still
 * declare the edited layer (a renamed or vanished layer is
 * refused), and it must declare it alone (a layer smuggled
 * alongside the edition is refused — an edition edits, it never
 * adds nor renames). */
export function stageLayerEdition({
  languageSource,
  livingAdditions,
  livingLayerNames,
  readonlyLayerNames,
  layerName,
  editedSource,
  language = DEFAULT_LANGUAGE,
}: {
  languageSource: string;
  livingAdditions: readonly LivingAddition[];
  livingLayerNames: readonly string[];
  /** the trunk's signature (ADR-0020): the layers this route
   * refuses to touch — an edition aimed at one of them is refused
   * as « tronc-édité », before the tribunal is even convened (the
   * trunk layer would leave the context and be judged as a draft —
   * measured: the guard used to be missing, `record` was mutable
   * in place) */
  readonlyLayerNames: readonly string[];
  layerName: LayerName;
  editedSource: string;
  /** the workshop language — the syntax errors of the refusal speak it */
  language?: Language;
}): EditionOutcome {
  // ---- the trunk guard (ADR-0020): the refusal speaks before the
  // tribunal is convened — a trunk layer never re-enters it, the
  // frozen verdicts of the corpus stay true
  if (readonlyLayerNames.includes(layerName)) {
    return {
      ok: false,
      staging: {
        ok: false,
        step: "validation",
        errors: [],
        verdicts: [],
        layerNames: [layerName],
        compiledLanguage: null,
        blocks: {},
      },
      refusals: ["tronc-édité"],
    };
  }
  // the staging context: every living addition keeps its place,
  // except the edited layer — it leaves its own addition's source
  // and the living names, the tribunal judges it again
  const previousAdditionSources = livingAdditions.map((addition) =>
    addition.layerNames.includes(layerName)
      ? additionSourceWithoutLayer({ addition, layerName })
      : addition.source,
  );
  const contextLayerNames = livingLayerNames.filter((name) => name !== layerName);
  const staging = stageLayerAddition({
    languageSource,
    previousAdditionSources,
    draftSource: editedSource.trim(),
    livingLayerNames: contextLayerNames,
    readonlyLayerNames,
    language,
  });

  // ---- the edition guards ----
  // The guards read the declared layer names — they speak only
  // when the syntax step passed (on a syntax refusal, the parser
  // never names layers, the errors speak alone). The layers under
  // judgment are the ones the living context does not hold:
  // exactly the edited one must appear there, alone.
  const refusals: EditionRefusalCode[] = [];
  if (staging.compiledLanguage !== null) {
    const judgedLayerNames = staging.layerNames.filter(
      (name) => !contextLayerNames.includes(name),
    );
    if (!judgedLayerNames.some((name) => name === layerName)) {
      refusals.push("couche-renomme");
    }
    if (judgedLayerNames.some((name) => name !== layerName)) {
      refusals.push("couche-glissée");
    }
  }
  return { ok: staging.ok && refusals.length === 0, staging, refusals };
}

/** The act of edition: the staged tree replaces the layer's tree in
 * place, then the write is declared — `touch` over the whole layer
 * invalidates every memo entry whose dependency lives there (the
 * layer's own entries and the children's, O18). Without the
 * touch, the memoized closures would keep serving the old chain
 * silently — the protocol is what keeps the living space honest.
 * Precondition: a staging the guards accepted (`EditionOutcome.ok`
 * true). */
export function applyStagedEdition({
  space,
  layerName,
  staging,
  readonlyLayerNames,
}: {
  space: Space;
  layerName: LayerName;
  staging: StagingOutcome;
  /** the trunk's signature (ADR-0020): the act of edition itself
   * refuses to write a readonly name — the staged tree stays out,
   * the space stays intact, whoever calls the route */
  readonlyLayerNames: readonly string[];
}): AppliedEdition {
  if (readonlyLayerNames.includes(layerName)) {
    return { layerName, refinementTargetsOf: [], block: "" };
  }
  const compiledTree = staging.compiledLanguage?.layers[layerName];
  if (!compiledTree) {
    return { layerName, refinementTargetsOf: [], block: "" };
  }
  space.layers[layerName] = compiledTree;
  space.touch({ layer: layerName, path: asLayerPath([]) });
  const refinementTargetsOf = ((compiledTree["refines"] ?? []) as RawValue[])
    .filter((entry): entry is LayerReference => entry instanceof LayerReference)
    .map((entry) => entry.layer);
  return {
    layerName,
    refinementTargetsOf,
    block: staging.blocks[layerName] ?? "",
  };
}

/** Rewrite a living addition after an accepted edition: the edited
 * layer's block is replaced in place, the other layers of the
 * addition keep their blocks — the next stagings judge the edited
 * truth, never a stale copy. */
export function rewriteLivingAddition({
  addition,
  layerName,
  block,
}: {
  addition: LivingAddition;
  layerName: LayerName;
  block: string;
}): LivingAddition {
  if (!addition.layerNames.includes(layerName)) return addition;
  const source = addition.layerNames
    .map((name) =>
      name === layerName
        ? block
        : extractLayerBlock({ name, source: addition.source }) ?? "",
    )
    .filter((kept) => kept.length > 0)
    .join("\n");
  return { source, layerNames: [...addition.layerNames] };
}

/** The current editable block of a living layer, as the editor
 * opens it: the block the workshop kept, or the block extracted
 * from the owning addition's source. */
export function livingLayerBlock({
  layerName,
  keptBlocks,
  livingAdditions,
}: {
  layerName: LayerName;
  keptBlocks: Record<string, string>;
  livingAdditions: readonly LivingAddition[];
}): string {
  if (keptBlocks[layerName]) return keptBlocks[layerName];
  for (const addition of livingAdditions) {
    if (!addition.layerNames.includes(layerName)) continue;
    return extractLayerBlock({ name: layerName, source: addition.source }) ?? "";
  }
  return "";
}

/** The names of the editable living layers: those added at runtime
 * — the corpus stays read-only, its ranks frozen. */
export function editableLayerNames({
  livingLayerNames,
  readonlyLayerNames,
}: {
  livingLayerNames: readonly string[];
  readonlyLayerNames: readonly string[];
}): LayerName[] {
  return livingLayerNames
    .filter((name) => !readonlyLayerNames.includes(name))
    .map((name) => asLayerName(name));
}
