// The graphical model editor checks: the editor's reading and
// drafting services over the assembled bedrock corpus. GENERICITY
// IS THE CONTRACT — nothing here knows a formalism name: the
// containers, the arc directions and the annotations are read as
// FORMALISM DATA (the `refines @collection` declarations, the
// `type` overrides, the source/target `container` rules of the
// member records), and every gesture is drafted as SOURCE TEXT for
// the living layer, then judged by the staging: the editor
// proposes, the tribunal decides, the block is the only truth.
//
// Scenarios over one living Petri model (created the way the ＋
// composer does): the palette's containers are read through the
// chain (places, transitions, pre_arcs, post_arcs, positions — the
// union aliases vertices/edges/arcs CITE other containers and stay
// out), a place and a transition are drafted and accepted, the arc
// direction is INFERRED from the formalism rules (place →
// transition answers pre_arcs, the other way post_arcs), an
// annotation edition rewrites one field in place, positions are
// drafted and resolved (absolute, then relative through the chain),
// the CITATIONS reading finds the arc that cites a place (the
// kernel judges declared expectations, not reference integrity —
// the palette holds the gesture, the deletion goes through once
// the citing arcs have left), the arc then the place leave in
// order, a renamed layer is refused by the edition guard, and a
// non-graph layer answers an EMPTY palette without a crash.
//
//     node tests/model-editor-checks.mts   (exit 1 on any failure)

import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  assembleLayeredDataKernel,
  KERNEL_LAYER_NAMES,
} from "../src/application/corpus.ts";
import { asLayerName, asLayerPath } from "../src/domain/identifiers.ts";
import { AddressView } from "../src/domain/addresses.ts";
import {
  stageLayerAddition,
  applyStagedAddition,
} from "../src/application/staging.ts";
import {
  stageLayerEdition,
  applyStagedEdition,
  rewriteLivingAddition,
  type LivingAddition,
} from "../src/application/edition.ts";
import {
  readMemberContainers,
  positionContainerOf,
  readMemberNames,
  nextMemberName,
  readMemberPosition,
  readMemberCitations,
  draftMemberInsertion,
  draftMemberRemoval,
  draftMemberRemovalCascade,
  draftMemberFieldEdition,
  draftMemberPosition,
  arcContainerBetween,
  arcLabelKeyOf,
  suggestModelRefines,
  memberReferenceText,
  typeReferenceText,
  type MemberContainer,
} from "../src/application/modelEditing.ts";

// ---- the assertion ledger ------------------------------------------

const failures: string[] = [];
let assertions = 0;

function check(label: string, condition: boolean): void {
  assertions++;
  if (!condition) failures.push(label);
}

// ---- the assembled bedrock and the living workshop -------------------

const corpusDirectory = join(import.meta.dirname, "..", "formalisms", "kernel");
const layerSources = Object.fromEntries(
  KERNEL_LAYER_NAMES.map((layerName) => [
    layerName,
    readFileSync(join(corpusDirectory, layerName + ".ld"), "utf8"),
  ]),
);
const kernel = assembleLayeredDataKernel({ layerSources });

const livingAdditions: LivingAddition[] = [];
const livingLayerNames: string[] = [...KERNEL_LAYER_NAMES];

/** Add a draft the way the ＋ composer does: stage, apply, keep. */
function addLayer({ draftSource }: { draftSource: string }) {
  const staging = stageLayerAddition({
    languageSource: kernel.languageSource,
    previousAdditionSources: livingAdditions.map((addition) => addition.source),
    draftSource,
    livingLayerNames: [...livingLayerNames],
    readonlyLayerNames: [...KERNEL_LAYER_NAMES],
  });
  if (!staging.ok)
    throw new Error(
      "the setup addition was refused: " + JSON.stringify(staging.verdicts),
    );
  const applied = applyStagedAddition({
    space: kernel.space,
    staging,
    knownLayerNames: [...livingLayerNames],
    readonlyLayerNames: [...KERNEL_LAYER_NAMES],
  });
  livingAdditions.push({
    source: draftSource.trim(),
    layerNames: [...applied.newLayerNames],
  });
  livingLayerNames.push(...applied.newLayerNames);
  return applied;
}

/** One gesture of the graphical editor: draft the living layer's
 * source, stage the edition, and on acceptance apply it and rewrite
 * the kept addition — the canvas re-reads the space afterwards. */
function gesture({
  layerName,
  draftedSource,
}: {
  layerName: string;
  draftedSource: string;
}) {
  const edition = stageLayerEdition({
    languageSource: kernel.languageSource,
    livingAdditions,
    livingLayerNames: [...livingLayerNames],
    readonlyLayerNames: [...KERNEL_LAYER_NAMES],
    layerName: asLayerName(layerName),
    editedSource: draftedSource,
  });
  if (!edition.ok) return { ok: false as const, edition };
  const applied = applyStagedEdition({
    space: kernel.space,
    layerName: asLayerName(layerName),
    staging: edition.staging,
    readonlyLayerNames: [...KERNEL_LAYER_NAMES],
  });
  const additionIndex = livingAdditions.findIndex((addition) =>
    addition.layerNames.includes(layerName),
  );
  livingAdditions[additionIndex] = rewriteLivingAddition({
    addition: livingAdditions[additionIndex]!,
    layerName: asLayerName(layerName),
    block: applied.block,
  });
  return { ok: true as const, edition, applied };
}

/** The current source of a living layer, as the editor drafts on it. */
function sourceOf({ layerName }: { layerName: string }): string {
  const addition = livingAdditions.find((candidate) =>
    candidate.layerNames.includes(layerName),
  );
  if (!addition) throw new Error("no living addition holds " + layerName);
  return addition.source;
}

const MODEL = "pn-demo";

// ---- the living model, created the way the editor's form does -------

addLayer({
  draftSource:
    "layer " + MODEL + " refines @petrinet-scheme then @positions-grid",
});

// =====================================================================
// (a) the palette's containers are read through the chain, as
//     FORMALISM DATA — no name is hardcoded
// =====================================================================

const containers = readMemberContainers({ space: kernel.space, model: MODEL });
const names = containers.map((container) => container.name);
const containerOf = (name: string): MemberContainer => {
  const container = containers.find((candidate) => candidate.name === name);
  if (!container) throw new Error("no container " + name);
  return container;
};

/** Indexed access in assertions: a missing element is a test failure,
 * not a silent undefined. */
function at<T>(list: readonly T[], index: number): T {
  const value = list[index];
  if (value === undefined) throw new Error("missing element at index " + index);
  return value;
}

check(
  "(a) the palette reads the Petri containers through the chain",
  ["places", "transitions", "pre_arcs", "post_arcs", "positions"].every(
    (name) => names.includes(name),
  ),
);
check(
  "(a) the union aliases stay OUT of the palette — they CITE other containers, they declare none",
  !names.includes("vertices") &&
    !names.includes("edges") &&
    !names.includes("arcs"),
);
check(
  "(a) places is a vertex container",
  containerOf("places").kind === "sommet",
);
check(
  "(a) the place annotations come from the formalism record",
  containerOf("places").annotationKeys.includes("marking"),
);
check(
  "(a) pre_arcs is an arc container, its direction read from the record rules",
  containerOf("pre_arcs").kind === "arc" &&
    containerOf("pre_arcs").sourceContainer === "places" &&
    containerOf("pre_arcs").targetContainer === "transitions",
);
check(
  "(a) post_arcs points the other way, still from the record rules",
  containerOf("post_arcs").kind === "arc" &&
    containerOf("post_arcs").sourceContainer === "transitions" &&
    containerOf("post_arcs").targetContainer === "places",
);
check(
  "(a) the position container is the one whose record poses x and y",
  positionContainerOf({ containers })?.name === "positions",
);

// =====================================================================
// (b) a place and a transition are drafted and accepted — the
//     gesture proposes, the tribunal decides
// =====================================================================

check(
  "(b) the fresh name of an empty container is honest",
  nextMemberName({ space: kernel.space, model: MODEL, container: "places" }) ===
    "places1",
);

const placeName = nextMemberName({
  space: kernel.space,
  model: MODEL,
  container: "places",
});
const withPlace = draftMemberInsertion({
  block: sourceOf({ layerName: MODEL }),
  container: "places",
  name: placeName,
  typeReference: typeReferenceText({
    address: containerOf("places").memberType,
  }),
  fields: { marking: 1 },
});
const transitionName = nextMemberName({
  space: kernel.space,
  model: MODEL,
  container: "transitions",
});
const withBoth = draftMemberInsertion({
  block: withPlace,
  container: "transitions",
  name: transitionName,
  typeReference: typeReferenceText({
    address: containerOf("transitions").memberType,
  }),
  fields: {},
});
const drawn = gesture({ layerName: MODEL, draftedSource: withBoth });
check(
  "(b) the place and the transition are accepted by the staging",
  drawn.ok === true &&
    drawn.edition.ok === true &&
    drawn.edition.staging.verdicts.length === 0,
);
check(
  "(b) the place crossed the staging — the space serves its marking",
  kernel.space.read({
    layer: asLayerName(MODEL),
    path: asLayerPath(["places", placeName]),
    key: "marking",
  }) === 1,
);
check(
  "(b) the transition crossed the staging too",
  readMemberNames({
    space: kernel.space,
    model: MODEL,
    container: "transitions",
  }).includes(transitionName),
);

// =====================================================================
// (c) the arc direction is INFERRED from the formalism rules —
//     one arc tool, the record rules answer pre or post
// =====================================================================

check(
  "(c) place → transition answers pre_arcs, from the rules alone",
  arcContainerBetween({
    containers,
    fromContainer: "places",
    toContainer: "transitions",
  })?.name === "pre_arcs",
);
check(
  "(c) transition → place answers post_arcs, from the rules alone",
  arcContainerBetween({
    containers,
    fromContainer: "transitions",
    toContainer: "places",
  })?.name === "post_arcs",
);
check(
  "(c) place → place answers nothing — no container declares that direction",
  arcContainerBetween({
    containers,
    fromContainer: "places",
    toContainer: "places",
  }) === null,
);

const arcContainer = containerOf("pre_arcs");
const arcName = nextMemberName({
  space: kernel.space,
  model: MODEL,
  container: arcContainer.name,
});
const withArc = draftMemberInsertion({
  block: sourceOf({ layerName: MODEL }),
  container: arcContainer.name,
  name: arcName,
  typeReference: typeReferenceText({ address: arcContainer.memberType }),
  fields: {
    source: memberReferenceText({
      model: MODEL,
      container: "places",
      member: placeName,
    }),
    target: memberReferenceText({
      model: MODEL,
      container: "transitions",
      member: transitionName,
    }),
  },
});
const arcDrawn = gesture({ layerName: MODEL, draftedSource: withArc });
check("(c) the drafted arc is accepted by the staging", arcDrawn.ok === true);
check(
  "(c) the arc's weight is declared but unset — the abstract annotation reads null, the inspector offers it",
  kernel.space.read({
    layer: asLayerName(MODEL),
    path: asLayerPath([arcContainer.name, arcName]),
    key: "weight",
  }) === null,
);
const arcSource = kernel.space.read({
  layer: asLayerName(MODEL),
  path: asLayerPath([arcContainer.name, arcName]),
  key: "source",
});
check(
  "(c) the arc's source resolves to the place — the citation crossed the diamond",
  arcSource instanceof AddressView &&
    arcSource.path.join("/") === "places/" + placeName,
);

// =====================================================================
// (d) an annotation edition rewrites ONE field in place
// =====================================================================

const withMarking = draftMemberFieldEdition({
  block: sourceOf({ layerName: MODEL }),
  container: "places",
  name: placeName,
  fields: { marking: 2 },
});
const markingDrawn = gesture({ layerName: MODEL, draftedSource: withMarking });
check("(d) the annotation edition is accepted", markingDrawn.ok === true);
check(
  "(d) the re-read marking is the new one — the field was rewritten, not added",
  kernel.space.read({
    layer: asLayerName(MODEL),
    path: asLayerPath(["places", placeName]),
    key: "marking",
  }) === 2,
);
check(
  "(d) the drafted block carries the field exactly ONCE",
  (sourceOf({ layerName: MODEL }).match(/marking = /g) ?? []).length === 1,
);

// =====================================================================
// (e) positions are drafted and resolved — absolute first, then
//     relative through the chain
// =====================================================================

const positionContainer = positionContainerOf({ containers });
if (positionContainer === null) throw new Error("no position container");
const withPosition = draftMemberPosition({
  block: sourceOf({ layerName: MODEL }),
  positionContainer: positionContainer.name,
  name: placeName,
  x: 40,
  y: 60,
  typeReference: typeReferenceText({ address: positionContainer.memberType }),
});
const positionDrawn = gesture({
  layerName: MODEL,
  draftedSource: withPosition,
});
check("(e) the drafted position is accepted", positionDrawn.ok === true);
check(
  "(e) the absolute position resolves to its x and y",
  JSON.stringify(
    readMemberPosition({
      space: kernel.space,
      model: MODEL,
      positionContainer: positionContainer.name,
      name: placeName,
      visited: new Set(),
    }),
  ) === JSON.stringify({ x: 40, y: 60 }),
);

const relativeName = "relative-demo";
const withRelative = draftMemberInsertion({
  block: sourceOf({ layerName: MODEL }),
  container: positionContainer.name,
  name: relativeName,
  typeReference: typeReferenceText({ address: positionContainer.memberType }),
  fields: {
    relative_to: memberReferenceText({
      model: MODEL,
      container: positionContainer.name,
      member: placeName,
    }),
    x: 10,
    y: 5,
  },
});
const relativeDrawn = gesture({
  layerName: MODEL,
  draftedSource: withRelative,
});
check("(e) the relative position is accepted", relativeDrawn.ok === true);
check(
  "(e) the relative position resolves THROUGH the cited position — the chain carries the offset",
  JSON.stringify(
    readMemberPosition({
      space: kernel.space,
      model: MODEL,
      positionContainer: positionContainer.name,
      name: relativeName,
      visited: new Set(),
    }),
  ) === JSON.stringify({ x: 50, y: 65 }),
);

// =====================================================================
// (f) a cited place: the kernel judges declared EXPECTATIONS, not
//     reference integrity — the staging would accept the deletion.
//     The editor holds the gesture at the palette through the
//     CITATIONS reading: the message names the arcs, the deletion
//     goes through once they have left
// =====================================================================

const citations = readMemberCitations({
  space: kernel.space,
  model: MODEL,
  containers,
  container: "places",
  name: placeName,
});
check(
  "(f) the citations reading finds the arc that cites the place",
  citations.length === 1 &&
    at(citations, 0)!.container === arcContainer.name &&
    at(citations, 0)!.name === arcName &&
    at(citations, 0)!.via === "source",
);

// the arc leaves first, then the place — the order the guard teaches
const withoutArc = draftMemberRemoval({
  block: sourceOf({ layerName: MODEL }),
  container: arcContainer.name,
  name: arcName,
});
const arcRemoved = gesture({ layerName: MODEL, draftedSource: withoutArc });
check(
  "(f) the arc's deletion is accepted — nothing cites an arc",
  arcRemoved.ok === true,
);
check(
  "(f) once the arc left, no citation holds the place anymore",
  readMemberCitations({
    space: kernel.space,
    model: MODEL,
    containers,
    container: "places",
    name: placeName,
  }).length === 0,
);
const withoutPlace = draftMemberRemoval({
  block: sourceOf({ layerName: MODEL }),
  container: "places",
  name: placeName,
});
const placeRemoved = gesture({ layerName: MODEL, draftedSource: withoutPlace });
check(
  "(f) once the citations left, the place's deletion is accepted",
  placeRemoved.ok === true,
);
check(
  "(f) the place is gone from the container — the canvas re-reads the truth",
  !readMemberNames({
    space: kernel.space,
    model: MODEL,
    container: "places",
  }).includes(placeName),
);

// =====================================================================
// (g) a renamed layer is refused by the edition guard — an
//     edition edits, it never renames
// =====================================================================

const renamedSource = sourceOf({ layerName: MODEL }).replace(
  "layer " + MODEL + " refines",
  "layer " + MODEL + "-renamed refines",
);
const renamed = gesture({ layerName: MODEL, draftedSource: renamedSource });
check(
  "(g) the renamed model is refused by the edition guard",
  renamed.ok === false &&
    renamed.edition.refusals.includes("couche-renomme") === true,
);

// =====================================================================
// (h) a non-graph layer answers an EMPTY palette, without a crash —
//     the reading is generic, it never assumes a graph
// =====================================================================

addLayer({ draftSource: "layer plain-demo refines @record\n  value = 1" });
const plainContainers = readMemberContainers({
  space: kernel.space,
  model: "plain-demo",
});
check(
  "(h) a layer with no containers answers an empty palette",
  plainContainers.length === 0,
);
check(
  "(h) an empty palette answers no position container",
  positionContainerOf({ containers: plainContainers }) === null,
);

// =====================================================================
// (i) a section header carrying a `refines` clause on the same line
//     (the pn-philosophers-5 idiom) is FOUND — the insertion lands in
//     the existing section, no duplicate `extend` is appended
// =====================================================================

const refinesBlock =
  "layer demo refines @petrinet-scheme\n" +
  "  extend places refines @demo/philosophes/philo1/places\n" +
  "    p1 refines @petrinet-scheme/specification/place_type\n" +
  "      marking = 1\n";
const intoRefinesSection = draftMemberInsertion({
  block: refinesBlock,
  container: "places",
  name: "p2",
  typeReference: "@petrinet-scheme/specification/place_type",
  fields: { marking: 0 },
});
check(
  "(i) the insertion lands in the refines-carrying section — no duplicate section",
  (intoRefinesSection.match(/extend places/g) ?? []).length === 1 &&
    intoRefinesSection.includes(
      "    p2 refines @petrinet-scheme/specification/place_type",
    ),
);
check(
  "(i) the existing member and its fields stay untouched",
  intoRefinesSection.includes(
    "    p1 refines @petrinet-scheme/specification/place_type",
  ) && intoRefinesSection.includes("      marking = 1"),
);

// =====================================================================
// (j) re-drafting the SAME member's position edits it in place —
//     no duplicate position member (the sectionRangeOf bug)
// =====================================================================

const positionContainer2 = positionContainerOf({ containers });
if (positionContainer2 === null) throw new Error("no position container");
const transitionName2 = nextMemberName({
  space: kernel.space,
  model: MODEL,
  container: "transitions",
});
const withTransition2 = draftMemberInsertion({
  block: sourceOf({ layerName: MODEL }),
  container: "transitions",
  name: transitionName2,
  typeReference: typeReferenceText({
    address: containerOf("transitions").memberType,
  }),
  fields: {},
});
check(
  "(j) the second transition is accepted",
  gesture({ layerName: MODEL, draftedSource: withTransition2 }).ok === true,
);
const firstPosition = draftMemberPosition({
  block: sourceOf({ layerName: MODEL }),
  positionContainer: positionContainer2.name,
  name: transitionName2,
  x: 10,
  y: 20,
  typeReference: typeReferenceText({ address: positionContainer2.memberType }),
});
check(
  "(j) the first position draft is accepted",
  gesture({ layerName: MODEL, draftedSource: firstPosition }).ok === true,
);
const secondPosition = draftMemberPosition({
  block: sourceOf({ layerName: MODEL }),
  positionContainer: positionContainer2.name,
  name: transitionName2,
  x: 110,
  y: 120,
  typeReference: typeReferenceText({ address: positionContainer2.memberType }),
});
check(
  "(j) the re-drafted position is accepted",
  gesture({ layerName: MODEL, draftedSource: secondPosition }).ok === true,
);
check(
  "(j) the position member appears exactly ONCE in the positions section — edited in place, not duplicated",
  (
    sourceOf({ layerName: MODEL }).match(
      new RegExp(
        "    " +
          transitionName2 +
          " refines " +
          typeReferenceText({ address: positionContainer2.memberType }).replace(
            /[/@]/g,
            "\\$&",
          ),
        "g",
      ),
    ) ?? []
  ).length === 1,
);
check(
  "(j) the re-read position is the new one",
  JSON.stringify(
    readMemberPosition({
      space: kernel.space,
      model: MODEL,
      positionContainer: positionContainer2.name,
      name: transitionName2,
      visited: new Set(),
    }),
  ) === JSON.stringify({ x: 110, y: 120 }),
);

// =====================================================================
// (k) the citation guard reads EVERY key, not only source/target:
//     a position's `relative_to` cites its upstream member
// =====================================================================

const seatName = nextMemberName({
  space: kernel.space,
  model: MODEL,
  container: "places",
});
const withSeat = draftMemberInsertion({
  block: sourceOf({ layerName: MODEL }),
  container: "places",
  name: seatName,
  typeReference: typeReferenceText({
    address: containerOf("places").memberType,
  }),
  fields: {},
});
check(
  "(k) the seat is accepted",
  gesture({ layerName: MODEL, draftedSource: withSeat }).ok === true,
);
const seatPosition = draftMemberPosition({
  block: sourceOf({ layerName: MODEL }),
  positionContainer: positionContainer2.name,
  name: seatName,
  x: 200,
  y: 200,
  typeReference: typeReferenceText({ address: positionContainer2.memberType }),
});
check(
  "(k) the seat's absolute position is accepted",
  gesture({ layerName: MODEL, draftedSource: seatPosition }).ok === true,
);
// draft the relative_to as a reference line on the new position member
const withRelativePosition = draftMemberInsertion({
  block: sourceOf({ layerName: MODEL }),
  container: positionContainer2.name,
  name: transitionName2 + "-rel",
  typeReference: typeReferenceText({ address: positionContainer2.memberType }),
  fields: {},
});
const relativeSource = withRelativePosition.replace(
  "    " +
    transitionName2 +
    "-rel refines " +
    typeReferenceText({ address: positionContainer2.memberType }),
  "    " +
    transitionName2 +
    "-rel refines " +
    typeReferenceText({ address: positionContainer2.memberType }) +
    "\n      relative_to = " +
    memberReferenceText({
      model: MODEL,
      container: "places",
      member: seatName,
    }) +
    "\n      x = 5\n      y = 5",
);
check(
  "(k) the relative position citing the seat is accepted",
  gesture({ layerName: MODEL, draftedSource: relativeSource }).ok === true,
);
const seatCitations = readMemberCitations({
  space: kernel.space,
  model: MODEL,
  containers,
  container: "places",
  name: seatName,
});
check(
  "(k) the relative_to citation is found — the guard reads beyond source/target",
  seatCitations.some(
    (citation) =>
      citation.container === positionContainer2.name &&
      citation.name === transitionName2 + "-rel" &&
      citation.via === "relative_to",
  ),
);

// =====================================================================
// (l) a string annotation drafts a QUOTED literal — the language's
//     own syntax, judged by the staging
// =====================================================================

const withStringField = draftMemberFieldEdition({
  block: sourceOf({ layerName: MODEL }),
  container: positionContainer2.name,
  name: seatName,
  fields: { system: "polar" },
});
check(
  "(l) the string field drafts quoted",
  withStringField.includes('      system = "polar"'),
);
check(
  "(l) the string field edition is accepted",
  gesture({ layerName: MODEL, draftedSource: withStringField }).ok === true,
);
check(
  "(l) the re-read system is the string",
  kernel.space.read({
    layer: asLayerName(MODEL),
    path: asLayerPath([positionContainer2.name, seatName]),
    key: "system",
  }) === "polar",
);

// =====================================================================
// (m) deleting a member also removes its own position entry — no
//     orphan `positions/<name>` lingers in the block (the cascade)
// =====================================================================

const cascadeName = nextMemberName({
  space: kernel.space,
  model: MODEL,
  container: "places",
});
const withCascadeMember = draftMemberInsertion({
  block: sourceOf({ layerName: MODEL }),
  container: "places",
  name: cascadeName,
  typeReference: typeReferenceText({
    address: containerOf("places").memberType,
  }),
  fields: {},
});
check(
  "(m) the member is accepted",
  gesture({ layerName: MODEL, draftedSource: withCascadeMember }).ok === true,
);
const withCascadePosition = draftMemberPosition({
  block: sourceOf({ layerName: MODEL }),
  positionContainer: positionContainer2.name,
  name: cascadeName,
  x: 300,
  y: 300,
  typeReference: typeReferenceText({ address: positionContainer2.memberType }),
});
check(
  "(m) its position is accepted",
  gesture({ layerName: MODEL, draftedSource: withCascadePosition }).ok === true,
);
const cascadeDraft = draftMemberRemovalCascade({
  block: sourceOf({ layerName: MODEL }),
  container: "places",
  name: cascadeName,
  positionContainer: positionContainer2.name,
});
check(
  "(m) the cascade draft removes BOTH the member and its position entry",
  !cascadeDraft.includes("    " + cascadeName + " refines"),
);
check(
  "(m) the cascade deletion is accepted",
  gesture({ layerName: MODEL, draftedSource: cascadeDraft }).ok === true,
);
check(
  "(m) no orphan position lingers — the block holds no trace of the member",
  !sourceOf({ layerName: MODEL }).includes(cascadeName),
);

// =====================================================================
// (n) an arc's end is re-targeted by a field edition drafting a bare
//     reference — the citation moves to the new member
// =====================================================================

const otherPlace = nextMemberName({
  space: kernel.space,
  model: MODEL,
  container: "places",
});
const withOtherPlace = draftMemberInsertion({
  block: sourceOf({ layerName: MODEL }),
  container: "places",
  name: otherPlace,
  typeReference: typeReferenceText({
    address: containerOf("places").memberType,
  }),
  fields: {},
});
check(
  "(n) the second place is accepted",
  gesture({ layerName: MODEL, draftedSource: withOtherPlace }).ok === true,
);
// a fresh arc between the transition and the new place (post direction)
const postContainer = containerOf("post_arcs");
const postName = nextMemberName({
  space: kernel.space,
  model: MODEL,
  container: postContainer.name,
});
const withPostArc = draftMemberInsertion({
  block: sourceOf({ layerName: MODEL }),
  container: postContainer.name,
  name: postName,
  typeReference: typeReferenceText({ address: postContainer.memberType }),
  fields: {
    source: memberReferenceText({
      model: MODEL,
      container: "transitions",
      member: transitionName2,
    }),
    target: memberReferenceText({
      model: MODEL,
      container: "places",
      member: otherPlace,
    }),
  },
});
check(
  "(n) the post arc is accepted",
  gesture({ layerName: MODEL, draftedSource: withPostArc }).ok === true,
);
const retargeted = draftMemberFieldEdition({
  block: sourceOf({ layerName: MODEL }),
  container: postContainer.name,
  name: postName,
  fields: {
    target: memberReferenceText({
      model: MODEL,
      container: "places",
      member: seatName,
    }),
  },
});
check(
  "(n) the re-target drafts a BARE reference (not a quoted string)",
  retargeted.includes("      target = @" + MODEL + "/places/" + seatName) &&
    !retargeted.includes('target = "@'),
);
check(
  "(n) the re-targeted arc is accepted",
  gesture({ layerName: MODEL, draftedSource: retargeted }).ok === true,
);
check(
  "(n) the citation moved: the new target is cited, the old one is not",
  readMemberCitations({
    space: kernel.space,
    model: MODEL,
    containers,
    container: "places",
    name: seatName,
  }).some(
    (citation) => citation.name === postName && citation.via === "target",
  ) &&
    readMemberCitations({
      space: kernel.space,
      model: MODEL,
      containers,
      container: "places",
      name: otherPlace,
    }).every((citation) => citation.name !== postName),
);

// =====================================================================
// (o) the creation form's default refines is SUGGESTED from the
//     corpus — the first container-bearing layer plus the first
//     position-bearing layer, never a hardcoded name
// =====================================================================

const suggestion = suggestModelRefines({
  space: kernel.space,
  layerNames: [...KERNEL_LAYER_NAMES],
});
check(
  "(o) the suggestion names a container-bearing layer and a position layer",
  suggestion.startsWith("@") && suggestion.includes(" then @"),
);
check(
  "(o) the suggested base declares member containers",
  readMemberContainers({
    space: kernel.space,
    model: (suggestion.split(" ")[0] ?? "").slice(1),
  }).length > 0,
);

// =====================================================================
// (p) the arc label key is read from the arc's declared annotations —
//     the first annotation key reading a number, never "weight" in
//     the code
// =====================================================================

const labeledArc = containerOf("pre_arcs");
const labeledArcName = nextMemberName({
  space: kernel.space,
  model: MODEL,
  container: labeledArc.name,
});
const withLabeledArc = draftMemberInsertion({
  block: sourceOf({ layerName: MODEL }),
  container: labeledArc.name,
  name: labeledArcName,
  typeReference: typeReferenceText({ address: labeledArc.memberType }),
  fields: {
    source: memberReferenceText({
      model: MODEL,
      container: "places",
      member: seatName,
    }),
    target: memberReferenceText({
      model: MODEL,
      container: "transitions",
      member: transitionName2,
    }),
    weight: 3,
  },
});
check(
  "(p) the weighted arc is accepted",
  gesture({ layerName: MODEL, draftedSource: withLabeledArc }).ok === true,
);
check(
  "(p) the label key is found among the declared annotations",
  arcLabelKeyOf({
    space: kernel.space,
    model: MODEL,
    arcContainer: labeledArc,
    arcName: labeledArcName,
  }) === "weight",
);

// =====================================================================
// the ledger
// =====================================================================

console.log(
  "model editor checks: " +
    assertions +
    " assertions, " +
    failures.length +
    " failure(s)",
);
for (const failure of failures) {
  console.log("FAIL " + failure);
}
process.exit(failures.length > 0 ? 1 : 0);
