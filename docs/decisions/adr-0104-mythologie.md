# ADR-0104: The vocabulary's treaty — three strata, one story

- Status: accepted
- Date: 2026-11-05

## Context

The workshop's vocabulary grew by accretion: the initial article
first, then work sessions in separate conversations, each coining its
word as the need arose. Measured on the branch (the 452 bilingual
pairs of the rendered text, the 34-entry glossary, the tutorial, the
server's prompts), the accretion shows its seams:

- **Stranded staging.** French prose says « le staging » 17 times —
  and « la scène » once, in the same sentence pair where English
  says "scene". The borrowed word had not finished docking; the
  stray French translation survived beside it;
- **A French word inside English prose.** The tutorial's English text
  wrote « ⟪registre⟫ » — marked like a word of the language, in the
  wrong tongue, for a notion (registry/registre) that is an
  informatics word with an adopted translation;
- **Poetry against the industry's word.** French had coined
  « la linteuse » for the word every developer already knows: the
  linter. The glossary declared `registry`/`registre` translated,
  yet invented a name where the field has one;
- **One word, two concepts.** « Le tronc » named BOTH the immutable
  kernel corpus (ADR-0103) and "the trunk of the graphs" — the
  generic base formalism of the graph family (scenario S13, "the
  recast trunk") — while the body text of both tongues already said
  "the base"/« la base » for the second;
- **No written rule.** Nothing said which words are translated
  (layer/couche), which are borrowed (staging), which are identical
  (check, slot). The choice was per-session folklore, and the
  glossary — the place meant to be the ledger — did not hold it.

## Options considered

- **Codify the accretion as is.** Write down whatever each term
  happens to be. REJECTED: « la linteuse » obscures the established
  word, the two « tronc » collide in one workshop, the « scène »
  stray stays in the text;
- **Translate everything into French.** check, slot, staging,
  verdict, draft — all French. REJECTED: the borrowed words ARE the
  informatics words; check, slot and Ref are keywords of the data
  language itself, written in the `.ld` files. Translating them
  costs comprehension and lies about the artifacts;
- **Rename freely toward a fresh field.** Ignore the established
  informatics words and pick a new story. REJECTED for the same
  reason — and the choice of field cannot ignore what already
  lives: the tutorial's own opening declares the workshop's field
  ("as in geology, layers sediment"), and the glossary already
  keeps core sample (carottage), lens (lentille), diamond and facet
  there;
- **A treaty of three strata, the story told in the geologist's
  field.** CHOSEN: keep every established informatics word, mark
  the language's words as code, and tell the story — the concepts
  informatics does not name — in ONE field, the one the tutorial
  already declared.

## Decision

1. **Three strata, one rule each.**
   - The **informatics words** keep their established names —
     identical where the field speaks English (staging, check,
     slot, linter, harness, verdict, draft), translated where
     French has the adopted translation (couche, noyau, harnais,
     brouillon, espace, registre). They are never renamed for
     poetry. Henceforth: **linter** in both tongues (« la linteuse »
     is retired), **staging** in both tongues (the « scène » stray
     is corrected);
   - The **lexicon's words** are cited, not narrated: the ⟪…⟫ marks
     signal a glossary entry, and each tongue cites its own term —
     the language's keywords (⟪check⟫, ⟪slot⟫, ⟪Ref⟫, ⟪extend⟫) are
     identical in both tongues because they are code, the
     translated notions keep one entry with two terms (⟪adresse⟫ in
     French, ⟪address⟫ in English, ⟪registre⟫/⟪registry⟫ the same
     entry). A French term never wears the marks inside English
     prose — the measured hole;
   - The **story** — the concepts informatics has no word for — is
     told in ONE field, the geologist's: **socle/bedrock** (the
     immutable kernel corpus, was « le tronc »/the trunk),
     **carrière/quarry** (the disk store of visitor layers, was
     « l'armoire »/the wardrobe), **géologue/geologist** (the
     layer-writing model, was « la plume »/the pen), **colonne
     stratigraphique/stratigraphic column** (the tutorial's
     reading thread, was « colonne vertébrale »/the spine).
     Carottage/core sample keeps its place, and the workshop
     (l'atelier) keeps its name — a workshop is field-neutral.
2. **The two « tronc » split.** The kernel corpus becomes the
   bedrock; the graph family's generic formalism becomes "the
   base"/« la base » — the word the body text already used.
3. **The kernel codes follow the story.** « tronc-occupé » becomes
   « socle-occupé » (bedrock-occupied), « tronc-édité » becomes
   « socle-édité » — the refusal codes keep their shape, the field
   word changes;
4. **The glossary is the treaty's ledger.** The workshop's glossary
   carries the story terms with their two-tongue pairs —
   carrière/quarry, géologue/geologist, socle/bedrock — beside the
   language's notions, every entry a bilingual term and a
   translated definition;
5. **The identifiers stay.** File names, exported types,
   environment variables (penLoop.ts, PenPropose, PEN_*,
   wardrobeClient.ts) keep their established names — renaming them
   is churn without comprehension. The words humans READ (the UI
   text, the prompts, the docs, the glossary) speak the treaty.
   Internal aliases that told the old story follow: TRUNK_LAYER_NAMES
   becomes CANONICAL_LAYER_NAMES, featherNames becomes
   visitorLayerNames;
6. **The treaty is measured.** tests/terminology-checks.mts freezes
   it: the retired words appear in no rendered string, the story
   terms live in the glossary and the refusal codes, the tutorial's
   step ids speak the field, and no en prose wears a French word.

## Consequences

- The tutorial's anchor changes: the step id `plume` becomes
  `geologue`, and the URL hash follows;
- The system prompts speak the treaty: "You are the geologist of
  the Layered Data workshop" / « Tu es le géologue de l'atelier » —
  the model is named in both tongues by one story;
- The kernel is untouched: no diagnostic, no verdict rendering
  changes in the loaded space, and the audit baseline stays
  byte-identical;
- Historical records stay as written: the ADRs 0017-0020 and the
  CHANGELOG keep the vocabulary of their day — the treaty governs
  living text, not archives;
- Comprehension first: a developer meets staging, linter, check and
  slot where they expect them, and one field — not three — carries
  the story the informatics words cannot tell.
