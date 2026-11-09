# ADR-0026: A graphical model editor, generic by formalism data

- Status: proposed (awaiting the human owner's acceptance)
- Date: 2026-11-09

## Context

The workshop reads and displays a model through a lens, and the ＋
composer adds layers, but no surface EDITS a model by hand: the only
ways to grow a runtime layer are the composer (an addition) and the
✎ layer editor (raw source text). A graphical editor was prototyped
in the design canvases (study, interface/protocol, clickable
mockup) with one hard requirement repeated by the owner:

- **genericity**: nothing may know a formalism name — the palette,
  the arc directions, the annotations and the positions must be
  read as FORMALISM DATA through the refinement chain, never
  hardcoded (`places`, `pre`, `post` are Petri facts, the editor
  must not contain them);
- **the gesture proposes, the tribunal decides**: every canvas
  gesture is drafted as `.ld` source text for the living layer and
  judged by the same staging as an addition or an edition — the
  block is the only truth, the canvas is a reading of it.

Two readings of the corpus shape the design. A member container is
a root key that DECLARES a collection (`refines @collection`) and
whose chain declares a collection `type`; union aliases
(`vertices`, `edges`, `arcs` cite other containers) stay out of the
palette by that very discrimination. The arc directions live in the
member record's `source`/`target` `container` overrides — so ONE
arc tool suffices: the direction is inferred, pre and post are never
the user's question. And the kernel judges declared EXPECTATIONS
(`tests` lines), not reference integrity: deleting a cited member
betrays nothing the staging can see.

## Options considered

1. **A per-formalism editor** (the Ardoises approach: togui modules
   handwritten per formalism). Rejected: one editor per formalism
   is the copy-paste drift the kernel exists to avoid, and the
   palette would hardcode what the chain already declares.
2. **A canvas-first store** (positions and members in a side
   structure, `.ld` generated on save). Rejected: two truths. The
   block is the truth; a side store is a stale copy waiting to
   diverge (the Ardoises post-mortem: "code regenerated from data
   destroying source").
3. **Draft-on-block**: the reading services enumerate the formalism
   data through the space, the drafting services rewrite the living
   layer's block as text, and the staging judges every gesture
   whole. Chosen.

## Decision

- `src/application/modelEditing.ts` — the pure reading and drafting
  services, node-testable, no React: `readMemberContainers`
  (palette, discrimination by `refines @collection` + collection
  `type`), `arcContainerBetween` (direction inference from the
  record rules), `readMemberPosition` (grid/polar/relative
  resolution), `readMemberCitations` (the arcs citing a member),
  `draftMemberInsertion` / `draftMemberRemoval` /
  `draftMemberFieldEdition` / `draftMemberPosition` (text surgery
  on the block: `  extend <container>` sections, `    name refines
  <typeReference>` members, `      key = value` fields).
- `src/presentation/modelEditorPage.tsx` — the page (`#editor`):
  model creation through the same staging as the composer, palette
  read from the chain, one arc tool with elastic drag and direction
  inference, vertex drag drafting positions, an inspector on the
  declared record keys, and the verdict banner rendered with the
  workshop's own tongue. Every gesture goes through
  `stageLayerEdition` → `applyStagedEdition` →
  `rewriteLivingAddition`, exactly like the ✎ layer editor.
- The citation guard is an AFFORDANCE, not a second tribunal: the
  kernel accepts deleting a cited member (no declared expectation
  is betrayed); the palette holds the gesture, the banner names the
  citing arcs, and the deletion goes through once they have left.
- `tests/model-editor-checks.mts` — the editor's scenarios over a
  living Petri model: containers read through the chain, aliases
  excluded, place/transition/arc drafted and accepted, direction
  inference, annotation edition in place, positions absolute and
  relative, citations read, deletion in order, rename guard,
  non-graph layer answering an empty palette.

## Consequences

- The bedrock stays read-only by protocol (ADR-0020): only
  runtime-added layers open in the editor; the guards (`socle-édité`,
  `couche-renomme`, `couche-glissée`) apply to every gesture.
- A formalism without collections (a non-graph layer) answers an
  empty palette, without an error — the reading never assumes a
  graph.
- Multi-user presence, CAS versioning and the journal prototyped in
  the design canvases are OUT OF SCOPE here: this page is
  single-user, in-place; the protocol work stays with the future
  server side.
- `npm run verify` (typecheck, structure, the full node test chain,
  vite build) passes on the merged branch: 273 assertions, 0
  failures. The drafting layer tolerates the language's own idioms
  on section and member headers (`extend <c> refines @…`, the merge
  idiom `extend <name>`), re-drafting a position edits it in place,
  the citation guard reads every key (a position's `relative_to`
  included), and string annotations draft as quoted literals.
