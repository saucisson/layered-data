// Assembly validation: the pass that precedes every execution.
//
// Every diagnostic becomes a VERDICT before execution: (a) every
// declared act against the closure of its node (implicit override,
// phantom declaration), (b) every check tag against the registry —
// the data of the check-registry layer since ADR-0019,
// (b2) the vacant checks — a check carried but unable to judge,
// its required slots unbound (ADR-0018),
// (c) every binding at the level where its check reads it (the trap:
// an instance-level slot bound at a root is dead for every reading
// layer that descends from it), (d) the shadow confrontation: every
// first-winner that overrides must have declared it, (e) the
// expected-reads contract replays — a betrayed read, wherever it
// lives, is a verdict, (f) the assumes: a signature without an
// order conflict is a ghost, (g) the check couples — a divergent
// re-pose, an unsupported level, an unreadable formula, a template
// out of its judgment's quantified scope (ADR-0022).
//
// The verdict KINDS and the stat KEYS are kernel behavior — the panels
// display them — they stay in French. Everything here is pure: the
// space, the parse, the compilation and the layer list arrive as
// parameters, so staging can validate a whole assembly (corpus +
// supplements + candidate) without touching the loaded globals.

import { type LayerName, type LayerPath, asLayerName } from "./identifiers.ts";
import { AddressView, LayerReference, MASK, PathReference, type RawValue, isDictionary } from "./addresses.ts";
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
import { walkAddresses } from "./views.ts";
import { type CompiledLanguage, type Declaration } from "./language/compiler.ts";
import { type ParsedLanguage } from "./language/parser.ts";
import { fact, type MessageFact } from "./messages.ts";
import { orderConflictsAt } from "./conflicts.ts";

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
// registry's contracts — one source since ADR-0019: the contracts
// the DATA declares, read from the `check-registry` layer.
export function checkSlotContractsOf(
  contracts: Record<string, CheckContract>,
): Record<string, Record<string, "root" | "instance">> {
  return Object.fromEntries(Object.entries(contracts).map(([tag, contract]) => [tag, slotReadingLevelsOf(contract)]));
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
  if (value === MASK) return "MASK";
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

export function validateSpace({
  space,
  parse,
  compilation,
  layerNames,
}: {
  space: Space;
  parse: ParsedLanguage;
  compilation: CompiledLanguage;
  layerNames: LayerName[];
}): ValidationOutcome {
  const verdicts: Verdict[] = [];
  const stats: Record<string, number> = {
    couches: parse.layers.length,
    erreursSyntaxe: parse.errors.length,
    decl: compilation.declarations.length,
    nouveau: 0,
    extension: 0,
    surcharge: 0,
    masque: 0,
    declOK: 0,
    etiquettes: 0,
    ombresDeclarées: 0,
    ombresÉmergentes: 0,
    ombresBrutes: 0,
    tests: 0,
    trahis: 0,
    couples: 0,
  };
  for (const declaration of compilation.declarations) {
    if (declaration.mode === "new") stats.nouveau++;
    else if (declaration.mode === "extend") stats.extension++;
    else if (declaration.mode === "override") stats.surcharge++;
    else if (declaration.mode === "assume") {
      // a signature, not a value — the assume judges nothing here,
      // the walk (f) below is its only judge
      continue;
    } else stats.masque++;
  }

  // ---- the labels of each layer (closure of its root) and its
  // ancestry map — to know WHO reads a binding
  const labelsOf = new Map<string, Set<string>>();
  const ancestorsOf = new Map<string, Set<string>>();
  for (const layer of layerNames) {
    labelsOf.set(layer, new Set());
    ancestorsOf.set(layer, new Set());
  }
  for (const layer of layerNames) {
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
  }

  // ---- (a) declarations against the closures
  for (const declaration of compilation.declarations) {
    // the assume is judged by its own walk (f): its object is not
    // an upstream key but an order conflict — the upstream
    // confrontation would misjudge it
    if (declaration.mode === "assume") continue;
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
  }

  // ---- the registry's contracts, read from the data (ADR-0019):
  // existence in the data, slot reading levels derived — one
  // source for (b), (b2) and (c)
  const contracts = registryContractsOf({ space });
  const slotContracts = checkSlotContractsOf(contracts);

  // ---- (b) check tags against the registry
  for (const layer of layerNames) {
    for (const tag of labelsOf.get(layer)!) {
      if (!contracts[tag]) {
        verdicts.push({ kind: "étiquette-inconnue", fact: fact("unknown-label", { layer, tag }) });
      } else stats.etiquettes++;
    }
  }

  // ---- (b2) the vacant checks (ADR-0018): a check carried but
  // unable to judge — a required slot unbound at the address the
  // contract makes it judge. The verdict answers for the acts that
  // CAN answer: a local POSE (the tag carried at the very address —
  // the mirror of étiquette-inconnue, which refuses the posed tag
  // that does not exist; the symmetry of assume-fantôme, which
  // refuses the signature that judges nothing), and the root-level
  // slots of the layer checks a layer's root carries. The instance
  // slots of an inherited check are the lint's inventory: the type
  // binds them, the root never sees it.
  for (const vacancy of vacantChecksOf({ space, layerNames })) {
    if (!vacancy.posed && !(vacancy.level === "root" && vacancy.address[1].length === 0)) continue;
    const where = vacancy.address[0] + "::" + (vacancy.address[1].join("/") || ".");
    verdicts.push({
      kind: "check-vacant",
      fact: fact("vacant-slot", { where, tag: vacancy.tag, slot: vacancy.slot }),
    });
  }

  // ---- (c) dead bindings: an instance-level slot bound at the root
  // of a layer L is unreadable for every tag of a reading layer that
  // descends from L (the type is in the arc's closure, the root never)
  for (const layer of layerNames) {
    const root = space.raw({ layer, path: [] });
    if (!isDictionary(root) || !isDictionary(root["bindings"])) continue;
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

  // ---- (d) shadows against declarations — the same walk as the
  // diagnostics fallback, but judging
  for (const layer of layerNames) {
    for (const address of walkAddresses({ space, layer })) {
      const [addressLayer, addressPath] = address;
      for (const key of space.keys({ layer: addressLayer, path: addressPath })) {
        let winner: [string, string[]] | null = null;
        let providers = 0;
        for (const [sourceLayer, sourcePath] of space.closure({ layer: addressLayer, path: addressPath })) {
          const node = space.raw({ layer: sourceLayer, path: sourcePath });
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
          } else if (mode === "assume") {
            // the assume is a declared act — the signature of the
            // shadow the order decides (the __note: of an assume
            // lands here too: its winner is the signing node)
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
  }

  // ---- (e) the expected-reads contract replays — every layer of
  // the assembly carries its tests; the betrayed read is a verdict;
  // a candidate that breaks a scene (its own, or a redefined
  // layer's) is refused; the absent expectation compares to null, the
  // reference to the exact resolved address
  for (const layer of layerNames) {
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
  }
  // ---- (f) the assumes against the conflicts — a signature
  // without an order conflict is a ghost: nothing was signed, the
  // read is decided by structure (specificity), the assume adds
  // nothing but noise. The conflict the assume signs may live at
  // the very address of the signature (the reading address); its
  // visibility belongs to the lint, its refusal to the strict
  // staging — here, only the empty signature is a verdict.
  for (const declaration of compilation.declarations) {
    if (declaration.mode !== "assume") continue;
    const conflicts = orderConflictsAt({
      space,
      address: [declaration.layer, declaration.path as LayerPath],
    });
    if (!conflicts.some((conflict) => conflict.key === declaration.key)) {
      const where = declaration.layer + "::" + (declaration.path.join("/") || ".");
      verdicts.push({
        kind: "assume-fantôme",
        fact: fact("ghost-assume", { where, key: declaration.key }),
      });
    }
  }

  // ---- (g) the check couples (ADR-0022): the declarative strate is
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
  for (const layer of layerNames) {
    for (const address of walkAddresses({ space, layer })) {
      const [addressLayer, addressPath] = address;
      // per-address: only poses CO-VISIBLE at this address confront
      // each other — two sibling branches never meet (the geometry
      // of the refinement, the same the first-winner reads with)
      const firstPoseOf = new Map<string, { pose: string; canonical: string }>();
      for (const [sourceLayer, sourcePath] of space.closure({ layer: addressLayer, path: addressPath })) {
        const node = space.raw({ layer: sourceLayer, path: sourcePath });
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
  }

  // the readability of each POSE (deduplicated by (source, path,
  // name)) — the winner anywhere is judged exactly once
  const judgedPoses = new Set<string>();
  for (const layer of layerNames) {
    for (const address of walkAddresses({ space, layer })) {
      const [addressLayer, addressPath] = address;
      for (const [sourceLayer, sourcePath] of space.closure({ layer: addressLayer, path: addressPath })) {
        const node = space.raw({ layer: sourceLayer, path: sourcePath });
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
  }
  return { verdicts, stats };
}
