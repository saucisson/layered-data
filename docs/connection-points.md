# Study — named connection points (issue #286, L4)

Status: **study only — no implementation in this wave.** The need is real
(graphical editors attach wires to *named points* on a shape: an n-ary AND
gate has n inputs and 1 output), but no formalism of the corpus demands it
yet. This note records the candidate, the decisive scenario, and the
decisions left to the maintainer.

## The candidate formalism

An n-ary AND/OR gate: n connection points in input, 1 in output. Two
tracks were considered:

1. **Extend `logic-circuit`** (already in the corpus, with `half-adder` as
   its proof model): gates are already n-ary *in the data* — the arity is
   the count of incoming wires, derived, not declared (see the head comment
   of `formalisms/kernel/logic-circuit.ld`). What is missing is the
   *named point on the shape*: today a wire attaches to the vertex's
   bounds, not to a declared input slot.
2. **Pose an `n-ary-gate` axis** declaring `arity = n` with coherence
   checks on the wires. Drafted and judged by the staging (accepted, see
   `tests/connection-points-checks.mts`), **not merged** — it duplicates
   what the derived reading already gives.

The draft that was staged and judged:

```ld
layer n-ary-gate refines @logic-circuit
  extend specification
    n_ary_gate_type refines @logic-circuit/specification/gate_type
      extend specification
        extend record
          abstract arity
```

with a proof model `three-input` (one `bigand` gate, `arity = 3`, three
input ports, one output port, four wires). Both stage with **0 verdicts**.

## The decisive scenario — dynamic arity

The gate stays at its minimal number of inputs, and connecting a new
incoming wire must **modify the shape to add an input**. This is acquired
by construction: `drawnShape` recomputes from the current space at every
render, so writing the wire (the editor's arc gesture) is enough for the
derived input count to change — the test pins it: after adding a fourth
wire, the derived input count of `bigand` is 4 while the declared `arity`
stays 3, which is exactly the mismatch a coherence check would fire on.

Declared vs derived arity: the living test scenario is the derived one
(a new incoming arc adds an input to the gate). A declared `arity` is a
contract the staging can check; a derived arity is a reading the renderer
can react to. The two are not exclusive — declare for the checks, derive
for the drawing.

## What connection points would be

A named connection point is a **declared datum next to the drawing** —
never a hidden property of the drawing: `{ name, side, offset }` on the
glyph's template, resolved per node like the sizes (L3). The engine keeps
owning the attach: the arc trims on the point's position, the hit-testing
and the bounds stay the engine's. The word `ports` is reserved for them;
the decorative squares on arcs (`ports = 2` of the line glyph today,
used by `petrinet-display`) would be renamed (e.g. `studs`) when real
ports land.

## The embed idea (recorded, not promised)

A display function could return `{tag: "embed", layer, lens}` (whitelist)
and the engine would develop it by drawing the sub-model inside the node —
engine recursion, not function recursion, with a cycle guard (depth or
visited set). "Not very practical, but fun": recorded here, no
implementation promised in this wave.

## Rejected option

**Passive SVG fragment hardcoded in the data**
(`svg = '<circle r="{8 + marking}"/>'` and mini-language variants). The
pattern is not "no SVG" but **no markup in text**: a string the data
carries and the renderer would believe on parole. What the engine must
own (bounds, hit-testing, attach, security) would be smuggled inside the
fragment. The retained duo gives the same power without the risk: a typed
vocabulary for code-free lenses (the `path` genre with a validated `d`,
dimensions, orientation, declared labels — L2/L3) and display *functions*
composing SVG **as data** for the rest (L6), filtered by whitelist at
render time, never `innerHTML`.

## Decisions left to the maintainer

- Merge the `n-ary-gate` axis, or keep the derived arity of
  `logic-circuit` alone?
- Dynamic arity: declared (checkable) vs derived (reactive) — the test
  scenario above is alive; which one does the corpus want?
- When real ports land: rename the arc decoration `ports` → `studs`.
