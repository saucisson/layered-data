// The session of the workshop's pages: the formalisms accepted in
// the creation page, kept in memory for as long as the tab lives —
// the disk quarry (the server) remains the durable path. The
// store is a module-level ledger with a version counter, in the
// exact discipline of the browser language store: read functions,
// one write function, no React. The pages materialize the ledger
// into their own assembled kernel at render — idempotently: an
// addition whose layers already sit in the space is never staged
// twice, so navigating from page to page re-plays the session
// without ever duplicating it.

import { applyStagedAddition, extractLayerBlock, stageLayerAddition } from "./staging.ts";
import type { LayeredDataKernel } from "./corpus.ts";

/** One addition kept by the session: the accepted source, and the
 * layer names that entered the space. */
export interface SessionAddition {
  source: string;
  layerNames: string[];
}

/** What the materialization hands to a page: the living layer
 * names (corpus + session), the source blocks of the session
 * layers (for the DSL display), the accepted sources in order. */
export interface MaterializedSession {
  layerNames: string[];
  blocks: Record<string, string>;
  sources: string[];
}

const SESSION_ADDITIONS: SessionAddition[] = [];
let sessionVersion = 0;

/** The session additions, in acceptance order. */
export function readSessionAdditions(): readonly SessionAddition[] {
  return SESSION_ADDITIONS;
}

/** The version of the session ledger — it moves at each write; a
 * page that re-materializes on its change stays in step with the
 * creation page. */
export function readSessionVersion(): number {
  return sessionVersion;
}

/** Keep one accepted addition in the session ledger. */
export function writeSessionAddition({ addition }: { addition: SessionAddition }): void {
  SESSION_ADDITIONS.push({ source: addition.source, layerNames: [...addition.layerNames] });
  sessionVersion++;
}

/** Materialize the session ledger into a kernel: each addition is
 * staged and applied again, against the corpus and the additions
 * before it — the deterministic replay of its acceptance. An
 * addition already materialized in this kernel is counted (its
 * layers, its source, its blocks) without being staged twice —
 * navigating from page to page re-plays the session, never
 * duplicates it. An addition the staging would now refuse is
 * skipped, honestly: the corpus moved under the session, the page
 * stays readable, never a crash. */
export function materializeSessionAdditions({
  kernel,
}: {
  kernel: LayeredDataKernel;
}): MaterializedSession {
  const layerNames: string[] = [...kernel.layerNames];
  const blocks: Record<string, string> = {};
  const sources: string[] = [];
  for (const addition of SESSION_ADDITIONS) {
    const alreadyMaterialized = addition.layerNames.some(
      (layerName) => layerName in kernel.space.layers,
    );
    if (alreadyMaterialized) {
      layerNames.push(...addition.layerNames);
      sources.push(addition.source);
      for (const layerName of addition.layerNames) {
        const block = extractLayerBlock({ name: layerName, source: addition.source });
        if (block !== null && blocks[layerName] === undefined) blocks[layerName] = block;
      }
      continue;
    }
    const staging = stageLayerAddition({
      languageSource: kernel.languageSource,
      previousAdditionSources: sources,
      draftSource: addition.source,
      livingLayerNames: [...layerNames],
      readonlyLayerNames: [...kernel.layerNames],
    });
    if (!staging.ok) continue;
    const applied = applyStagedAddition({
      space: kernel.space,
      staging,
      knownLayerNames: [...layerNames],
      readonlyLayerNames: [...kernel.layerNames],
    });
    layerNames.push(...applied.newLayerNames);
    sources.push(addition.source);
    for (const [layerName, block] of Object.entries(staging.blocks)) {
      blocks[layerName] = block;
    }
  }
  return { layerNames, blocks, sources };
}
