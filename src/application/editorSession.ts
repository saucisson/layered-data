// The shared editor session (ADR-0110): the living additions of the
// graphical model editor, kept as ONE versioned state on the server
// and broadcast to every connected editor. This module is the pure
// application logic — the HTTP/SSE transport lives in server.ts, the
// JSON persistence is injected by the caller.
//
// A gesture is a layer source (one or more `layer` blocks, exactly
// what the editor drafts). The server judges it with the SAME staging
// as the browser: the candidate additions are re-staged in order over
// a freshly assembled bedrock, and any verdict anywhere refuses the
// gesture — the version does not move. Acceptance is optimistic
// locking: the gesture carries the version it was drafted against
// (baseVersion); a stale one is a conflict, the client re-syncs.

import { assembleLayeredDataKernel } from "./corpus.ts";
import {
  applyStagedAddition,
  extractLayerBlock,
  stageLayerAddition,
  type StagingOutcome,
} from "./staging.ts";
import { asLayerName, type LayerName } from "../domain/identifiers.ts";

/** One living addition of the session: a layer name and its complete
 * source block (header included). */
export interface SessionAdditionEntry {
  name: string;
  source: string;
}

/** The versioned state broadcast to every connected editor. */
export interface EditorSessionState {
  version: number;
  additions: SessionAdditionEntry[];
}

/** The verdict of a gesture: accepted (the version moved), refused
 * by the staging (the version did not move, the refusal speaks), or
 * a conflict (the baseVersion is stale — re-sync and retry). */
export type GestureOutcome =
  | { ok: true; state: EditorSessionState }
  | {
      ok: false;
      reason: "refused";
      refusals: string[];
      staging: StagingOutcome | null;
      state: EditorSessionState;
    }
  | { ok: false; reason: "conflict"; state: EditorSessionState };

/** The layer names declared by a source, in order of appearance —
 * a `layer` word inside a comment never counts. */
export function layerNamesOfSource({ source }: { source: string }): string[] {
  const names: string[] = [];
  for (const line of source.split("\n")) {
    if (line.startsWith("layer ") && !line.startsWith("//")) {
      const name = line.slice(6).trim().split(/\s+/)[0];
      if (name) names.push(name);
    }
  }
  return names;
}

/** The shared editor session: a versioned state plus the two
 * sanctioned mutations — the judged gesture and the restore of a
 * past version (ADR-0111: undo/redo survives a reload). */
export interface EditorSession {
  readState(): EditorSessionState;
  applyGesture({ source, baseVersion }: { source: string; baseVersion: number }): GestureOutcome;
  restore({
    additions,
    baseVersion,
  }: {
    additions: SessionAdditionEntry[];
    baseVersion: number;
  }): GestureOutcome;
}

/** Create a session over the bedrock corpus. The kernel sources are
 * the assembly input; each gesture re-assembles a fresh kernel so the
 * staging judges against the pristine bedrock, never against a space
 * a previous gesture mutated. */
export function createEditorSession({
  kernelLayerSources,
  kernelLayerNames,
  initial,
}: {
  kernelLayerSources: Readonly<Record<string, string>>;
  kernelLayerNames: readonly LayerName[];
  initial?: EditorSessionState | undefined;
}): EditorSession {
  let state: EditorSessionState = initial ?? { version: 0, additions: [] };

  /** The tribunal: re-stage every candidate addition in order over a
   * fresh bedrock — the deterministic replay of their acceptance.
   * On success the version moves and the candidate becomes the state. */
  function tribunal({ candidate }: { candidate: SessionAdditionEntry[] }): GestureOutcome {
    const kernel = assembleLayeredDataKernel({ layerSources: kernelLayerSources });
    const livingLayerNames: string[] = [...kernel.layerNames];
    const previousAdditionSources: string[] = [];
    for (const addition of candidate) {
      const staging = stageLayerAddition({
        languageSource: kernel.languageSource,
        previousAdditionSources,
        draftSource: addition.source,
        livingLayerNames,
        readonlyLayerNames: [...kernel.layerNames],
      });
      if (!staging.ok) {
        return { ok: false, reason: "refused", refusals: [], staging, state: readState() };
      }
      const applied = applyStagedAddition({
        space: kernel.space,
        staging,
        knownLayerNames: [...livingLayerNames],
        readonlyLayerNames: [...kernel.layerNames],
      });
      livingLayerNames.push(...applied.newLayerNames);
      previousAdditionSources.push(addition.source);
    }
    state = { version: state.version + 1, additions: candidate };
    return { ok: true, state: readState() };
  }

  function applyGesture({
    source,
    baseVersion,
  }: {
    source: string;
    baseVersion: number;
  }): GestureOutcome {
    if (baseVersion !== state.version) {
      return { ok: false, reason: "conflict", state: readState() };
    }
    const names = layerNamesOfSource({ source });
    if (names.length === 0) {
      return {
        ok: false,
        reason: "refused",
        refusals: ["aucune-couche"],
        staging: null,
        state: readState(),
      };
    }
    const stolen = names.filter((name) => kernelLayerNames.includes(asLayerName(name)));
    if (stolen.length > 0) {
      return {
        ok: false,
        reason: "refused",
        refusals: ["socle-occupé: " + stolen.join(", ")],
        staging: null,
        state: readState(),
      };
    }
    // the candidate additions: each drafted layer replaces its entry
    // (an edition) or appends (a creation)
    const candidate: SessionAdditionEntry[] = state.additions.map((entry) => ({ ...entry }));
    for (const name of names) {
      const block = extractLayerBlock({ name, source });
      if (block === null) {
        return {
          ok: false,
          reason: "refused",
          refusals: ["bloc-absent: " + name],
          staging: null,
          state: readState(),
        };
      }
      const existing = candidate.findIndex((entry) => entry.name === name);
      if (existing >= 0) {
        candidate[existing] = { name, source: block };
      } else {
        candidate.push({ name, source: block });
      }
    }
    return tribunal({ candidate });
  }

  /** Restore a past version: the target additions REPLACE the current
   * ones (not merged) and are re-judged by the same tribunal — a
   * restore is a new version, never a silent rewind. */
  function restore({
    additions,
    baseVersion,
  }: {
    additions: SessionAdditionEntry[];
    baseVersion: number;
  }): GestureOutcome {
    if (baseVersion !== state.version) {
      return { ok: false, reason: "conflict", state: readState() };
    }
    const candidate = additions.map((entry) => ({ ...entry }));
    const stolen = candidate
      .map((entry) => entry.name)
      .filter((name) => kernelLayerNames.includes(asLayerName(name)));
    if (stolen.length > 0) {
      return {
        ok: false,
        reason: "refused",
        refusals: ["socle-occupé: " + stolen.join(", ")],
        staging: null,
        state: readState(),
      };
    }
    return tribunal({ candidate });
  }

  function readState(): EditorSessionState {
    return { version: state.version, additions: state.additions.map((entry) => ({ ...entry })) };
  }

  return { readState, applyGesture, restore };
}

/** Serialize a state for the JSON persistence file. */
export function serializeEditorSession({ state }: { state: EditorSessionState }): string {
  return JSON.stringify(state, null, 2) + "\n";
}

/** Read a persisted state back. A malformed file is no session, never
 * an exception — the server boots with an empty one. */
export function parseEditorSession({ text }: { text: string }): EditorSessionState | null {
  try {
    const parsed = JSON.parse(text) as Partial<EditorSessionState>;
    if (typeof parsed?.version !== "number" || !Array.isArray(parsed?.additions)) return null;
    const additions: SessionAdditionEntry[] = [];
    for (const entry of parsed.additions) {
      if (typeof entry?.name !== "string" || typeof entry?.source !== "string") return null;
      additions.push({ name: entry.name, source: entry.source });
    }
    return { version: parsed.version, additions };
  } catch {
    return null;
  }
}
