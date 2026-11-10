// The validation session: a long-lived validation over a long-lived
// space. The kernel's write protocol (edition.ts: the edited layer's
// compiled tree enters the living space, then touch) exists precisely
// so the space SURVIVES an edition — the closure memo invalidates
// its touched entries and keeps the rest. The session extends the
// same economy to the observed walks: the walks of the untouched
// layers are kept, and only the walks whose recorded dependencies
// the touch journal covers are rebuilt. The validation itself is
// never rewritten: the session calls validateSpace — the verdicts
// and the stats are the full validation's, by construction. A
// cached walk is reused only when space.isObservationStale says no
// touch since its capture covers any dependency it recorded — the
// very rule the memo applies to its own entries; the session is
// conservative by design (it may rebuild more than strictly needed,
// it never reuses a walk that could have changed). Parse and compile
// stay the caller's — an edition recompiles the whole corpus (a few
// milliseconds, the harnesses measure it), the session takes the
// fresh parse and compilation and never guesses them.

import { asLayerPath, type LayerName } from "../domain/identifiers.ts";
import { Space } from "../domain/space.ts";
import {
  collectValidation,
  streamValidation,
  type ValidationChunk,
  type ValidationOutcome,
} from "../domain/validation.ts";
import type { ParsedLanguage } from "../domain/language/parser.ts";
import type { CompiledLanguage } from "../domain/language/compiler.ts";
import { walkLayerObserved, type WalkedAddress } from "../domain/views.ts";

/** One cached walk: the observed addresses, the dependencies the
 * observation recorded, and the journal watermark at its capture. */
interface CachedWalk {
  walked: WalkedAddress[];
  deps: Set<number>;
  gen: number;
}

export interface ValidationSession {
  /** The living space the session validates. */
  readonly space: Space;
  /** The ordered layer names of the assembly. */
  readonly layerNames: LayerName[];
  /** The current parse (the caller's, refreshed per edition). */
  readonly parse: ParsedLanguage;
  /** The current compilation (the caller's, refreshed per edition). */
  readonly compilation: CompiledLanguage;
  /** Apply an edition and revalidate: the layer's compiled tree
   * enters the space (the write protocol of edition.ts — the
   * assignment, then the touch), the parse and compilation are the
   * CALLER's fresh ones (an edition recompiles the whole corpus),
   * and the validation runs over the session's walks. */
  applyEdition({ layerName, parse, compilation }: {
    layerName: LayerName;
    parse: ParsedLanguage;
    compilation: CompiledLanguage;
  }): ValidationOutcome;
  /** The validation of the current state, without edition. */
  outcome(): ValidationOutcome;
  /** The same validation as a stream (ADR-0108): one chunk per judged
   * unit, the return value is the full outcome — drain it with
   * collectValidation for the synchronous form, or pace it with
   * scheduleValidation for a non-blocking one. */
  outcomeStream(): Generator<ValidationChunk, ValidationOutcome, void>;
  /** How many walks the last validation rebuilt — the session's
   * observable economy (the harnesses assert it: an edition that
   * touches one layer rebuilds a handful of walks, not the whole
   * corpus). */
  rebuiltWalks(): number;
}

export function createValidationSession({
  space,
  parse,
  compilation,
  layerNames,
}: {
  space: Space;
  parse: ParsedLanguage;
  compilation: CompiledLanguage;
  layerNames: LayerName[];
}): ValidationSession {
  let currentParse = parse;
  let currentCompilation = compilation;
  const walkTable = new Map<LayerName, CachedWalk>();
  let rebuilt = 0;

  const walkedOf = (layer: LayerName): WalkedAddress[] => {
    const cached = walkTable.get(layer);
    if (cached !== undefined && !space.isObservationStale({ deps: cached.deps, gen: cached.gen })) {
      return cached.walked;
    }
    const observation = space.beginObservation();
    try {
      const walked = walkLayerObserved({ space, layer });
      walkTable.set(layer, { walked, deps: observation.deps, gen: observation.gen });
      rebuilt += 1;
      return walked;
    } finally {
      // an exception must never leave the collector open
      space.endObservation();
    }
  };

  const session: ValidationSession = {
    space,
    layerNames,
    get parse(): ParsedLanguage {
      return currentParse;
    },
    get compilation(): CompiledLanguage {
      return currentCompilation;
    },
    applyEdition({ layerName, parse, compilation }) {
      currentParse = parse;
      currentCompilation = compilation;
      space.layers[layerName] = compilation.layers[layerName];
      space.touch({ layer: layerName, path: asLayerPath([]) });
      return session.outcome();
    },
    outcome() {
      return collectValidation(session.outcomeStream());
    },
    outcomeStream() {
      rebuilt = 0;
      return streamValidation({
        space,
        parse: currentParse,
        compilation: currentCompilation,
        layerNames,
        walkedOf,
      });
    },
    rebuiltWalks() {
      return rebuilt;
    },
  };
  return session;
}
