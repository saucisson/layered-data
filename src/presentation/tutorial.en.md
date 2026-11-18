# The philosophers' dinner, in strata

This tutorial goes from the concrete to the formal, and the code carries the proof. Every listing below is **computed by the application at display time**: the ⟪closure⟫ of one layer of the tutorial corpus, resolved in place, line by line. Every line carries its parentage (the badge of the layer that provides the value, or declares the slot); click it: the card tells where the value comes from, or the chain of ⟪refines⟫ types. The `.ld` files speak the geologist's language: one line per gesture, the layout structures, no JSON.

The tutorial corpus is **dedicated**: nine layers, simpler than the workshop's ⟪bedrock⟫ (90 layers), and its stratigraphic column reads at a glance:

```text
record ─ graph ─ petrinet (metamodel) ─ philosophers (template) ─ philosophers-5 (model)
            └── automaton ─ state-space (metamodels) ─ philosophers-5-state-space (model)
collection — a second root, beside record
```

## The data to represent

A Petri net, the philosophers' dinner. One philosopher: three places (`think`, `eat`, `fork`), two transitions (`take`, `release`); one token in `think`, one in `fork`. The dinner seats five around the table: each `fork` is shared with the right-hand neighbour, taken by his `take`, returned by his `release`. Measured: 15 places, 10 transitions, 25 arcs, every arc of ⟪weight⟫ 1.

In parallel, the state space of the same dinner: an automaton whose states are markings of the net and whose alphabet is its transitions — `graph` → `automaton` → `state-space` → `philosophers-5-state-space`.

Metamodel, model, constraint, parameter: from here on, all of these are a ⟪layer⟫.

## What today's tools do with it

EMF/ECore: the metamodel is a model (EClass, EAttribute, EReference — Ecore itself is written in Ecore, and the reflexive part is the good part). The instance lives in an XMI file; the constraints live in OCL, another language; the drawing lives in a dedicated framework (GMF, Graphiti). Four worlds, four languages: every crossing is a translation, and when the metamodel changes, the copies drift. And the definition does not compose finely: an EPackage imports another, an EClass extends another — no incremental restriction layered on top, no citable template, no partial instance that stays readable.

The more recent work keeps the cut: Langium separates grammar, validation and generation; MPS separates structure and editing languages; the schema languages (JSON Schema, LinkML) validate, they do not refine.

Layered data answers with a single move: one kind of datum (the layer), one act of composition (⟪refines⟫), one reading (the closure walked, ⟪first-wins⟫). Incremental definition by finely composable notions becomes the rule, and the same model reads again under several formalisms: that is what the two chains above show, on the same dinner.

## The minimal bedrock

Two layers declare no parent: they descend from nothing. (The `checks` note below is prose about the language, not a layer of the corpus.)

### record — the slab

An empty ⟪specification⟫, a bare `record`: the language's floor, what every type will refine.

```ldflat:record
```

### collection — the keyed collection

Four open ⟪slot⟫s (`type`, `container`, `minimum`, `maximum`): membership speaks by ⟪key⟫, the type says what a member must refine.

```ldflat:collection
```

Click the `abstract minimum` line: the card says "declared by collection, provided by none" — an open slot stays readable; to lay nothing is to ⟪inherit⟫.

### checks — inline formulas

Since ADR-0109, a ⟪check⟫ carries its formula inline: `check simple { level, judgment { formula, message } }` — the constraint's behavior is written in the language itself (ADR-0105). The tags that need transitive closure (`dag`, `arbre`) keep a built-in algorithm in the kernel until strate 2.

## graph — the base metamodel

Vertices and arcs: two collections, one type per kind, an abstract `identifier` — every instance will lay it. Each arc points its two ends (`source`, `target`), the `container` annotation says where the ends live. Two check tags laid **here** descend into every refinement: `containers` (an arc's ends are vertices of the graph), `cardinality` (a collection respects its bounds).

```ldflat:graph
```

Click the `type` line under `vertices`: the card shows the chain of refined types, from the graph's type down to the slab's `record`. The notions at play: ⟪address⟫ (layer, path), ⟪key⟫, ⟪contract⟫.

## petrinet — the Petri net

⟪Refines⟫ the graph, renames the strata: the vertices become places and transitions, a place's type carries a `marking` (the token count), an arc's type carries a `weight` (still abstract). The ⟪alias⟫es: `vertices = places ∪ transitions` (⟪union⟫ by the `then` act), `edges = arcs` — the graph's checks keep judging the net without knowing it is one.

```ldflat:petrinet
```

## philosophers — the instantiable template

One philosopher alone. The vocabulary is typed (`specification/think`, `eat`, `fork`, `take`, `release`): the types are **data**, the metamodel is a layer like any other. The members refine their types and lay their values: `identifier`, `marking`. The ⟪constraint⟫ reads in the listing: `weight = 1` laid on `arc_type` at the declaration level — no model rewrites it, every arc that refines the type inherits it.

```ldflat:philosophers
```

## philosophers-5 — the model

Five ⟪citation⟫s of the template in the `philosophes` collection (`identifier` 1 to 5): the reader expands, the template's members land qualified (`philo2.think`), the data stays in the template. The three containers each carry a ⟪union⟫ equation; the ring closes on the shared forks: `fk_i` takes philosopher i's fork for philosopher i+1's `take`, `rf_i` returns it — modulo 5. The model's contract travels as data: the cardinality (`minimum = maximum = 5`, judged by the `cardinality` check laid by `graph`) and the expectations (`tests/expect`), replayed by the validation at assembly time.

```ldflat:philosophers-5
```

Click the `weight` line of `fk2`: the winner is `philosophers`, through the type — nobody wrote it in the model.

## automaton — the other reading of the graph

The same `graph`, read as an automaton: the vertices become states, the edges become transitions, plus an alphabet (a collection of symbols). Two ⟪alias⟫es suffice: `vertices = states`, `edges = transitions`. A ⟪viewpoint⟫ is a layer like any other — and a ⟪lens⟫ will draw the same dinner in another formalism without rewriting it.

```ldflat:automaton
```

## multi-glyph display — one template, several overlaid glyphs

A lens `display` template is usually a single glyph (`shape`, `fill`, `stroke`…). When one shape is not enough — a token drawn as a double circle — the template poses a `glyphs` sub-block: each member is one glyph, overlaid in the order written. One grammar rule instead of a new named glyph per composed shape.

```ld
extend display
  glyphs
    ring
      shape = "circle"
      fill = "none"
      stroke = "#455555"
    dot
      shape = "circle"
```

## state-space — the parameterized state space

Refines the automaton, **parameterized by the net**: the `net` slot refines the whole `petrinet` layer — nobody lays it here. A state's type refines the slot: every marking of the net will read inside the state. And the binding (`binding_type`) points at the transitions **through** the slot: ⟪late binding⟫, resolved by the layer that reads, never by the layer that writes. The ⟪parameter⟫ is an address like any other.

```ldflat:state-space
```

## philosophers-5-state-space — the second model

One written line gives the whole space: `override net = @philosophers-5` (⟪override⟫ a slot with a ⟪Ref⟫). Then one laid state: `initial` lays only its delta — `philo1.think marking = 2`, one token more — the rest descends from the net through the state type. And one laid binding: `b1` designates the dinner's `philo1.take` transition, generated by the citation, bound late.

```ldflat:philosophers-5-state-space
```

## The reading gesture: the core sample

To read an ⟪address⟫ is to walk its closure, from the newest layer to the oldest: the ⟪core sample⟫. The first value found wins (⟪first-wins⟫); a hole is not an error — to lay nothing is to ⟪inherit⟫. Unfold the dinner's listing, click the `marking` line of `philo3.fork`: the card shows the winner (`philosophers`, the template) and how many sources were consulted. Click a state's `abstract x` line: "declared by petrinet, provided by none" — the state type's open slot, which the net fills.

This whole tutorial employed only that gesture: write little, inherit the rest, read by core sample. The ⟪order conflict⟫ does not appear here: the tutorial's layers never contradict each other; the workshop shows it on the ⟪bedrock⟫.

## Defining a lens

A ⟪lens⟫ is an ordinary layer that refines a display scheme — `@graph-display` for graphs, or a more specific one — and overrides the `display` fields of each type: `shape`, `label`, `fill`, `stroke`, `arrow`, `ports`. That is the whole mechanism: the editor and the lenses page read the lens's `display` block per type, and fall back to a dashed generic circle for the types the lens does not know. To define one, draft it on the Creation page (`#creation`), or contribute a `.ld` file via pull request — the corpus only changes through review (the bedrock is read-only, ADR-0103). Then: the editor's lens picker lists every lens of the space — the inventory is derived from the data (a layer whose `refines` closure contains a display scheme), not from a hardcoded list, so a lens you just staged appears there without any code change — and its "edit the lens" button opens the lens's DSL on the formalism page.

```ld
layer my-display refines @graph-display
  extend specification
    extend vertex_type
      extend display
        override shape = "circle"
        override fill = "#ffffff"
```

## Resize and rotate

A lens fixes the *default* look of each type; each node can then depart from it with **data**, exactly like the positions. A model (or a viewpoint) that refines `@node-sizes` carries a `sizes` block whose keys name the vertices — each entry poses a `scale` factor and/or an `angle` in degrees. The cascade is the positions' one: the viewpoint decides, else the model carries, else the gabarit's defaults apply — a node without a datum keeps the template's sizes. In the editor, a selected vertex shows two handles: drag the square one to resize, the round one to rotate; the gesture writes the `sizes` entry in the model's source (visible, and it survives a reload), and a double-click on a handle removes the datum. The arcs attach to the effective bounds of the scaled, rotated glyph.

```ld
layer my-buchi refines @moore-traffic-light then @buchi-automaton then @node-sizes
  extend states
    extend green
      accepting = true
  extend sizes
    green refines @node-sizes/specification/size_type
      scale = 2
      angle = 45
```

## To go further

- The workshop (`#formalisms`): the kernel corpus and its real dinner, the layers' ⟪quarry⟫.
- The lenses (`#lenses`): the tree of lenses and viewpoints, a model seen through a look.
- The complete hierarchy (`#hierarchy`): the bedrock's refinement graph.
- Create a formalism (`#creation`): every entry goes through the staging.
- Understand a formalism (`#formalism`): the source, the flattened closure, the lenses.

Every ⟪notion⟫ this page cites carries its one-line definition in a hover tooltip; the workshop says the rest.
