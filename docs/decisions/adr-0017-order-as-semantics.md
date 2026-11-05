# ADR-0017: Order as semantics — first-wins conflicts made visible, signable, contractual

- Status: accepted
- Date: 2026-11-04
- Amended by: [ADR-0023](adr-0023-two-regime-algebra.md) — the signature
  (decision 3) retires with it; the visibility (decision 1) and the
  strict staging (decision 4, now without exception) stand.

## Context

First-wins over the closure is the single read semantics of the kernel
(O2: the declared order IS the semantics; O16 keeps it deterministic).
When the two providers of a key live in a comparable relation — the
winner refined from the loser — the priority is specificity: a
structure, declared by `refines`. But when the providers are
INCOMPARABLE (neither lives in the other's closure — the diamond's two
branches, the union shadows), what decides between them is the position
in the refines lists: a CONVENTION, not a meaning. Nothing in the
workshop ever made that convention visible; a divergent diamond read was
resolved silently, by priority alone.

Measured on the trunk corpus: 59 read addresses walk incomparable
providers, ALL of them dict openings (two incomparable sub-addresses);
ZERO divergences of leaf value (scalar, reference, list — what a read
returns directly). The convention decides topology 59 times; it decides
values zero times — so far.

Rejected diagnosis: "the diamond problem is solved". It is not solved,
it is given an address — and an address nobody could read.

## Options considered

- **Keep the silence** (status quo): rejected — the workshop's
  constitution is « tout est prouvé, rien n'est cru — et les limites
  sont affichées »; a deciding convention that nothing displays is an
  unassumed limit.
- **Algebraic merging** (CUE-style unification, per-key merge policies
  `merge = max`/`union`): rejected — it multiplies the kernel's
  semantics (one mechanism is the project's thesis), and a lattice
  answers conflicts by refusing them: closed-world algebra on a
  reading model that chose order and determinism (O16) would be a
  second semantics, parallel to the first.
- **Linearization with inconsistency rejection** (C3/MRO-style):
  rejected for the same reason — it judges at assembly time what the
  closure exists to defer to reading time, and it rejects instead of
  inspecting.
- **Visibility + signature + optional contract** (chosen): the order
  stays the semantics; the convention becomes observable (a lint
  diagnostic), signable (a language act), and — for spaces that demand
  it — contractual (a staging refusal). Three layers, one design.

## Decision

1. **`conflit-d'ordre`** (new lint diagnostic, `lintOrderConflicts`):
   for every address, every key whose first-wins walks incomparable
   providers with diverging LAID values (structurally compared, never
   resolved — faithful to O6). Vertical inheritance never conflicts
   (specificity is structure). `MASK` is an act, not a value (the act
   retired by ADR-0023). Notes
   document, they never provide. The diagnostic is an inventory —
   amber, « à inspecter » — never a fault.
2. **Leaf values only**: two incomparable dict providers are NOT
   reported. A dict opens a sub-address whose closure re-merges both
   branches; the divergence does not survive the scalar read (the 59
   trunk crossings are of this kind — topological, re-merged, silent
   by design). This is a measured choice, not an oversight: the
   reported conflict is exactly the observable a reader can be
   surprised by — the VALUE the read returns.
3. **`assume`** (new language act — **retired by ADR-0023**: the
   zero-divergence census emptied the signature of its object, the
   reading is confluent, nothing blesses an order-decided read
   anymore): `assume key` signs the
   order-decided read at its address. It lays no value, no data
   enters the tree, no special key is added — the kernel's reading
   semantics (O1–O18) are untouched; the act lives only in the
   compilation's declaration table (mode `"assume"`). A signed
   conflict is silenced in the lint. An assume WITHOUT a conflict is
   a ghost — the validation refuses it as « assume-fantôme »: empty
   signatures are noise, and the signature judges nothing. The
   signature is address-local: every reading address signs its own
   conflict (the alias price, assumed as everywhere else).
4. **Strict staging** (`strictConflicts` option on
   `stageLayerAddition`, off by default; `PEN_STRICT_CONFLICTS=1` for
   the pen loop): the unsigned conflicts of the judged layers become
   staging verdicts — a candidate that lets the refines order decide a
   leaf value between incomparable sources is refused as
   « conflit-d'ordre » — since ADR-0023 the refusal is WITHOUT
   EXCEPTION: no act signs a conflict, an exacting space restructures
   (make the providers comparable, or diverge them into different
   addresses). The trunk
   stays permissive; an exacting space makes the convention
   contractual. The judge is the same pure detector
   (`src/domain/conflicts.ts`) the lint inventories with.
5. **No value form for `assume`**: freezing the read VALUE is already
   the job of the `expect` contract (`tests` blocks, replayed,
   « attendu-trahi »). `assume` signs, `expect` measures — the
   division of the tutorial's contract applies.

## Consequences

- The kernel is untouched: no new obligation, no new special key, the
  audit baseline stays byte-identical (verified), the six harnesses
  pass, the trunk corpus reads exactly as before.
- New observable vocabulary: verdict/diagnostic kinds
  « conflit-d'ordre » and « assume-fantôme », fact codes
  `order-conflict` and `ghost-assume`, both bilingual — the ghost
  and its code retired with the signature (ADR-0023); the conflict
  and its code stand.
- The language grows an eighth gesture (`assume`), colored as a
  keyword, in the tutorial's seventh step, in the glossary — the
  gesture, the keyword and the glossary entry retired with ADR-0023;
  the word falls back to the common vocabulary of keys.
- The staging protocol freezes two more scenarios (unsigned conflict
  refused in strict mode; ghost assume refused always) — the ghost
  scenario retired with the signature (ADR-0023); since then the
  strict refusal is without exception, and the lint inventories a
  seventh kind.
- The lint over the trunk reports zero conflit-d'ordre (measured): a
  curated spine is compatible with the strict reading of its own
  convention — the diagnostic would say so if it were not.
- Negative, assumed: the strict mode is opt-in and the workshop UI
  does not expose it yet (the pen and the API accept it first); a
  workspace toggle is a future improvement, not a semantic need.
- Negative, assumed: 59 topological crossings stay unreported; a
  reader who wants them can widen `orderConflictsAt`'s provider
  filter — the choice is documented here precisely so that widening
  is a decision, not a drift.

## Future improvements

- A workshop toggle for strict staging (presentation only).
- A « signed crossings » view of the spine: the assume's addresses,
  walkable like the closure's — retired with the signature
  (ADR-0023); the lint's inventory is the whole story now.
- Revisit the 59 topological crossings if a corpus ever shows a
  scalar surprise re-merged downstream — the detector is the same,
  the filter is one line.
