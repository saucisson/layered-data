# Sandbox — drafted layers, not yet in the corpus

Every `.ld` file in `formalisms/kernel/` is a layer of the assembled
bedrock (one file per layer, pinned by `tests/staging-checks.mts`).
The files here are **drafts**: axes and compositions written on
2026-11-12 that staging has not yet judged (or that were refused).
They are not loaded by the browser glob, not assembled, not validated.
(`buchi-traffic-light.ld` was deleted per the maintainer's decision on
issue #289: delete, not fix.)

A draft enters the corpus only through review: fix its staging
verdicts, register it at the end of `KERNEL_LAYER_NAMES` in
`src/application/corpus.ts`, recalibrate `tests/survey-checks.mts`.
