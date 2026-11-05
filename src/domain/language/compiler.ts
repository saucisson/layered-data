// The layer language: compiler.
//
// The compilation produces the exact dictionaries the kernel expects
// — insertion order preserved (bindings/checks take the place of
// their first act), never a parallel semantics. Where written names
// become domain identifiers, the nominal brands are acquired here:
// this file is the parse boundary of the whole space.

import { type LayerName, asLayerName, asLayerPath, asPathSegment } from "../identifiers.ts";
import { LayerReference, MASK, PathReference, type RawTree, isDictionary,  } from "../addresses.ts";
import { SPECIAL_KEYS } from "../specialKeys.ts";
import { type LanguageAct, type LanguageLayer, type LanguageValue } from "./parser.ts";

/** One declared act of the language, indexed for the shadow
 * confrontation: (layer, path, key) → declared mode. */
export interface Declaration {
  layer: LayerName;
  path: string[];
  key: string;
  mode: string;
}

export interface CompiledLanguage {
  /** The layer trees, ready for the space constructor. */
  layers: Record<string, RawTree>;
  /** The declaration table of the whole compilation. */
  declarations: Declaration[];
}

// ---- written values → kernel values -----------------------------------

const makeReference = (value: LanguageValue & { kind: "reference" }): any =>
  value.referenceClass === "LR"
    ? new LayerReference(asLayerName(value.segments[0]))
    : new PathReference(asLayerName(value.segments[0]), asLayerPath(value.segments.slice(1)));

const makeValue = (value: LanguageValue): any => {
  if (value.kind === "literal") return value.value;
  if (value.kind === "reference") return makeReference(value);
  return value.items.map(makeValue);
};

// The comment becomes DATA — each written line arrives with its raw
// margin, the compilation restores it at the block margin (+ 2), line
// ending included; the note of a layer lives under the special key
// "note" (always set: [""], the layer is never mute), the note of an
// act under the visible key "__note:key", just before the key it
// documents.
const makeNote = (rawLines: string[]): string[] => rawLines.map((line) => "  " + line + "\n");

const noteKeyOfAct = (act: LanguageAct): string =>
  act.kind === "bind"
    ? act.slot
    : act.kind === "check"
      ? act.labels[0]
      : act.kind === "check-definition"
        ? act.name
        : act.key;

// ---- the emission -----------------------------------------------------

const emit = (
  acts: LanguageAct[],
  output: RawTree,
  layer: LayerName,
  path: string[],
  layerRoot: RawTree,
  declarations: Declaration[],
): void => {
  for (const act of acts) {
    if (act.notes) output["__note:" + noteKeyOfAct(act)] = makeNote(act.notes);
    if (act.kind === "bind") {
      if (!("bindings" in output)) output.bindings = {} as RawTree;
      (output.bindings as RawTree)[act.slot] = makeValue(act.value);
      continue;
    }
    if (act.kind === "check") {
      output.checks = act.labels;
      continue;
    }
    // The definition (ADR-0022): a couple lands in the INTERNAL
    // check-definitions container — the only door into it, never a
    // writable key of the language — and the name lands among the
    // check tags: defining a check is also posing it. The container
    // accumulates: the emit never replaces an existing couple (the
    // doublon rule is judged at validation, canonically).
    if (act.kind === "check-definition") {
      if (!Array.isArray(output.checks)) output.checks = [];
      (output.checks as string[]).push(act.name);
      if (!isDictionary(output["check-definitions"])) output["check-definitions"] = {};
      const couple: RawTree = { level: act.level };
      if (act.condition !== null) couple.condition = act.condition;
      couple.judgments = act.judgments.map((judgment) => {
        const entry: RawTree = {};
        if (judgment.when !== null) entry.when = judgment.when;
        entry.formula = judgment.formula;
        entry.message = judgment.message;
        return entry;
      });
      (output["check-definitions"] as RawTree)[act.name] = couple;
      continue;
    }
    // The expectation compiles into data of the "tests" dict — the
    // address (path/key, slash-joined) is the key, the expected
    // value the value; "absent" compiles to null — the "tests" dict
    // is interpreted by the expectation evaluator only, never as a
    // member.
    if (act.kind === "expect") {
      // The contract lives at the ROOT of the layer, even written
      // inside a block — the writing stores it under "tests", the
      // validation replays it layer by layer.
      if (!isDictionary(layerRoot.tests)) layerRoot.tests = {};
      (layerRoot.tests as RawTree)[act.path.concat(act.key).join("/")] =
        act.value === null ? null : makeValue(act.value);
      continue;
    }
    if (act.kind === "mask") {
      output[act.key] = MASK;
      declarations.push({ layer, path, key: act.key, mode: "mask" });
      continue;
    }
    // The assume lays NOTHING in the tree — no data, no special
    // key, the kernel's reading semantics are untouched. It lives
    // only in the declaration table: mode "assume" at (layer, path,
    // key), read by the lint (the signed conflict stays silent), the
    // validation (an assume without a conflict is a ghost) and the
    // strict staging (a signed conflict never refuses).
    if (act.kind === "assume") {
      declarations.push({ layer, path, key: act.key, mode: "assume" });
      continue;
    }
    declarations.push({ layer, path, key: act.key, mode: act.mode });
    if (act.block !== null) {
      const childNode: RawTree = {};
      if (act.refines) childNode.refines = act.refines.map((reference) => makeReference(reference as LanguageValue & { kind: "reference" }));
      output[act.key] = childNode;
      emit(act.block, childNode, layer, [...path, act.key], layerRoot, declarations);
    } else {
      output[act.key] = act.value !== null ? makeValue(act.value) : null;
    }
  }
};

export function compileLanguage(layers: LanguageLayer[]): CompiledLanguage {
  const layerTrees: Record<string, RawTree> = {};
  const declarations: Declaration[] = [];
  for (const layer of layers) {
    const node: RawTree = {};
    node.note = ["", ...makeNote(layer.notes ?? [])];
    if (layer.refines) {
      node.refines = layer.refines.map((reference) =>
        makeReference(reference as LanguageValue & { kind: "reference" }),
      );
    }
    layerTrees[layer.name] = node;
    emit(layer.acts, node, asLayerName(layer.name), [], node, declarations);
  }
  // Citations expand at compilation time — the rendered space knows
  // only fully written layers; the generated declarations (new for
  // the qualified member, override for each re-anchored reference)
  // fall into the same table as the acts of the writing.
  const expandedTrees = expandCitations(layerTrees, declarations);
  return { layers: expandedTrees, declarations };
}

// ---- citation expansion -----------------------------------------------

// A CITING layer cites its template — five citations in a
// collection, one UNION EQUATION per container (its refines cites
// the windows: philosophers, philosopherN, container).
// expandCitations is the reader of these equations: each cited
// window is expanded — the members of the template land QUALIFIED
// (philo1.think1…), each generated member refines the cited member
// BY ITS PATH (the data stays in the template; marking, identifier
// and types descend by closure) and the internal references of the
// cited member land anchored on the citing layer, designated key
// qualified — the generated arc points into the citing layer, never
// into the template. Every generated key is declared: the shadow
// confrontation recognizes it as an act of the language, not as an
// execution event. Idempotent: the equation is consumed (the
// reference leaves the list), an already-expanded space never
// expands again — the closure never sees the same window twice.
export function expandCitations(
  layerTrees: Record<string, RawTree>,
  declarations: Declaration[],
): Record<string, RawTree> {
  // A citation: a dict whose refines is a single layer reference,
  // with the identifier set — the cited piece is the window
  // designated by the path that follows.
  const citationTemplateOf = (node: any): string | null => {
    if (!isDictionary(node) || !Array.isArray(node["refines"])) return null;
    const refinements = node["refines"];
    if (refinements.length !== 1 || !(refinements[0] instanceof LayerReference)) return null;
    return node["identifier"] !== null && node["identifier"] !== undefined
      ? refinements[0].layer
      : null;
  };
  let changed = true;
  let guard = 0;
  // Generated members are finite: their refines cross a citation
  // without being equations — the expansion never replays on them.
  const generatedNodes = new Set<string>();
  while (changed && guard++ < 8) {
    changed = false;
    for (const layerName of Object.keys(layerTrees)) {
      const walk = (node: any, path: string[]): void => {
        if (!isDictionary(node)) return;
        if (Array.isArray(node["refines"]) && !generatedNodes.has(layerName + "::" + path.join("/"))) {
          const kept: any[] = [];
          for (const entry of node["refines"]) {
            if (!(entry instanceof PathReference) || entry.path.length === 0) {
              kept.push(entry);
              continue;
            }
            // Does the path cross a citation? The window lives in
            // the template, not in the citation.
            let citationKey = "";
            let template: string | null = null;
            let cut = -1;
            let current: any = layerTrees[entry.anchor];
            for (let index = 0; index < entry.path.length; index++) {
              if (!isDictionary(current)) {
                current = undefined;
                break;
              }
              current = current[entry.path[index]];
              if (current === undefined) break;
              if (index + 1 < entry.path.length) {
                const templateOfTraversal = citationTemplateOf(current);
                if (templateOfTraversal !== null) {
                  citationKey = entry.path[index];
                  template = templateOfTraversal;
                  cut = index;
                  break;
                }
              }
            }
            if (template === null || cut < 0) {
              kept.push(entry);
              continue;
            }
            const windowPath = entry.path.slice(cut + 1);
            let window: any = layerTrees[template];
            for (const segment of windowPath) {
              if (!isDictionary(window)) {
                window = undefined;
                break;
              }
              window = window[segment];
            }
            // Window not found: the reference stays as written — the
            // closure will tell its silence, the expansion never lies.
            if (!isDictionary(window)) {
              kept.push(entry);
              continue;
            }
            // An equation UNIONIZES MEMBERS — only the dict keys of
            // the window land qualified; a window of scalar data is
            // not a union, the reference travels whole: the closure
            // will read it late, through the citation.
            const members = Object.keys(window).filter(
              (memberKey) =>
                !(SPECIAL_KEYS as readonly string[]).includes(memberKey) &&
                !memberKey.startsWith("__note:") &&
                isDictionary(window[memberKey]),
            );
            if (members.length === 0) {
              kept.push(entry);
              continue;
            }
            for (const memberKey of members) {
              const generatedKey = citationKey + "." + memberKey;
              // Already set by hand: the writing wins.
              if (generatedKey in node) continue;
              const member = window[memberKey];
              // The generated member refines the cited member BY ITS
              // PATH: the anchor is the citing layer, the path
              // CROSSES the citation — the closure of the citation
              // link contains the template (its layer reference),
              // the read finds the window there; the data stays in
              // the template, marking and identifier descend by
              // closure.
              const generated: RawTree = {
                refines: [new PathReference(entry.anchor, asLayerPath([...entry.path.slice(0, cut + 1), ...windowPath, asPathSegment(memberKey)]))],
              };
              if (isDictionary(member)) {
                for (const memberField of Object.keys(member)) {
                  if (memberField === "refines") continue;
                  const value = member[memberField];
                  if (value instanceof PathReference && value.anchor === template && value.path.length > 0) {
                    generated[memberField] = new PathReference(asLayerName(layerName), asLayerPath([
                      ...value.path.slice(0, -1),
                      asPathSegment(citationKey + "." + value.path[value.path.length - 1]),
                    ]));
                    declarations.push({
                      layer: asLayerName(layerName),
                      path: [...path, generatedKey],
                      key: memberField,
                      mode: "override",
                    });
                  }
                }
              }
              node[generatedKey] = generated;
              generatedNodes.add(layerName + "::" + [...path, generatedKey].join("/"));
              declarations.push({ layer: asLayerName(layerName), path, key: generatedKey, mode: "new" });
              changed = true;
            }
          }
          node["refines"] = kept;
        }
        for (const key of Object.keys(node)) {
          if (key === "refines" || key.startsWith("__note:")) continue;
          if (isDictionary(node[key])) walk(node[key], [...path, key]);
        }
      };
      walk(layerTrees[layerName], []);
    }
  }
  return layerTrees;
}
