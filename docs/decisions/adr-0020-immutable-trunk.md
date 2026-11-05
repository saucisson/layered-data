# ADR-0020: The immutable trunk — read-only by protocol, not by convention

- Status: accepted
- Date: 2026-11-05

## Context

The trunk (the 47 kernel layers) is read-only — the armoire refuses
`PUT` and `DELETE` on its names (403), and the workshop's editor only
opens on the living layers. Measured on the trunk branch, the
protection is a guard at ONE door plus a UI convention — the mutation
protocols themselves trust their callers:

- `stageLayerEdition` accepts a TRUNK layer name. The edited layer
  "leaves the living context", is judged like a draft, accepted — and
  `applyStagedEdition` REPLACES `space.layers["record"]` in place and
  touches it: measured, `record`'s specification went from the trunk's
  to the edition's in one call. The comment said "the corpus stays
  read-only"; the only thing making it true was the UI filter
  (`editableLayerNames`) — a client, or a careless call site, rewrites
  the trunk's semantics under everyone's feet, and the corpus's frozen
  verdicts become lies;
- `stageLayerAddition` judges a draft against a token space built by
  JOINING the trunk sources with the draft — and the compiler keys the
  layers BY NAME: a draft claiming a trunk name REPLACES the trunk
  layer inside the token space. Measured: a draft claiming `record`
  drew 13 « déclaration-fantôme » verdicts accusing innocent layers
  (everything that extends `record`'s keys through the closure found
  nothing upstream) — the tribunal judged a forgery and named no
  one's crime. And when the forgery happens to be verdict-compatible,
  the draft is silently dropped (`ok` true, nothing applied) — the
  tribunal said nothing at all;
- the pen's proposals flow through the same staging — nothing told
  the model that REFINING the trunk is the language's own composition
  while REPLACING it is a theft.

The immutability of the trunk was an incident of the loading
(KERNEL_LAYER_NAMES) plus an HTTP guard — never a rule of the
protocols that mutate the space.

Rejected diagnosis: "the UI never offers the trunk to the editor, and
the server returns 403 — the trunk is protected enough". The workshop
is not the only client: the staging and edition routes are the
workshop's protocol, the pen's gate and the harnesses' tool. A rule
that lives only in the UI is a convention; a rule that lives in the
route is a protocol. ADR-0018 made the contracts explicit, ADR-0019
gave the registry a home — the trunk deserves its own rule in the
routes that could touch it.

## Options considered

- **Freeze the space object itself** (an immutable Space, a frozen
  `layers` record): REJECTED — the living workshop is built ON
  sanctioned mutation (additions and editions enter the space at
  runtime, the touch protocol is the O18 obligation); freezing the
  whole space would freeze the living layers too, and separating two
  Space classes would fork the kernel's own semantics.
- **Check the name inside the compiler** (refuse duplicate layer
  names at `compileLanguage`): REJECTED — the compiler is domain and
  total; the duplicate arrives only through a staging that JOINS
  sources, and the crime is not the compilation but the claim. The
  compiler faithfully replacing `layerTrees[name]` is what makes the
  token space honest about what the draft would do.
- **Keep the UI filter and the 403, document the convention**:
  REJECTED — that is the status quo; a convention that every caller
  must remember is the displaced meta-model's cousin (ADR-0019): the
  rule about the data living outside the protocols that touch the
  data.
- **Every mutation route carries the trunk's signature and enforces
  it itself** (chosen): `readonlyLayerNames` becomes an explicit
  parameter of the staging, the edition and their acts of application
  — the protocol itself refuses to touch the trunk.

## Decision

1. **The signature travels**: `stageLayerAddition`,
   `applyStagedAddition`, `stageLayerEdition` and
   `applyStagedEdition` take a required `readonlyLayerNames` — the
   list of the layers the route refuses to touch. The workshop passes
   the trunk, the armoire passes the trunk, the harnesses pass the
   trunk; whoever calls a route, the route itself knows what is
   read-only.
2. **« tronc-occupé »**: a draft layer claiming a readonly name is
   refused at the validation step, one verdict per claimed name. The
   verdict names the theft — not the forgery: the tribunal never
   convenes on the token space (a walk against a replaced trunk
   would accuse innocent layers, measured). The refused staging
   compiles nothing: `compiledLanguage` stays null.
3. **« tronc-édité »**: an edition aimed at a readonly layer is
   refused before the tribunal is convened — a trunk layer never
   leaves the living context, never re-enters the judgment: the
   corpus's frozen verdicts stay true. The refusal is a stable
   edition-guard code beside `couche-renomme` and `couche-glissée`.
4. **The acts refuse too** (defense in depth): `applyStagedAddition`
   hard-skips the readonly names, `applyStagedEdition` returns
   without writing — even a caller that ignored the verdicts cannot
   mutate the trunk through the sanctioned routes.
5. **The boundary stays honest**: REFINING a trunk layer is the
   language's own composition — a draft that refines `record` is
   welcome (measured, accepted). The rule forbids replacement, never
   composition. A name claimed by a LIVING layer (not trunk) stays
   skipped by design — the edition path depends on that skip.

## Consequences

- The trunk is immutable wherever the protocols run: workshop, pen
  gate, editor, harnesses — the rule lives in the route, not in the
  caller's memory.
- The pen hears the rule like any verdict: a proposal claiming
  `record` comes back refused « tronc-occupé », rendered in the
  workshop language with the fact's full sentence (measured) — the
  model can correct itself, the loop's budget respected.
- The kernel is untouched: no domain change, no new diagnostic in the
  loaded space — the frozen baseline stays the pre-change treaty,
  byte for byte.
- The UI filter (`editableLayerNames`) and the HTTP 403 remain — as
  conveniences over the protocol's own rule, not as the rule itself.
- Follow-up: the audit baseline needs no regeneration here (the
  trunk's observable behavior is unchanged); a future wiring of
  `runChecks` into the baseline dump would be a new treaty again.
