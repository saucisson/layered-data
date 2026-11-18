# ADR-0119: Display functions — code legal in exactly one place

- Status: proposed (awaiting the human owner's acceptance)
- Date: 2026-11-18
- Related: issue #288 (L6 of the lens mission), ADR-0103 (frozen bedrock),
  ADR-0107 (the editor), `docs/connection-points.md` (L4 study)

## Context

Lenses are a display stage, semantically inert: the `display`
sub-tree (templates, guards, glyphs) is never read by the checks, the
validation or the space semantics — it only influences pixels (L1,
ADR-0103 keeps the kernel read-only; the corpus changes through
review). L2/L3 gave the vocabulary parameters (dimensions, `path`,
`angle`, declared labels, per-node sizes), but some drawings are
computations, not parameters: a multiplicity (one dot per token), one
input per incoming arc (counted by data equality between `vertex` and
`place.__path`, without dereferencing), a gate shape that grows with
its arity. The vocabulary stays closed on purpose — every genre has a
typed schema — so the remaining power must come from somewhere else.

The rule we want is structural: **code is legal exactly at one place
— the `display` blocks of lenses — and nowhere else.** The language
stays data everywhere else; the parser offers no other code slot.

## Decision

- **Syntax**: a function literal is written between `[[ … ]]` — never
  between quotes. `r = fn (place) [[ 8 + 2 * place.marking ]]`; a whole
  template may be a function: `draw = fn (place, net) [[ … ]]`
  returning an SVG group. The tokenizer gains a `[[ … ]]` token, the
  parser a `fn` slot, the compiler a `__fn:display` sibling of
  `__when:display`.
- **Staging**: the server PARSES the code (syntax check at staging:
  `r = fn (place) [[ 8 + ]]` is refused with `expression-illisible`)
  but NEVER EXECUTES it. A parser test pins that no syntax exists for
  writing code outside a `display` block of a lens.
- **Execution**: only the browser renderers execute the functions, in
  a `try/catch`, per drawn node. Blast radius: the author's own pixels.
- **Inputs are pure data**: the flattened element and the flattened
  model — the functions iterate, traverse, compute, without a single
  API method.
- **Outputs are validated**: either parameters checked against their
  field's schema (numbers, colors, a `d` against the path grammar),
  or **SVG shapes and groups AS DATA** (`{tag: "circle", attrs: {r:
  8}}`), filtered by a whitelist at render time — never markup in
  text, never `innerHTML`. A tree carrying a tag or attribute outside
  the whitelist is ignored at render, never executed. A function that
  throws or leaves the schema falls back to the default with a
  diagnostic.
- **SVG stays the output format**: the workshop's render is already
  SVG, the correspondence is 1:1 and lossless.

## Options considered

1. **Passive SVG fragment hardcoded in the data**
   (`svg = '<circle r="{8 + marking}"/>'` and mini-language variants).
   Rejected: the pattern is not "no SVG" but **no markup in text** — a
   string the data carries and the renderer would believe on parole,
   smuggling its own bounds, hit-testing and attach geometry. What the
   engine must own stays the engine's. Recorded so the question does
   not come back (also in `docs/connection-points.md`).
2. **A general scripting slot anywhere in a layer.** Rejected: the
   language is data everywhere else; one code slot, in lens display
   blocks only, keeps the invariant structural — the parser simply
   has no other slot.
3. **Typed vocabulary only, no code at all.** Rejected for now: it
   covers the corpus's needs today, but multiplicity-style drawings
   are computations; the function slot is the smallest extension that
   covers them without opening the language.

## Consequences

- The tokenizer/parser/compiler gain the `[[ … ]]` token and the `fn`
  slot; a staging verdict `expression-illisible` for unparsable code;
  a parser test proving no code slot exists outside lens `display`
  blocks.
- The renderers resolve `fn` fields per drawn node in a `try/catch`,
  validate outputs against the field schema or the SVG whitelist, and
  fall back to the default with a diagnostic on any fault.
- The server never executes lens code: staging is a syntax check only.
- Tests pin: `r = fn (place) [[ 8 + 2 * place.marking ]]` accepted in a
  lens; `[[ 8 + ]]` refused at staging; a `draw` function rendering a
  multiplicity; a whitelisted-violating tree ignored at render; a
  throwing function falling back with a diagnostic.
