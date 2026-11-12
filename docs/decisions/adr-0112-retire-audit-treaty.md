# ADR-0112: Retiring the audit treaty

- Status: proposed (awaiting the human owner's acceptance)
- Date: 2026-11-12

## Context

During the TypeScript port of the kernel, `tests/audit-kernel.mts`
dumped every observable kernel read over the whole corpus and compared
it byte by byte against `tests/baseline-kernel.txt.gz` (~990 KB,
regenerated on every intentional corpus change). The treaty existed to
freeze parity with the Python reference kernel. The Python kernel is
gone: validity relative to the old world is no longer a criterion, and
the byte-identical photograph taxes every corpus evolution with a
re-signing step that protects nothing the real safety nets do not
already protect.

The engine's actual protection is executable: the specification
properties (`tests/specification-properties.mts`, obligations O1–O18,
conformance C1–C8, theorems T1–T3), the per-layer `expect` gold reads
replayed by the staging harness, and the per-harness assertions.

## Options considered

1. **Keep the treaty as is** — rejected: every corpus change pays a
   baseline regeneration and a byte-level diff review, for a guarantee
   (parity with a deleted oracle) that no longer means anything.
2. **Keep the harness, drop the baseline** — rejected: a dump without a
   frozen reference is a log, not a check; it would still tax every
   change with output to eyeball.
3. **Retire the treaty entirely** — chosen: the executable
   specification, the staging gold reads and the per-layer expectations
   cover the same regressions with sharper, property-level assertions.

## Decision

The byte-identical corpus-wide treaty is retired:
`tests/audit-kernel.mts` and `tests/baseline-kernel.txt.gz` are
removed, along with the `test:audit` script and every reference to the
harness in CI, docs and domain comments. Engine protection comes from
the executable specification, the staging's gold reads and the
per-layer expectations. Corpus content may evolve without re-signing a
global photograph.

The meta-audit (`registryAuditOf`, the check-registry self-audit in
`domain/checks.ts`) is a different mechanism and stays. Historical ADR
bodies that mention the audit (0102, 0104, 0105, 0106, 0108) are
history and are not edited.

## Consequences

- Corpus and domain changes are judged by O/C/T properties and gold
  reads, not by a byte-identical dump: faster reviews, no baseline
  regeneration step.
- A regression that only the full-corpus dump would have caught is now
  covered by the specification properties over the bedrock corpus and
  dedicated spaces; if a gap is ever observed, the fix is a new
  property, not a resurrected photograph.
- `fullObservation`/`FullObservation` in `domain/views.ts`, which
  existed only for the audit walk, is removed as dead code.
