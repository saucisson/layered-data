# ADR-0101: Checks as contracts — the constraint semantics made nominal, visible, executable

- Status: accepted
- Date: 2026-11-04

## Context

The check tags are DATA (`check simple, nonempty`), inherited by
composition through the closure; the registry resolves them
(`checkRegistry`, nine tags), and `runChecks` is their only runner.
Measured on the trunk corpus:

- 7 local poses, inherited into 37 root-closure étiquettes;
- `runChecks` is called NOWHERE — not by the workbench, not by the
  staging, not by the lint, not even by the audit harness. The
  executed-once cost of the whole corpus: 46 ms, 0 errors, 0
  withdrawals — the trunk is sound, but by unverified luck;
- the withdrawal policy is LOCAL to each check: `simple`, `nonempty`,
  `k-partite` and `arbre` record a `check-vacant` diagnostic when
  they retire, while `oriented`, `dag` (the null ordered pair),
  `containers` and `cardinality` retire in silence — nothing external
  can know when a check will judge;
- `containers` and `cardinality` — two of the nine registry entries,
  the two generic checks of the original kernel — are carried by
  NOTHING in the corpus: every `container =` constraint written in
  the formalisms is decorative;
- the slot contract of `simple` is CONDITIONAL: bound `ordered` true,
  it needs the ordered pair (`end-source`/`end-target`); false, the
  arrows (`arrows`/`arrow-vertex`). That contract was written nowhere
  outside the check's own code — and `checkSlotContracts` recorded the
  reading LEVELS (for the dead-binding rule) but not the REQUIREMENTS.

The constraint semantics composed with nothing: a layer could carry
`sperner` without an `edges` binding and pass every judge — a
constraint that cannot judge, refused by no one. The mirror image of
ADR-0100's order convention: there the meaning was silent, here the
VERIFICATION is silent.

Rejected diagnosis: "the checks work, they just need wiring". The
wiring was never the problem — nothing in the language could SAY
what a check needs before running it. Compositionality is a contract
read without execution.

## Options considered

- **Execute the checks everywhere, always** (make `runChecks` part
  of every validation): rejected — the workbench reads the space
  immutably, the checks record diagnostics as they run, the corpus is
  frozen with its own verdicts; re-executing the whole trunk per
  staging is a cost the protocol does not owe, and the frozen
  baseline would change under it.
- **Delete the dead checks** (`containers`, `cardinality`): rejected —
  they are the original kernel's two generic checks; the registry
  documents the kernel's semantics, not its current usage. The corpus
  carrying no `container =` verification is a finding, not a deletion.
- **An open registry in the data** (checks as layers, defined in the
  language): rejected — that is the meta-model question (ADR-0102's
  territory); this ADR makes the CLOSED registry honest first.
- **The contracts, the inventory, the verdict, the strict arm** (chosen):
  the semantics of every tag declared once, read everywhere.

## Decision

1. **The nominal registry** (`checkContracts`, in `checks.ts`): every
   tag declares WHERE it judges (layer root or instance), WHICH slots
   it requires, its optional slots, and its conditional group — the
   `ordered` binding resolving at the judged address, its instance
   slots read at the operand view's addresses. `checkSlotContracts`
   is DERIVED from it (one source); `containers` and `cardinality`
   enter the registry with explicit empty contracts.
2. **The inventory**: `vacantChecksOf` — a pure detector, reading the
   contracts, never executing the checks. The lint records every
   vacancy as a `check-vacant` diagnostic (measured on the trunk: 79
   contract judgments, 0 vacancies — the baseline is intact).
3. **The verdict**: a POSED check whose required slots are unbound is
   refused as « check-vacant » — the mirror of étiquette-inconnue
   (the posed tag that does not exist), the symmetry of the
   retired assume-fantôme (the signature that judged nothing —
   retired by ADR-0106). The inherited
   instance vacancies stay the lint's: the type binds them, the root
   never sees them.
4. **The strict arm** (`strictChecks`, off by default;
   `PEN_STRICT_CHECKS=1`): the carried checks of the judged layers
   EXECUTE — `runChecks` over the candidate only, their errors
   refused as « check-trahi ». The constraint semantics composes
   with the staging at last, bounded to the candidate: the workshop
   stays immutable, the frozen corpus is never re-executed.

## Consequences

- A check that cannot judge is never silent again: the contract says
  so before the execution, the lint inventories it, the staging
  refuses it when the act can answer for it.
- The withdrawal policy stays free INSIDE each check (a check may
  still judge partially); what is no longer free is claiming the name
  without the means.
- The ADR-0100 discipline holds: the kernel stays total, never an
  exception; the severity is yours — permissive by default, the two
  strict arms opt in.
- Follow-up: wiring `runChecks` into the audit baseline (a new dump
  section) would freeze the executed-constraints contract too; left
  out here — the baseline is the pre-change treaty, a new section is
  a new treaty.
