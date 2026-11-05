# ADR-0022: Checks as couples — the constraint's behavior written in the language, judged by the reading machine

- Status: accepted
- Date: 2026-11-05

## Context

ADR-0019 brought the checks' CONTRACTS home: the registry layer declares,
in the language, where each tag judges and which slots it reads. But the
BEHAVIOR still lived in TypeScript — `src/domain/checks.ts`, nine
algorithms. A posed tag names a constraint; what that constraint MEANS
is elsewhere, in a table the data cannot read. The workshop's thesis —
the semantics is the reading of the data — stops at the checks' door.

Three design threads converged to force it open:

- **The alias law.** A renaming is an added synonym; the original name
  survives, and the formulas of the defining layer resolve operatively
  in every descendant. A semantics that travels by refinement needs to
  speak the VOCABULARY of its definer, not slots rebinding at
  refinement time;
- **The ontology of replacement, measured.** Leaves are first-winner
  tips (78 `override`, 2 `override abstract`); members re-merge
  cumulatively; names are extend-only; checks accumulate like members.
  A check re-posed divergently should be a visible doublon, never a
  silent replacement — the slot dilemma (conjunction versus
  first-winner) dissolves: accumulation by construction;
- **The frontier, kept honest.** Seven of the nine checks are
  first-order; `dag` and `arbre` need transitive closure. A declarative
  strate makes the FO part expressible and leaves the TC part declared,
  not sneaked.

## Options considered

- **Keep the algorithm table as the only semantics** (status quo):
  rejected — the contracts became data (ADR-0019) on the promise that
  the behavior would follow; a "kernel never modified" that nobody can
  verify against the data is a discipline, not a structure;
- **A rich constraint DSL** (second-order, power sets, arithmetic,
  merging policies): rejected — it multiplies the semantics (the
  project's thesis is one mechanism), and the bedrock's checks need
  none of it; CUE/Jsonnet-style unification was already rejected in
  ADR-0017's terms;
- **External verification** (an oracle beside the machine): rejected —
  the Python oracle was removed for exactly this reason; the interpreter
  is the reading machine, the witnesses come free;
- **Couples in the language, a first-order fragment, measured against
  the algorithmic strate** (chosen): the behavior becomes data, the
  frontier is displayed, and equivalence is a MEASURED property, not a
  hope.

## Decision

1. **The couple.** `check name { … }` defines the check by posing it —
   defining IS posing, the same gesture. The fields: `level` (the
   reading strate judges at layer roots — `root` today; `instance` is
   the declared next level, refusing itself as « niveau-non-soutenu »
   until then), `condition` (a binding read at the judged address —
   `ordered`, the bedrock's one surviving parameter), and the
   `judgment` blocks (`when`, `formula`, `message`). The couple lands
   in the internal `check-definitions` container — the tenth special
   key, never addressed directly: the block sugar is its only door.
2. **The fragment.** `forall`/`exists` (a comma list is sugar for
   nesting), `=`, `!=`, `not`, `and`, `or`, `=>`, parentheses — and
   nothing else. A TERM in proposition position is the existence
   predicate of free logic: a term may fail to denote (an abstract
   slot, a masked member) and the sentence says so instead of guessing.
   The non-emptiness of a domain is `exists x in D: x = x` — the
   fragment has no `true` literal, and one member suffices.
   Quantifier domains are named collections: finite, the walk always
   terminates. No second order, no power sets, no arithmetic — `count`
   and `reachable` are the declared strate 2; `dag` and `arbre` say so
   in the registry, they do not sneak in here.
3. **The universe is the definer's vocabulary.** The formulas speak
   `edges`, `arrows`, `vertex`, `source`, `target` — slash paths
   anchored at a quantified variable or the judged address, one key
   read per segment: the same reading machine, no new resolver. The
   name-slots (`vertices`, `edges`, `arrows`) and role-slots
   (`arrow-vertex`, `end-source`, `end-target`) are DEAD for the
   declarative strate — the design's purge; the algorithmic strate
   reads them until its retirement. One binding survives: `ordered`,
   the parameter channel — bindings carry values, not names.
4. **The doublon rule.** A couple is never REPLACED. The canonical
   identity is syntactic, up to the renaming of quantified variables,
   over the ENTIRE couple (level, condition, judgments in order) —
   semantic equivalence never searches for a proof. A divergent
   re-pose is a validation verdict (« check-redéfini », naming the
   definer then the re-poser); an identical re-pose is tolerated
   (idempotence — the union motif). Only poses CO-VISIBLE at one
   address confront each other: two sibling branches never meet, the
   geometry of the refinement is the geometry of the rule. O15
   ("one semantics per registry") becomes structural: the redefinition
   the algorithmic strate could only deplore, the language now refuses.
5. **Readability judged at assembly, never at execution.** The
   validation's new walk reads every pose (deduplicated by its source
   address): « niveau-non-soutenu » (a level the reading does not
   judge at yet), « condition-manquante » (a `when` without a
   condition), « formule-illisible » (the interpreter's own error,
   verbatim), « gabarit-hors-de-portée » (a message template naming a
   term outside its judgment's quantified scope — checked at pose
   time, never a runtime surprise). The execution never meets a couple
   it cannot read.
6. **The witnesses are free.** A falsified universal ships the
   assignment that falsified it — COMPLETE, and ALL of them: the
   algorithmic strate breaks at the first finding (one verdict per
   cause), the declarative one ships every falsified judgment. The
   templates render on the witnesses: `{x}` the member's key, `{x*}`
   the address tuple — one quoting across both strates. The
   interpreter is measured — one step per member enumerated, one per
   term resolved, a budget guards the walk; a judgment that overruns
   is « formule-épuisée »: a diagnostic, never a silent pass.
7. **Two strates, one execution.** The algorithmic table (ADR-0019's
   registry binding) stays THE execution of the bedrock — 79 contract
   judgments, 0 vacancies, unchanged. `runChecksFO` is the
   declarative strate, and specification-properties MEASURES the two
   against each other: two probes written in the language (a
   hypergraph instance carrying the four causes — arête multiple,
   sommet répété, arête vide; a digraph instance carrying parallel
   arcs, a loop, and a LEGAL 2-cycle), the same violations, address by
   address, tag by tag, once the witness sets are read unordered —
   the symmetric pairs and the failed disjuncts of one cause fold
   into one.
8. **hypergraph poses its law.** The named restriction's two checks
   become two couples: `simple` (four judgments, the two branches of
   `ordered` — the multiset lens intra-edge, the set lens between
   edges, the ordered pair for the arcs), `nonempty` (one judgment —
   an edge without a denoting arrow is empty). The set equality
   ranges `forall v in vertices`: the declared universe of the
   definer. Measured: the bedrock poses 2 couples, the validation
   stays silent, the algorithmic strate finds nothing to judge and
   the declarative one agrees — no violation, no exhaustion.

## Consequences

- The kernel's reading semantics is untouched: no special key becomes
  writable, no read changes; the audit baseline is regenerated for
  exactly what the new container makes observable — the `check-definitions`
  special reads (null everywhere but the carrier, which designates
  `@hypergraph/check-definitions` down its whole posterity) and the
  stats line, which gains `couples: 2`;
- New vocabulary, bilingual: verdict kinds « check-redéfini »,
  « niveau-non-soutenu », « condition-manquante »,
  « formule-illisible », « gabarit-hors-de-portée », and the
  diagnostics « formule-illisible », « formule-épuisée » — every
  refusal names its ADR;
- The grammar grows one form, not one act: `check name` followed by a
  block. A definition names ONE check; the tags `simple, nonempty`
  accumulate in `checks` exactly as before, so the registry's
  contracts and the algorithmic strate see the same poses;
- The algorithmic strate becomes, in principle, measurable cruft:
  the day every tag carries a couple, the table retires. `dag` and
  `arbre` stay algorithmic until strate 2 names `reachable`;
- Negative, assumed: the formulas judge inside the declared universe —
  an end pointing outside `vertices` is invisible to the set equality;
  the bedrock's containers guarantee the containment, and a corpus
  that lies is judged by its own vocabulary;
- Negative, assumed: the declarative strate reports each falsified
  judgment separately — an edge condemned for repetition also appears
  in its doublon pairs when its end-set matches, where the
  algorithmic strate short-circuits (one verdict per cause). The
  harnesses compare SETS; the probes separate the causes; the
  difference is the design's, not a defect.

## Future improvements

- Strate 2: `count` and `reachable` as named primitives — `dag` and
  `arbre` become couples; the registry's TC declarations retire;
- The `instance` level: couples judged at the arc addresses, where
  the type is in the closure;
- Retire the algorithmic table when every registry tag carries a
  couple — the equivalence harnesses are the evidence.
