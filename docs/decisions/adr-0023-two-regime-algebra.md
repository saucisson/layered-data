# ADR-0023: The two-regime algebra — mask and assume retire, the guarantees become theorems

- Status: accepted
- Date: 2026-11-05

## Context

The replacement ontology, measured on the bedrock (ADR-0022's census):
LEAVES are first-winner tips — 78 `override`, 2 `override abstract`,
declared by gesture (`new`, `extend`, `override`); MEMBERS re-merge
cumulatively, the union motif, insertion order preserved; NAMES are
extend-only (the alias law: a renaming adds a synonym, the original
survives); CHECKS accumulate like members — a couple is never replaced.

Two channels of the grammar carry NOTHING, measured:

- **`mask`** — 0 acts in the whole bedrock corpus. It is the algebra's
  only ANTI-MONOTONE gesture: every other act provides upward, `mask`
  removes from below. A silent deletion channel is a hole in the
  ontology's story: the first-winner already refuses an undeclared
  shadow (« ombre-non-déclarée »), and the specs' discipline (no
  absence without a name) never needed to erase anything;
- **`assume`** — 0 acts in the whole bedrock corpus. ADR-0017 made the
  refines order a SIGNABLE convention: `assume key` blesses the
  order-decided read between incomparable providers. But ADR-0017's
  own census measured ZERO leaf divergences on the trunk — the order
  never decides a value; specificity (the `refines` structure) always
  does. The signature exists to bless a convention that never fires:
  it is a semantics for a case that does not occur.

With both retired, the reading is entirely confluent: a read depends
on WHO descends from WHOM (specificity) and on nothing else. O2 — "the
declared order IS the semantics" — dies as a VALUE semantics; the order
keeps what it truly owns: the member insertion order, the display
sequence, the determinism (O16).

## Options considered

- **Keep both** (status quo): rejected — two dead channels, one of
  them anti-monotone, each costing grammar surface, validation walks
  (« assume-fantôme »), a stats line (`masque: 0`), and tutorial
  prose — for nothing measured;
- **Retire `mask`, keep `assume`**: rejected — the zero-divergence
  census empties the signature of its object; a confluent reading has
  nothing left to sign, and keeping a blessing gesture invites the
  corpus to grow blessings instead of structure;
- **Keep `mask` as a reserved future**: rejected — a channel kept
  "just in case" is exactly the drift the constitution refuses;
  when a measured need appears, an ADR will return with the evidence;
- **Retire both, declare the two regimes** (chosen): the algebra
  states what it does; what it does not do, it does not spell.

## Decision

1. **The algebra is two regimes, stated.**
   - **MEMBERS merge cumulatively** — union, insertion order
     preserved, re-merged on every read. A member is never replaced
     and never removed; a re-pose is a doublon the validation judges
     (ADR-0022 for the checks, the same motif for every container);
   - **LEAVES are declared tips** — first-winner by SPECIFICITY, the
     `refines` structure the only judge. The gestures name themselves:
     `new` (a leaf that must not exist upstream), `extend` (a leaf
     that must), `override` (a leaf that replaces, upstream declared);
   - Nothing else replaces, nothing else removes, nothing else blesses.
2. **`mask` retires.** No act removes from below. The first-winner's
   existing refusals (undeclared shadows, implicit overloads) stay —
   they judge declarations, not values.
3. **`assume` retires.** The order stops claiming value semantics
   (O2 retires as such). An incomparable leaf divergence stays what
   ADR-0017 made observable — a lint inventory (« conflit-d'ordre », to
   inspect) and, in exacting spaces, a strict staging refusal — but
   it can no longer be BLESSED: an exacting space must restructure
   (make the providers comparable, or diverge them into different
   addresses), never sign the convention away. Determinism (O16) is
   untouched: insertion order remains observable, the dumps stay
   byte-stable.
4. **The guarantees become theorems.** With no anti-monotone channel
   and no blessing channel:
   - **Confluence**: the read of an address is a function of its
     closure's specificity order — no gesture can change a read it
     does not structurally dominate;
   - **Conservativity**: a new layer adds members and tips leaves in
     its OWN posterity only — a space never disturbs the reading of
     the layers it does not descend into;
   - **Monotony**: growing a space can only grow what a walk
     enumerates — no arrival can remove a member, a name, or a check
     couple.
   These stop being disciplines to keep and become properties to
   PROVE — the algebra is small enough to carry its own theorem.
5. **Execution is deferred, the decision is constitutional.** The
   retirement patch will remove: the two acts from the parser and the
   grammar, the MASK handling in the reading, the validation's walk
   (f) (« assume-fantôme ») and the `masque` stat, the shadow
   confrontation's mask arm, the strict staging's unsigned-conflict
   escape, the tutorial's and glossary's `assume` entries, and the
   ADR-0017 references that describe the signature as living. Until
   that patch, the channels carry nothing — the bedrock measures
   zero of both — so the decision costs nothing to state now and
   everything to state late.

## Consequences

- The grammar loses two gestures (the tutorial's gesture count
  follows); the seventh step's prose and the glossary entry for
  ⟪assume⟫ are edited by the retirement patch;
- The declaration modes reduce to `new`, `extend`, `override` — the
  same three the ontology measured;
- The strict staging arm keeps refusing unsigned conflicts, now
  without exception: « conflit-d'ordre » in strict mode means
  RESTRUCTURE, and the permissive mode keeps the lint's amber
  inventory;
- The kernel's reading semantics does not change on the bedrock: zero
  `mask`, zero `assume`, the audit baseline is untouched by the
  decision itself;
- ADR-0017's visibility and refusal layers stand unchanged — this
  ADR retires only the SIGNATURE, the third of its three layers;
- Negative, assumed: a future corpus that genuinely needs "hide this
  member from below" must come back with a measured case and a new
  ADR — the door is closed, not welded; the evidence reopens it.

## Future improvements

- The retirement patch (see Decision 5) — the execution of this
  decision;
- A written proof sketch of the three theorems over the two regimes,
  in the specification's terms, once the retirement patch lands;
- ADR-0017's « signed crossings » view retires with the signature —
  the lint's inventory is the whole story now.
