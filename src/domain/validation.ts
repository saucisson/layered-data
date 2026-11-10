// Assembly validation: the pass that precedes every execution.
//
// Every diagnostic becomes a VERDICT before execution: (a) every
// declared act against the closure of its node (implicit override,
// phantom declaration), (b) every check tag against the registry —
// the data of the check-registry layer since ADR-0102,
// (b2) the vacant checks — a check carried but unable to judge,
// its required slots unbound (ADR-0101),
// (c) every binding at the level where its check reads it (the trap:
// an instance-level slot bound at a root is dead for every reading
// layer that descends from it), (d) the shadow confrontation: every
// first-winner that overrides must have declared it, (e) the
// expected-reads contract replays — a betrayed read, wherever it
// lives, is a verdict, (f) the check couples — a divergent
// re-pose, an unsupported level, an unreadable formula, a template
// out of its judgment's quantified scope (ADR-0105).
//
// The verdict KINDS and the stat KEYS are kernel behavior — the panels
// display them — they stay in French. Everything here is pure: the
// space, the parse, the compilation and the layer list arrive as
// parameters, so staging can validate a whole assembly (corpus +
// supplements + candidate) without touching the loaded globals.

import { type LayerName, type LayerPath, asLayerName } from "./identifiers.ts";
import { AddressView, LayerReference, PathReference, type RawValue, isDictionary } from "./addresses.ts";
import { Space } from "./space.ts";
import {
  type CheckContract,
  canonicalCoupleOf,
  checkCoupleOfRecord,
  registryContractsOf,
  slotReadingLevelsOf,
  vacantChecksOf,
} from "./checks.ts";
import { quantifiedVariablesOf, templateTermsOf, tryParseFormula } from "./formulas.ts";
import { walkLayerObserved, type WalkedAddress } from "./views.ts";
import { type CompiledLanguage, type Declaration } from "./language/compiler.ts";
import { type ParsedLanguage } from "./language/parser.ts";
import { fact, type MessageFact } from "./messages.ts";

export interface Verdict {
  kind: string;
  fact: MessageFact;
}

export interface ValidationOutcome {
  verdicts: Verdict[];
  stats: Record<string, number>;
}

// The slot contracts of the check tags: for each tag, its slots and
// their READING LEVEL — root (layer check) or instance (arc check:
// the type is in the arc's closure). A type-level binding posed at a
// root (silently vacant check) is unwritable there. Derived from the
// registry's contracts — one source since ADR-0102: the contracts
// the DATA declares, read from the `check-registry` layer.
export function checkSlotContractsOf(
  contracts: Record<string, CheckContract>,
): Record<string, Record<string, "root" | "instance">> {
  return Object.fromEntries(Object.entries(contracts).map(([tag, contract]) => [tag, slotReadingLevelsOf(contract)]));
}

/** Whether a layer carries an inline couple definition for a tag
 * (ADR-0105/0027): the tag is known through its formula, not through
 * a built-in contract. */
function layerHasCoupleDefinition({ space, layer, tag }: { space: Space; layer: LayerName; tag: string }): boolean {
  for (const [sourceLayer, sourcePath] of space.closure({ layer, path: [] })) {
    const node = space.raw({ layer: sourceLayer, path: sourcePath });
    if (isDictionary(node) && isDictionary(node["check-definitions"]) && tag in node["check-definitions"]) {
      return true;
    }
  }
  return false;
}

// The mode declared for (layer, path, key) — the shadow
// confrontation reads this table. The declaration table arrives as a
// parameter; the defaults are the loaded corpus.
export function declaredModeOf({
  layer,
  path,
  key,
  compilation,
}: {
  layer: LayerName;
  path: string[];
  key: string;
  compilation: { declarations: Declaration[] };
}): string | null {
  for (const declaration of compilation.declarations) {
    if (
      declaration.layer === layer &&
      declaration.key === key &&
      declaration.path.length === path.length &&
      declaration.path.every((segment, index) => segment === path[index])
    ) {
      return declaration.mode;
    }
  }
  return null;
}

// The expected-reads contract, carried by the special key "tests" —
// a dict {address (path/key): expectation} per layer. The address
// reads as (path, key); "absent" (null) requires the read to return
// null; a reference requires the exact resolved address; a list
// compares term by term. The contract does not sediment: each layer
// carries its own, the validation replays it.
export interface ExpectedRead {
  address: string;
  path: string[];
  key: string;
  expectation: RawValue;
}

export function expectationsOf(layerNode: any): ExpectedRead[] {
  if (!isDictionary(layerNode) || !isDictionary(layerNode["tests"])) return [];
  const expectations: ExpectedRead[] = [];
  for (const address of Object.keys(layerNode["tests"])) {
    if (address.startsWith("__note:")) continue;
    const segments = address.split("/");
    expectations.push({
      address,
      path: segments.slice(0, -1),
      key: segments[segments.length - 1],
      expectation: layerNode["tests"][address],
    });
  }
  return expectations;
}

export function readMatchesExpectation(read: any, expectation: any): boolean {
  if (expectation === null) return read === null;
  if (expectation instanceof LayerReference) {
    return read instanceof AddressView && read.layer === expectation.layer;
  }
  if (expectation instanceof PathReference) {
    return (
      read instanceof AddressView &&
      read.layer === expectation.anchor &&
      read.path.length === expectation.path.length &&
      expectation.path.every((segment, index) => segment === read.path[index])
    );
  }
  if (Array.isArray(expectation)) {
    return (
      Array.isArray(read) &&
      read.length === expectation.length &&
      expectation.every((item, index) => readMatchesExpectation(read[index], item))
    );
  }
  return read === expectation;
}

export function formatExpectation(value: any): string {
  if (value === null) return "null";
  if (value instanceof AddressView) {
    return "@" + value.layer + (value.path.length ? "/" + value.path.join("/") : "");
  }
  if (value instanceof LayerReference) return "@" + value.layer;
  if (value instanceof PathReference) {
    return "@" + value.anchor + (value.path.length ? "/" + value.path.join("/") : "");
  }
  if (typeof value === "string") return JSON.stringify(value);
  if (Array.isArray(value)) return "[" + value.map(formatExpectation).join(", ") + "]";
  return String(value);
}

export interface ValidationInput {
  space: Space;
  parse: ParsedLanguage;
  compilation: CompiledLanguage;
  layerNames: LayerName[];
  /** A persistent walk provider (a validation session): when given,
   * the observed walks come from the caller's cache — invalidation
   * is the CALLER's contract (space.isObservationStale). When
   * absent, one table is built for this validation only. The
   * verdicts and the stats are identical either way: the walks are
   * a pure observation of the space. */
  walkedOf?: (layer: LayerName) => WalkedAddress[];
}

/** One chunk of a streamed validation: the verdicts produced since
 * the previous chunk, the phase and the layer being judged, and the
 * progress within the phase. The chunks concatenated are exactly
 * the full validation's verdicts, in order (ADR-0108). */
export interface ValidationChunk {
  phase: string;
  layer: LayerName | null;
  verdicts: Verdict[];
  progress: { done: number; total: number };
}

/** The streamed validation: the same passes as validateSpace, but
 * yielding one chunk per judged unit (layer, declaration, vacancy),
 * so a caller can interleave the work with the event loop and show
 * progress. The generator's return value is the full outcome. */
export function* streamValidation({
  space,
  parse,
  compilation,
  layerNames,
  walkedOf = undefined,
}: ValidationInput): Generator<ValidationChunk, ValidationOutcome, void> {
  const verdicts: Verdict[] = [];
  let emittedVerdicts = 0;
  const emit = (phase: string, layer: LayerName | null, done: number, total: number): ValidationChunk => {
    const chunk: ValidationChunk = {
      phase,
      layer,
      verdicts: verdicts.slice(emittedVerdicts),
      progress: { done, total },
    };
    emittedVerdicts = verdicts.length;
    return chunk;
  };
  const stats: Record<string, number> = {
    couches: parse.layers.length,
    erreursSyntaxe: parse.errors.length,
    decl: compilation.declarations.length,
    nouveau: 0,
    extension: 0,
    surcharge: 0,
    declOK: 0,
    etiquettes: 0,
    ombresDeclarées: 0,
    ombresÉmergentes: 0,
    ombresBrutes: 0,
    tests: 0,
    trahis: 0,
    couples: 0,
  };
  // The declaration modes are three since ADR-0106: new, extend,
  // override — the gestures the ontology measured, nothing else.
  for (const declaration of compilation.declarations) {
    if (declaration.mode === "new") stats.nouveau++;
    else if (declaration.mode === "extend") stats.extension++;
    else stats.surcharge++;
  }

  // ---- the labels of each layer (closure of its root) and its
  // ancestry map — to know WHO reads a binding
  const labelsOf = new Map<string, Set<string>>();
  const ancestorsOf = new Map<string, Set<string>>();
  for (const layer of layerNames) {
    labelsOf.set(layer, new Set());
    ancestorsOf.set(layer, new Set());
  }

  // ---- the shared observed walk: one materialization per layer,
  // consumed by the labels pass, the vacant checks, the shadow
  // confrontation and the check couples. The passes judge the same
  // space — they share one observation of it, the walk (the
  // expensive part) is never repeated. A session may provide its
  // own persistent walks; the local table is the session-less
  // default.
  const walkedLayerTable = new Map<LayerName, WalkedAddress[]>();
  const localWalkedLayerOf = (layer: LayerName): WalkedAddress[] => {
    let walked = walkedLayerTable.get(layer);
    if (walked === undefined) {
      walked = walkLayerObserved({ space, layer });
      walkedLayerTable.set(layer, walked);
    }
    return walked;
  };
  const walkedLayerOf = walkedOf ?? localWalkedLayerOf;
  // The labels pass reads the root closures DIRECTLY (never through
  // the shared walk): the first closure computation of a layer is
  // observable — it records the resolution diagnostics — and the
  // recorded order is part of the audit's byte-identical dump.
  for (let layerIndex = 0; layerIndex < layerNames.length; layerIndex += 1) {
    const layer = layerNames[layerIndex];
    for (const [sourceLayer, sourcePath] of space.closure({ layer, path: [] })) {
      if (sourcePath.length === 0) ancestorsOf.get(layer)!.add(sourceLayer);
      const node = space.raw({ layer: sourceLayer, path: sourcePath });
      if (!isDictionary(node)) continue;
      const tags = node["checks"] ?? [];
      if (!Array.isArray(tags)) continue;
      for (const tag of tags) {
        if (typeof tag === "string") labelsOf.get(layer)!.add(tag);
      }
    }
    yield emit("étiquetage", layer, layerIndex + 1, layerNames.length);
  }

  // ---- (a) declarations against the closures
  for (let declarationIndex = 0; declarationIndex < compilation.declarations.length; declarationIndex += 1) {
    const declaration = compilation.declarations[declarationIndex];
    let existsUpstream = false;
    for (const [sourceLayer, sourcePath] of space.closure({ layer: declaration.layer, path: declaration.path as LayerPath })) {
      if (
        sourceLayer === declaration.layer &&
        sourcePath.length === declaration.path.length &&
        sourcePath.every((segment, index) => segment === declaration.path[index])
      ) {
        continue;
      }
      const node = space.raw({ layer: sourceLayer, path: sourcePath });
      if (isDictionary(node) && Object.prototype.hasOwnProperty.call(node, declaration.key)) {
        existsUpstream = true;
        break;
      }
    }
    const where = declaration.layer + "::" + (declaration.path.join("/") || ".");
    if (declaration.mode === "new" && existsUpstream) {
      verdicts.push({
        kind: "surcharge-implicite",
        fact: fact("implicit-overload", { where, key: declaration.key }),
      });
    } else if (declaration.mode !== "new" && !existsUpstream) {
      verdicts.push({
        kind: "déclaration-fantôme",
        fact: fact("ghost-declaration", { where, key: declaration.key, mode: declaration.mode }),
      });
    } else stats.declOK++;
    yield emit("déclarations", declaration.layer, declarationIndex + 1, compilation.declarations.length);
  }

  // ---- the contracts: built-in for the algorithmic tags (ADR-0109),
  // inline couples for the first-order ones (ADR-0105). A tag is known
  // if it has a built-in contract OR a readable couple definition.
  const contracts = registryContractsOf();
  const slotContracts = checkSlotContractsOf(contracts);

  // ---- (b) check tags against the registry
  for (let layerIndex = 0; layerIndex < layerNames.length; layerIndex += 1) {
    const layer = layerNames[layerIndex];
    for (const tag of labelsOf.get(layer)!) {
      const hasCouple = layerHasCoupleDefinition({ space, layer, tag });
      if (!contracts[tag] && !hasCouple) {
        verdicts.push({ kind: "étiquette-inconnue", fact: fact("unknown-label", { layer, tag }) });
      } else stats.etiquettes++;
    }
    yield emit("étiquettes", layer, layerIndex + 1, layerNames.length);
  }

  // ---- (b2) the vacant checks (ADR-0101): a check carried but
  // unable to judge — a required slot unbound at the address the
  // contract makes it judge. The verdict answers for the acts that
  // CAN answer: a local POSE (the tag carried at the very address —
  // the mirror of étiquette-inconnue, which refuses the posed tag
  // that does not exist), and the root-level
  // slots of the layer checks a layer's root carries. The instance
  // slots of an inherited check are the lint's inventory: the type
  // binds them, the root never sees it.
  const vacancies = vacantChecksOf({ space, layerNames, contracts, walkedOf: walkedLayerOf });
  for (let vacancyIndex = 0; vacancyIndex < vacancies.length; vacancyIndex += 1) {
    const vacancy = vacancies[vacancyIndex];
    if (vacancy.posed || (vacancy.level === "root" && vacancy.address[1].length === 0)) {
      const where = vacancy.address[0] + "::" + (vacancy.address[1].join("/") || ".");
      verdicts.push({
        kind: "check-vacant",
        fact: fact("vacant-slot", { where, tag: vacancy.tag, slot: vacancy.slot }),
      });
    }
    yield emit("checks-vacants", null, vacancyIndex + 1, vacancies.length);
  }

  // ---- (c) dead bindings: an instance-level slot bound at the root
  // of a layer L is unreadable for every tag of a reading layer that
  // descends from L (the type is in the arc's closure, the root never)
  for (let layerIndex = 0; layerIndex < layerNames.length; layerIndex += 1) {
    const layer = layerNames[layerIndex];
    const root = space.raw({ layer, path: [] });
    if (isDictionary(root) && isDictionary(root["bindings"])) {
      for (const slot of Object.keys(root["bindings"])) {
        for (const readingLayer of layerNames) {
          if (readingLayer === layer || !ancestorsOf.get(readingLayer)!.has(layer)) continue;
          for (const tag of labelsOf.get(readingLayer)!) {
            const contract = slotContracts[tag];
            if (contract && contract[slot] === "instance") {
              verdicts.push({
                kind: "liaison-morte",
                fact: fact("dead-binding", { layer, slot, tag, readingLayer }),
              });
            }
          }
        }
      }
    }
    yield emit("liaisons-mortes", layer, layerIndex + 1, layerNames.length);
  }

  // ---- (d) shadows against declarations — the same walk as the
  // diagnostics fallback, but judging
  for (let layerIndex = 0; layerIndex < layerNames.length; layerIndex += 1) {
    const layer = layerNames[layerIndex];
    for (const entry of walkedLayerOf(layer)) {
      const [addressLayer, addressPath] = entry.address;
      for (const key of entry.keys) {
        let winner: [string, string[]] | null = null;
        let providers = 0;
        for (let index = 0; index < entry.closure.length; index += 1) {
          const [sourceLayer, sourcePath] = entry.closure[index];
          const node = entry.nodes[index];
          if (isDictionary(node) && key in node && node[key] !== null) {
            providers += 1;
            if (winner === null) winner = [sourceLayer, sourcePath];
          }
        }
        if (providers > 1 && winner !== null) {
          // The shadow of a __note:key is judged on the declaration
          // of the documented act — the note travels with it, it
          // never declares itself alone.
          const declaredKey = key.startsWith("__note:") ? key.slice(7) : key;
          const mode = declaredModeOf({
            layer: asLayerName(winner[0]),
            path: winner[1],
            key: declaredKey,
            compilation,
          });
          if (mode === "extend" || mode === "override") {
            stats.ombresDeclarées++;
          } else if (mode === "new") {
            stats.ombresÉmergentes++;
          } else {
            stats.ombresBrutes++;
            verdicts.push({
              kind: "ombre-non-déclarée",
              fact: fact("undeclared-shadow", {
                layer: winner[0],
                path: winner[1].join("/") || ".",
                key,
              }),
            });
          }
        }
      }
    }
    yield emit("ombres", layer, layerIndex + 1, layerNames.length);
  }

  // ---- (e) the expected-reads contract replays — every layer of
  // the assembly carries its tests; the betrayed read is a verdict;
  // a candidate that breaks a scene (its own, or a redefined
  // layer's) is refused; the absent expectation compares to null, the
  // reference to the exact resolved address
  for (let layerIndex = 0; layerIndex < layerNames.length; layerIndex += 1) {
    const layer = layerNames[layerIndex];
    for (const expectation of expectationsOf(compilation.layers[layer])) {
      stats.tests++;
      let read: any;
      try {
        read = space.read({ layer, path: expectation.path as LayerPath, key: expectation.key });
      } catch {
        read = undefined;
      }
      if (!readMatchesExpectation(read, expectation.expectation)) {
        stats.trahis++;
        verdicts.push({
          kind: "attendu-trahi",
          fact: fact("expectation-betrayed", {
            layer,
            address: expectation.address,
            expected: formatExpectation(expectation.expectation),
            read: formatExpectation(read),
          }),
        });
      }
    }
    yield emit("tests", layer, layerIndex + 1, layerNames.length);
  }
  // ---- (f) the check couples (ADR-0105): the declarative strate is
  // data too — it is judged at assembly, never at execution. A couple
  // is never REPLACED: per name, per address, the sources of the
  // closure confront each other — a re-pose is tolerated only up to
  // the canonical identity (the renaming of quantified variables
  // aside, the ENTIRE couple: level, condition, judgments); a
  // divergent one is a verdict naming the culprit pose. Then the
  // winner is judged for readability: the level the reading judges
  // at (root, today — instance is the declared next strate), the
  // condition a judgment's « when » names, the formulas the
  // interpreter parses, and the message templates inside the
  // judgment's quantified scope — a couple the reading cannot read
  // is refused HERE, the execution never meets it.
  const redefinitions = new Set<string>(); // name|first|second — one verdict per confrontation, not per address
  for (let layerIndex = 0; layerIndex < layerNames.length; layerIndex += 1) {
    const layer = layerNames[layerIndex];
    for (const entry of walkedLayerOf(layer)) {
      const [addressLayer, addressPath] = entry.address;
      // per-address: only poses CO-VISIBLE at this address confront
      // each other — two sibling branches never meet (the geometry
      // of the refinement, the same the first-winner reads with)
      const firstPoseOf = new Map<string, { pose: string; canonical: string }>();
      for (let index = 0; index < entry.closure.length; index += 1) {
        const [sourceLayer, sourcePath] = entry.closure[index];
        const node = entry.nodes[index];
        if (!isDictionary(node) || !isDictionary(node["check-definitions"])) continue;
        for (const name of Object.keys(node["check-definitions"])) {
          if (name.startsWith("__note:")) continue;
          const pose = sourceLayer + "::" + (sourcePath.join("/") || ".");
          const read = checkCoupleOfRecord(node["check-definitions"][name]);
          if (read === null) continue;
          const canonical = canonicalCoupleOf({
            level: read.level === "root" || read.level === "instance" ? read.level : "root",
            condition: read.condition,
            judgments: read.judgments,
          });
          const first = firstPoseOf.get(name);
          if (first === undefined) {
            firstPoseOf.set(name, { pose, canonical });
            continue;
          }
          if (first.pose === pose || first.canonical === canonical) continue; // idempotence: the identical re-pose is tolerated
          // the closure reads specific-first: the earlier pose is the
          // DESCENDANT — the re-poser; the one read now is its
          // ancestor, the original definer. The verdict narrates the
          // genealogy: the definer first, THEN the divergent re-pose.
          const confrontation = name + "|" + pose + "|" + first.pose;
          if (redefinitions.has(confrontation)) continue;
          redefinitions.add(confrontation);
          verdicts.push({
            kind: "check-redéfini",
            fact: fact("redefined-check", { where: first.pose, name, first: pose, second: first.pose }),
          });
        }
      }
    }
    yield emit("couples", layer, layerIndex + 1, layerNames.length);
  }

  // the readability of each POSE (deduplicated by (source, path,
  // name)) — the winner anywhere is judged exactly once
  const judgedPoses = new Set<string>();
  for (let layerIndex = 0; layerIndex < layerNames.length; layerIndex += 1) {
    const layer = layerNames[layerIndex];
    for (const entry of walkedLayerOf(layer)) {
      const [addressLayer, addressPath] = entry.address;
      for (let index = 0; index < entry.closure.length; index += 1) {
        const [sourceLayer, sourcePath] = entry.closure[index];
        const node = entry.nodes[index];
        if (!isDictionary(node) || !isDictionary(node["check-definitions"])) continue;
        for (const name of Object.keys(node["check-definitions"])) {
          if (name.startsWith("__note:")) continue;
          const poseKey = sourceLayer + "|" + sourcePath.join("/") + "|" + name;
          if (judgedPoses.has(poseKey)) continue;
          const read = checkCoupleOfRecord(node["check-definitions"][name]);
          if (read === null) continue;
          judgedPoses.add(poseKey);
          stats.couples++;
          const where = sourceLayer + "::" + (sourcePath.join("/") || ".");
          if (read.level !== "root") {
            verdicts.push({
              kind: "niveau-non-soutenu",
              fact: fact("unsupported-level", { where, name, level: read.level }),
            });
          }
          for (const judgment of read.judgments) {
            if (judgment.when !== null && read.condition === null) {
              verdicts.push({
                kind: "condition-manquante",
                fact: fact("missing-condition", { where, name }),
              });
            }
            const parsed = tryParseFormula(judgment.formula);
            if (!("formula" in parsed)) {
              verdicts.push({
                kind: "formule-illisible",
                fact: fact("unreadable-formula", { tag: name, detail: parsed.error }),
              });
              continue;
            }
            const scope = quantifiedVariablesOf(parsed.formula);
            const templates = templateTermsOf(judgment.message);
            if (templates === null) {
              verdicts.push({
                kind: "formule-illisible",
                fact: fact("unreadable-formula", { tag: name, detail: "gabarit : « " + judgment.message + " »" }),
              });
              continue;
            }
            for (const template of templates) {
              if (!scope.includes(template.term.variable)) {
                verdicts.push({
                  kind: "gabarit-hors-de-portée",
                  fact: fact("template-out-of-scope", { where, name, term: template.term.variable + (template.term.segments.length ? "/" + template.term.segments.join("/") : "") }),
                });
              }
            }
          }
        }
      }
    }
    yield emit("lisibilité", layer, layerIndex + 1, layerNames.length);
  }
  return { verdicts, stats };
}

/** The API form of the validation: drain every chunk synchronously
 * and return the full outcome — exactly what validateSpace always
 * answered (ADR-0108). */
export function collectValidation(
  stream: Generator<ValidationChunk, ValidationOutcome, void>,
): ValidationOutcome {
  let step = stream.next();
  while (!step.done) step = stream.next();
  return step.value;
}

/** The synchronous validation: the streamed validation with every
 * chunk consumed at once. The verdicts and the stats are the
 * stream's, by construction. */
export function validateSpace(input: ValidationInput): ValidationOutcome {
  return collectValidation(streamValidation(input));
}
