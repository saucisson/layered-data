# ADR-0019: Registry as data — the meta-model comes home

- Status: accepted
- Date: 2026-11-05

## Context

ADR-0018 made the closed registry honest: every check tag declares its
contract — where it judges, which slots it must read — and the
verdicts, the lint and the strict arm all read that declaration.
Measured on the trunk corpus:

- the contracts lived in a TypeScript table (`checkContracts`): a
  SECOND registry beside the language — the language could POSE a
  check (`check sperner`) but could not SAY what the check requires;
  every consumer (validation, vacancy detection, lint, staging)
  imported the table, and nothing in the corpus could be cited as
  the registry's source of truth;
- the algorithms lived in another table (`checkRegistry`, nine
  functions): existence in one table, execution in the other, the
  seam between them unwitnessed;
- the meta-model — the model that says what the models may require —
  stood OUTSIDE the language it governs. The critique's phrase: the
  displaced meta-model.

The displaced meta-model is not a cosmetic complaint. A registry
written outside the language cannot be READ by the language's own
tools without a special case: the tutorial cites ⟪registre⟫, the
glossary defines it, yet no layer of the corpus carries it — the
workshop's own inventory had no node for the thing that decides what
the inventory's checks mean.

Rejected diagnosis: "the table works, leave it in TypeScript". The
same diagnosis was rejected for the checks' semantics (ADR-0018); the
registry's SEMANTICS deserves the same home the layers' semantics
found: the corpus.

## Options considered

- **The registry refines `@record`** (a normal layer, heir to the
  ground): REJECTED — measured: the refinement pollutes the
  registry's closure (record's `record` key joins it), and the
  language's `extend` act requires an upstream provider for every
  key written — the ghost-declaration rule would refuse the
  registry's own declarations. The registry stands ALONE: a second
  base (rank 0), keys laid in mode "new", exactly like `record`
  itself.
- **A separate meta-corpus** (the registry as its own assembly,
  loaded beside the kernel): REJECTED — every candidate space carries
  the trunk anyway; a second assembly means two spaces to keep
  coherent, two closure orders, two audit treaties, for a table of
  nine contracts. The kernel's own space can read its own registry.
- **Keep the TypeScript table** (ADR-0018's status quo): REJECTED —
  superseded. ADR-0018 made the closed registry honest; this ADR
  gives the honest registry a home the language can see.
- **The registry as a standing layer, read as data** (chosen): the
  contracts become a kernel layer; existence in the registry is
  existence in the data.

## Decision

1. **The `check-registry` layer** (`formalisms/kernel/check-registry.ld`,
   47th layer of the trunk, inserted after `record`): under
   `specification/<tag>`, every check tag declares its contract —
   its level (layer root or instance), its required slots (each with
   its reading level), its optional slots, its conditional group
   (the slot, the operand, the true and false branches). Written in
   the design language, cited by ⟪registre⟫, visible in the
   workshop like any other layer. It refines NOTHING: it is the
   second base of the trunk.
2. **The contracts are READ, not imported** (`registryContractsOf`):
   the raw registry is read at the nominal anchor
   (`@check-registry/specification/<tag>`); malformed fields are
   read as absent — the kernel stays total, a clause it cannot parse
   is a divergence, never a crash. `vacantChecksOf`, the validation's
   (b)/(b2)/(c) sections, the lint's tag existence and `runChecks`
   all derive from the read; the TypeScript contract table is
   deleted. Existence in the registry is existence in the data: a
   posed tag absent from the layer stays étiquette-inconnue.
3. **The algorithms stay bound in the kernel** (`checkRegistry`, the
   nine functions): execution is code, not data — a layer cannot
   install an algorithm. A tag declared in the data with no bound
   algorithm is refused as « algorithme-absent » by `runChecks` — the
   mirror of étiquette-inconnue: the data promised, the execution
   cannot keep.
4. **The meta-audit** (`registryAuditOf`, wired as the `lintRegistry`
   pass): the seam between the data and the code is itself audited —
   a contract without an algorithm (« contrat-sans-algorithme »), an
   algorithm without a contract (« algorithme-sans-contrat »), an
   unreadable contract (« contrat-illisible »). Measured on the
   trunk: 0/0/0 — the seam is sound.
5. **A new audit treaty**: the executed-constraints contract of
   ADR-0018's follow-up stays out; but the registry layer enters the
   trunk, so the frozen baseline is REGENERATED (couches 46 → 47).
   The baseline is a treaty; changing the trunk changes the treaty.

## Consequences

- The registry is writable IN the language: a fork, a tutorial
  chapter, a candidate space can refine `@check-registry` and add a
  contract — the validation, the vacancy detector and the lint will
  read the refined registry without knowing. The boundary: the
  added contract will bind only when the kernel binds an algorithm
  to it (« algorithme-absent » says so, honestly).
- Refining the registry is a real act with real consequences — the
  closure of the refiner carries the contracts; a workshop hiding
  the registry must justify itself to the meta-audit.
- The kernel keeps its discipline: total (unreadable contracts are
  divergences, not exceptions), bilingual (the four new verdict
  kinds come in French with English mirrors), measured (the
  meta-audit lands in the lint, 0/0/0 on the trunk).
- The critique's displaced meta-model is home: the model that says
  what the models may require is a model — a layer, readable as is
  in the workshop's « Language » tab, counted among the 47.
