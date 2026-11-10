// The scheduled validation: drive a validation stream chunk by chunk,
// yielding to the event loop between chunks, so a long validation
// never blocks the interface (ADR-0108). The stream itself is pure
// (domain/validation.ts); this driver only paces it — the outcome is
// the stream's return value, identical to a synchronous drain.

import { type ValidationChunk, type ValidationOutcome } from "../domain/validation.ts";

export interface ScheduledValidation {
  /** Resolves with the full outcome once every chunk has run. */
  readonly promise: Promise<ValidationOutcome>;
  /** Stops the pacing: no further chunk runs, the promise stays
   * pending — a cancelled validation is abandoned, never half
   * answered. */
  cancel: () => void;
}

/** Run the stream one chunk per macrotask (MessageChannel when
 * available, setTimeout otherwise), calling onChunk after each.
 * The first chunk runs on the first tick, not synchronously, so the
 * caller can paint a busy state before the work starts. */
export function scheduleValidation({
  stream,
  onChunk,
}: {
  stream: Generator<ValidationChunk, ValidationOutcome, void>;
  onChunk?: ((chunk: ValidationChunk) => void) | undefined;
}): ScheduledValidation {
  let cancelled = false;
  let settle!: (outcome: ValidationOutcome) => void;
  const promise = new Promise<ValidationOutcome>((resolve) => {
    settle = resolve;
  });
  // The channel is closed when the stream ends (or is cancelled) so
  // an open port never keeps the event loop alive.
  let closeChannel: (() => void) | null = null;
  function tick(): void {
    if (cancelled) return;
    const step = stream.next();
    if (step.done) {
      closeChannel?.();
      settle(step.value);
      return;
    }
    onChunk?.(step.value);
    post();
  }
  const post: () => void =
    typeof MessageChannel === "function"
      ? (() => {
          const channel = new MessageChannel();
          channel.port1.addEventListener("message", () => tick());
          closeChannel = () => {
            channel.port1.close();
            channel.port2.close();
          };
          return () => channel.port2.postMessage(null);
        })()
      : () => setTimeout(tick, 0);
  post();
  return {
    promise,
    cancel: () => {
      cancelled = true;
      closeChannel?.();
    },
  };
}
