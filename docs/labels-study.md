# Study — declared transversal labels (issue #363, étage B)

Status: **study only — no implementation merged in this wave.** The
derived family axis (étage A, closure test over the DAG) covers what
`refines` captures: Petri nets, automata, circuits, state spaces,
lenses, viewpoints. What it does **not** capture — stochastic,
state-space-as-a-concept, lenses-as-models, proof models — needs a
**declared datum**. This note records the candidate, the decisive
scenario, the options, and the decisions left to the maintainer.

Vocabulary: the word **"tag" is taken** (ADR-0109, the algorithmic
tags of the checks). The mechanism is called **labels** (or
**facettes**) everywhere: layers, field, UI, docs.

## The need

Filter and group layers and models by a cross-cutting axis that the
refinement DAG does not express: a layer is "stochastic" or a "proof
model" without any pivot layer in its closure. The derived axis of
étage A answers the structural families; the declared labels answer
the transversal ones.

## The candidate — a label micro-family in the space

`label-scheme refines @record` with one slot `label`; **each label is
one layer**; **subsumption by refinement**: `label-timed-petrinet
refines @label-petrinet` — whoever carries the first inherits the
second by closure (the closure of `label-timed-petrinet` contains
`label-petrinet`, so a carrier wearing the specific label is found
under the general one). A carrier poses a `labels` field:
`labels refines @collection` of LRefs (`petrinet = @label-petrinet`)
over the label layers.

Why the labels must live **in the space** (in `.ld` files), not in
TypeScript: the living inventory (layers imported / staged at runtime)
inherits them for free — a staged carrier's labels are readable by the
same closure machinery as the corpus's, with zero code change (the
lens inventory already works this way, issue #283). A TS constant in
`workshopInventory.ts` would not travel with an uploaded `.ld`.

Bilingual: the formalisms are English (ADR-0109), so the `label` slot
carries the English name; the French rendering lives in the
presentation layer (`i18n.ts`), exactly like `LAYER_ROLE`.

## The decisive scenario — subsumption by closure

A carrier wears `label-timed-petrinet`. The filter for "petrinet"
must list it, because the closure of `label-timed-petrinet` contains
`label-petrinet`. Pinned by the draft's staging evidence below: the
closure reads `label-timed-petrinet, label-petrinet, label-scheme,
record`. A flat text field cannot express this; only the refinement
graph can.

## The options

1. **The candidate above** (label micro-family + `labels` collection
   of LRefs): addressable labels (each label is a layer, shareable by
   address), subsumption by refinement, inherited by the living
   inventory. Cost: one layer per label, one field per carrier.
2. **The light option**: a plain text field à la `note`
   (`label = "timed-petrinet"`). Honest comparison: no addressability
   (a label is a string, not an address), no subsumption (the
   "petrinet" filter would not find "timed-petrinet" without a
   hardcoded prefix table — a TS constant, see below), but zero new
   layers and readable at a glance.
3. **The anti-choice, proscribed**: label constants in
   `workshopInventory.ts`. They do not travel with an uploaded `.ld`:
   a staged layer would carry labels the workshop cannot see, and the
   living inventory would silently diverge from the corpus. This is
   why the labels must live in the space.

## Annexe — the complete draft, staged and judged (0 verdicts), NOT merged

Drafted and judged by the staging against the whole corpus
(`stageLayerAddition` over the assembled kernel): **0 verdicts**.
The maintainer decides.

```ld
// ---- label-scheme: a declared transversal label — a micro-family of
//      records; each label is one layer, subsumption by refinement
//      (label-timed-petrinet refines @label-petrinet: whoever carries
//      the first inherits the second by closure)
layer label-scheme refines @record
  abstract label

layer label-petrinet refines @label-scheme
  override label = "petrinet"

layer label-timed-petrinet refines @label-petrinet
  override label = "timed-petrinet"

layer label-statespace refines @label-scheme
  override label = "statespace"

// a carrier: the dinner wears its labels as LRefs in a collection
layer pn-philosophers-5-labelled refines @pn-philosophers-5
  labels refines @collection
    extend specification
      extend collection
        override type = @label-scheme
    petrinet = @label-petrinet
    timed = @label-timed-petrinet
  extend tests
    expect labels/petrinet = @label-petrinet
    expect labels/timed = @label-timed-petrinet
```

Staging evidence (run on the branch, whole corpus + draft
revalidated): `verdicts: 0`; after application,
`closure(label-timed-petrinet) = label-timed-petrinet,
label-petrinet, label-scheme, record` (subsumption), and the carrier
reads `labels/petrinet = @label-petrinet` (an LRef, addressable).

## Decisions left to the maintainer

- Merge the `label-scheme` micro-family, or keep only the derived
  family axis of étage A for now?
- If merged: the light text field as a complement for one-off labels,
  or labels always as layers?
- Which labels first: stochastic, statespace, proof-model, lens?
- Naming: **labels** vs **facettes** in the UI (the glossary already
  had to pick one for "viewpoint", issue #324).
