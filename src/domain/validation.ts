// Assembly validation: the pass that precedes every execution.
//
// Every diagnostic becomes a VERDICT before execution: (a) every
// declared act against the closure of its node (implicit override,
// phantom declaration), (b) every check tag against the registry,
// (c) every binding at the level where its check reads it (the trap:
// an instance-level slot bound at a root is dead for every reading
// layer that descends from it), (d) the shadow confrontation: every
// first-winner that overrides must have declared it, (e) the
// expected-reads contract replays — a betrayed read, wherever it
// lives, is a verdict.
//
// The verdict KINDS and the stat KEYS are kernel behavior — the panels
// display them — they stay in French. Everything here is pure: the
// space, the parse, the compilation and the layer list arrive as
// parameters, so staging can validate a whole assembly (corpus +
// supplements + candidate) without touching the loaded globals.

import { type LayerName, type LayerPath } from "./identifiers.ts";
import { AddressView, LayerReference, MASK, PathReference, type RawValue, isDictionary } from "./addresses.ts";
import { Space } from "./space.ts";
import { checkRegistry } from "./checks.ts";
import { walkAddresses } from "./views.ts";
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
// root (silently vacant check) is unwritable there.
export const checkSlotContracts: Record<string, Record<string, "root" | "instance">> = {
  simple: { edges: "root", ordered: "root", arrows: "root", "arrow-vertex": "root", "end-source": "instance", "end-target": "instance" },
  nonempty: { edges: "root", arrows: "root", "arrow-vertex": "root" },
  oriented: { "end-source": "instance", "end-target": "instance" },
  sperner: { edges: "root", arrows: "root", "arrow-vertex": "root" },
  "k-partite": { vertices: "root", edges: "root", arrows: "root", "arrow-vertex": "root" },
  dag: { "end-source": "instance", "end-target": "instance" },
  arbre: { vertices: "root", edges: "root", "end-source": "instance", "end-target": "instance" },
};

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
      expectation: (layerNode["tests"] as RawValue)[address],
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
  };
  for (const declaration of compilation.declarations) {
    if (declaration.mode === "new") stats.nouveau++;
    else if (declaration.mode === "extend") stats.extension++;
    else if (declaration.mode === "override") stats.surcharge++;
    else stats.masque++;
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
      for (const tag of tags) labelsOf.get(layer)!.add(tag);
    }
  }

  // ---- (a) declarations against the closures
  for (const declaration of compilation.declarations) {
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

  // ---- (b) check tags against the registry
  for (const layer of layerNames) {
    for (const tag of labelsOf.get(layer)!) {
      if (!checkRegistry[tag]) {
        verdicts.push({ kind: "étiquette-inconnue", fact: fact("unknown-label", { layer, tag }) });
      } else stats.etiquettes++;
    }
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
          const contract = checkSlotContracts[tag];
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
            layer: winner[0],
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
  return { verdicts, stats };
}
