// The diagnostics fallback pass: the lints of the workshop.
//
// The kernel diagnostics channel (entrée-ignorée, garde-de-cycle)
// fills during recomputations; the lints add what only a full walk
// can see:
//   - refines-inversés: a refinement list where the generic follows
//     the specific;
//   - ombre / ombre-émergente: UNDECLARED shadows — a declared
//     shadow (extend/override) is an act of the language, not an
//     execution event; an emerging shadow of the diamond stays
//     listed: to inspect, the closure order decides;
//   - étiquette-inconnue and check-vacant: a tag absent from the
//     registry; cardinality bounds read without the closure ever
//     reaching the collection root; and a check carried but unable
//     to judge — its required slots unbound, the contract's
//     inventory (ADR-0018), never the check's execution.
//   - conflit-d'ordre: a leaf value decided between INCOMPARABLE
//     sources — the diamond's convention made visible (the order
//     stays the semantics, ADR-0017; a signature `assume` silences
//     it, address by address).
// The root sweep triggers the kernel channel once for all layers
// (trace: bypasses the memo at this level).

import { type LayerName, asLayerName, asLayerPath } from "../domain/identifiers.ts";
import type { Diagnostic } from "../domain/space.ts";
import { LayerReference, type Address, isDictionary } from "../domain/addresses.ts";
import type { Space } from "../domain/space.ts";
import { checkRegistry, vacantChecksOf } from "../domain/checks.ts";
import { declaredModeOf } from "../domain/validation.ts";
import { walkAddresses } from "../domain/views.ts";
import type { CompiledLanguage } from "../domain/language/compiler.ts";
import { fact, type MessageFact } from "../domain/messages.ts";
import { formatAddress, unsignedOrderConflictsOf } from "../domain/conflicts.ts";

/** Everything the lint pass walks: the living space, its layer
 * inventory, and the compilation of the loaded corpus (declared
 * modes are the language's memory of intent). */
export interface LintingTarget {
  space: Space;
  layerNames: readonly LayerName[];
  compilation: CompiledLanguage;
}

/** A refines list must go from generic to specific: if target j
 * refines target i, i must come first — inverted order is recorded
 * before any behavior. */
function lintRefinesOrder({ space, layerNames }: LintingTarget): void {
  for (const layerName of layerNames) {
    const entries = space.refinesAt({ address: [layerName, asLayerPath([])], tracer: null });
    const targets: string[] = [];
    for (const entry of entries) {
      if (entry instanceof LayerReference) {
        targets.push(entry.layer);
        continue;
      }
      const resolved = space.resolveRefinementEntry({
        entry,
        holder: [layerName, asLayerPath([])],
        tracer: null,
      });
      if (resolved !== null) targets.push(resolved[0][0]);
    }
    for (let i = 0; i < targets.length; i++) {
      for (let j = i + 1; j < targets.length; j++) {
        // target j refines target i => the generic i must precede
        // the specific j: inverted order, recorded before behavior
        const closureHasGeneric = space
          .closure({ layer: asLayerName(targets[j]), path: asLayerPath([]) })
          .some(([closureLayer]) => closureLayer === targets[i]);
        if (closureHasGeneric) {
          space.recordDiagnostic({
            kind: "refines-inversés",
            address: [layerName, asLayerPath([])],
            fact: fact("refines-inverted", { specific: targets[j], generic: targets[i] }),
          });
        }
      }
    }
  }
}

/** Undeclared shadows only: the confrontation lives in the
 * assembly validation; here, only shadows NOT declared remain
 * recorded. A `__note:key` note travels with the act it documents —
 * its shadow is judged on THAT act's declaration, never on a
 * phantom key. */
function lintShadow({ space, layerNames, compilation }: LintingTarget): void {
  for (const layerName of layerNames) {
    for (const address of walkAddresses({ space, layer: layerName })) {
      const [addressLayer, addressPath] = address;
      for (const key of space.keys({ layer: addressLayer, path: addressPath })) {
        // how many sources provide the key at this address
        let sourceCount = 0;
        for (const [sourceLayer, sourcePath] of space.closure({ layer: addressLayer, path: addressPath })) {
          const node = space.raw({ layer: sourceLayer, path: sourcePath });
          if (isDictionary(node) && key in node && node[key] !== null) sourceCount += 1;
        }
        if (sourceCount <= 1) continue;

        // the first winner of the confrontation — its declaration
        // decides whether the shadow is an act of the language
        let winner: Address | null = null;
        for (const [sourceLayer, sourcePath] of space.closure({ layer: addressLayer, path: addressPath })) {
          const node = space.raw({ layer: sourceLayer, path: sourcePath });
          if (isDictionary(node) && key in node && node[key] !== null) {
            winner = [sourceLayer, sourcePath];
            break;
          }
        }
        if (winner === null) continue;

        const documentedKey = key.startsWith("__note:") ? key.slice(7) : key;
        const mode = declaredModeOf({
          layer: winner[0],
          path: winner[1],
          key: documentedKey,
          compilation,
        });
        if (mode === "extend" || mode === "override") continue;
        space.recordDiagnostic({
          kind: mode === "new" ? "ombre-émergente" : "ombre",
          address,
          fact: fact("shadow", {
            key,
            winner: winner[0],
            path: winner[1].join("/") || ".",
            sources: sourceCount,
          }),
        });
      }
    }
  }
}

/** A check tag absent from the registry is a check that will never
 * run — wanted but nonexistent. */
function lintTags({ space, layerNames }: LintingTarget): void {
  for (const layerName of layerNames) {
    for (const address of walkAddresses({ space, layer: layerName })) {
      const [addressLayer, addressPath] = address;
      for (const [sourceLayer, sourcePath] of space.closure({ layer: addressLayer, path: addressPath })) {
        const node = space.raw({ layer: sourceLayer, path: sourcePath });
        if (!isDictionary(node)) continue;
        for (const tag of (node["checks"] ?? []) as unknown[]) {
          if (typeof tag !== "string") continue;
          if (!checkRegistry[tag]) {
            space.recordDiagnostic({ kind: "étiquette-inconnue", address, fact: fact("label-unknown", { tag }) });
          }
        }
      }
    }
  }
}

/** Vacuous cardinality bounds: a collection that does not refine
 * `collection` has its bounds read but never checked (vacant
 * check) — the bounds are there, the root is never reached. */
function lintVacuousBounds({ space, layerNames }: LintingTarget): void {
  for (const layerName of layerNames) {
    for (const address of walkAddresses({ space, layer: layerName })) {
      const [addressLayer, addressPath] = address;
      const minimum = space.rawValue({ layer: addressLayer, path: addressPath, key: "minimum" });
      const maximum = space.rawValue({ layer: addressLayer, path: addressPath, key: "maximum" });
      if (minimum === null && maximum === null) continue;
      const reachesCollectionRoot = space
        .closure({ layer: addressLayer, path: addressPath })
        .some(
          ([closureLayer, closurePath]) =>
            closureLayer === "collection" && closurePath.join("/") === "specification/collection",
        );
      if (!reachesCollectionRoot) {
        space.recordDiagnostic({
          kind: "check-vacant",
          address,
          fact: fact("vacuous-bounds"),
        });
      }
    }
  }
}

/** The vacant checks, inventory (ADR-0018): every check carried but
 * unable to judge — a required slot unbound at an address the
 * contract makes it judge, the detector reading the nominal
 * registry, never executing the checks. The validation refuses what
 * the acts can answer for (a pose, a layer root); here the WHOLE
 * inventory is recorded, the inherited instance vacancies included
 * — the lint's job is to see, not to judge. Measured on the trunk:
 * 79 judgments, 0 vacancies. */
function lintVacantChecks(target: LintingTarget): void {
  for (const vacancy of vacantChecksOf({ space: target.space, layerNames: target.layerNames })) {
    target.space.recordDiagnostic({
      kind: "check-vacant",
      address: vacancy.address,
      fact: fact("vacant-slot", {
        where: vacancy.address[0] + "::" + (vacancy.address[1].join("/") || "."),
        tag: vacancy.tag,
        slot: vacancy.slot,
      }),
    });
  }
}

/** The order conflicts of the whole inventory: every address whose
 * first-wins walks incomparable providers with diverging laid
 * values — the convention made visible, not a fault (the order IS
 * the semantics, ADR-0017). A signature `assume` at the reading
 * address silences the conflict: signed conventions are acts of
 * the language, the lint respects them. */
export function orderConflictsOf(target: LintingTarget) {
  const { space, layerNames, compilation } = target;
  return unsignedOrderConflictsOf({
    space,
    layerNames,
    isAssumed: (address, key) =>
      declaredModeOf({ layer: address[0], path: address[1], key, compilation }) === "assume",
  });
}

/** Record the unsigned order conflicts as conflit-d'ordre
 * diagnostics — the inventory of what the refines order decides
 * silently elsewhere. */
function lintOrderConflicts(target: LintingTarget): void {
  for (const conflict of orderConflictsOf(target)) {
    target.space.recordDiagnostic({
      kind: "conflit-d'ordre",
      address: conflict.address,
      fact: fact("order-conflict", {
        where: formatAddress(conflict.address),
        key: conflict.key,
        winner: formatAddress(conflict.winner),
        winnerValue: conflict.winnerValue,
        loser: formatAddress(conflict.loser),
        loserValue: conflict.loserValue,
      }),
    });
  }
}

/** The full diagnostics pass: one sweep at mount, on the memo — the
 * channel (space.diagnostics) gathers the kernel notes and those of
 * the lints; the verdict cites its silences. Returns the channel
 * snapshot (the channel itself keeps growing after). */
export function runAllLints(target: LintingTarget): Diagnostic[] {
  lintRefinesOrder(target);
  lintShadow(target);
  lintTags(target);
  lintVacuousBounds(target);
  lintVacantChecks(target);
  lintOrderConflicts(target);
  // root sweep: re-resolves the entries of the roots — the ignored
  // entries and cycle guards of the roots are recorded (tracer: the
  // memo is bypassed at this level)
  for (const layerName of target.layerNames) {
    target.space.closure({ layer: layerName, path: asLayerPath([]), trace: true });
  }
  return target.space.diagnostics.slice();
}
