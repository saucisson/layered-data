# ADR-0026: the validation streams in chunks

- Status: proposed (awaiting the human owner's acceptance)
- Date: 2026-11-09

## Context

The assembly validation (`validateSpace`) is pure but synchronous, and it is the most expensive pass of the kernel: the benchmark measures 497 ms cold / 97 ms warm at the corpus's base size, 2166 ms cold / 658 ms warm at 8x. It runs on the main thread at every staging (addition or edition of a living layer), so a large assembly freezes the interface for the whole validation. The validation session already made the *walks* incremental (an edition rebuilds only the stale walks — one walk for a living draft), but the passes over all layers still run in one blocking call.

The user-visible requirement: the validation time must not block the interface. The API requirement: a synchronous entry point that consumes every chunk must keep existing, with identical results.

## Options considered

- **Web Worker.** Rejected for now: the living space and the edition protocol would cross a thread boundary (structured clone or message passing of the whole space), a much larger architecture change for a cost the chunked form already removes.
- **Chunked streaming on the event loop** (chosen): the validation becomes a generator yielding one chunk per judged unit (layer, declaration, vacancy); a scheduler paces the chunks one per macrotask; `collectValidation` drains the stream synchronously for API callers. The verdicts and stats are the stream's, by construction — the synchronous `validateSpace` is now literally `collectValidation(streamValidation(...))`, so equivalence is structural, not tested into existence (it is also pinned by `tests/validation-stream-checks.mts`).
- **Incremental verdicts only (no pacing).** Rejected: it would keep the main thread blocked, which is the problem being solved.

## Decision

`src/domain/validation.ts` exposes `streamValidation` (a generator of `ValidationChunk` — phase, layer, new verdicts, progress — returning the full `ValidationOutcome`) and `collectValidation` (the drain: the API form, "pass every chunk"). `validateSpace` delegates to the two, keeping its signature and its exact output. `src/application/validationStream.ts` adds `scheduleValidation`, which paces a stream one chunk per macrotask (`MessageChannel`, `setTimeout` fallback) with an `onChunk` callback. The validation session exposes `outcomeStream()`; the staging and edition routes expose `streamStageLayerAddition` / `streamStageLayerEdition`, and the composer and editor drive them with a progress display on the staging button.

## Consequences

- The benchmark's absolute durations do not change (the same work runs); what changes is that the interface paints between chunks — interactivity during a validation.
- Verdict order and stats are unchanged; the audit's byte-identical baseline and the session equivalence checks still pin them, and the new stream checks pin the chunked forms.
- A cancelled scheduled validation is abandoned (its promise stays pending) — it is never half-answered.
- The chunk granularity is per judged unit; a single huge layer still runs as one chunk. If a corpus grows a pathological layer, the next step would be sub-layer chunking, not a new mechanism.
