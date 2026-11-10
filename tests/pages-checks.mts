// The pages checks: the three new surfaces of the workshop — the
// hierarchy page (the complete refinement graph), the formalism
// page (the DSL of a layer, the DSL of its complete flattened
// closure, the lenses), the creation page (the session ledger) —
// rest on four pure modules this harness pins: the flattened-DSL
// serializer (application), the lens drawing (the extraction the
// workshop's panel ④ and the formalism page share), the session
// ledger (write once, materialize everywhere, never twice), and
// the refinement DAG the hierarchy page lays out.
//
//     node tests/pages-checks.mts   (exit 1 on any failure)

import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  assembleLayeredDataKernel,
  assembleTutorialKernel,
  KERNEL_LAYER_NAMES,
  TUTORIAL_LAYER_NAMES,
} from "../src/application/corpus.ts";
import { asLayerName, asLayerPath } from "../src/domain/identifiers.ts";
import { AddressView } from "../src/domain/addresses.ts";
import { runChecks } from "../src/domain/checks.ts";
import { listingVisibleLines } from "../src/presentation/tutorialMarkdown.ts";
import type { FlattenedSection } from "../src/application/flattenSource.ts";
import {
  countFlattenedSectionLines,
  serializeFlattenedLayerText,
  writeFlattenedLayerSections,
  writeFlattenedLayerSource,
} from "../src/application/flattenSource.ts";
import {
  materializeSessionAdditions,
  readSessionAdditions,
  readSessionVersion,
  writeSessionAddition,
} from "../src/application/session.ts";
import { buildWorkshopLook } from "../src/presentation/lensDrawing.ts";
import {
  computeGraphLayout,
  RefinementDag,
} from "../src/presentation/workshopInventory.ts";

// ---- the assertion ledger ------------------------------------------

const failures: string[] = [];
let assertions = 0;

function check(label: string, condition: boolean): void {
  assertions++;
  if (!condition) failures.push(label);
}

// ---- the assembled corpus ------------------------------------------

const corpusDirectory = join(import.meta.dirname, "..", "formalisms", "kernel");
const layerSources = Object.fromEntries(
  KERNEL_LAYER_NAMES.map((layerName) => [
    layerName,
    readFileSync(join(corpusDirectory, layerName + ".ld"), "utf8"),
  ]),
);
const kernel = assembleLayeredDataKernel({ layerSources });

// =====================================================================
// (a) the flattened DSL of the formalism page — the closure resolved
//     in place, the provenance kept, refines absent
// =====================================================================

const flatWb1 = writeFlattenedLayerSource({
  space: kernel.space,
  layer: asLayerName("wb1"),
});
const flatWb1Lines = flatWb1.split("\n");

/** Indexed access in assertions: a missing element is a test failure,
 * not a silent undefined. */
function at<T>(list: readonly T[], index: number): T {
  const value = list[index];
  if (value === undefined) throw new Error("missing element at index " + index);
  return value;
}

check(
  "(a) the flattened DSL names its view — layer wb1-flat, never a layer of the corpus",
  flatWb1Lines.some((line) => line === "layer wb1-flat") &&
    at(flatWb1Lines, 0).startsWith("// wb1 — the complete flattened formalism"),
);
check(
  "(a) the diamond reads flattened: e1 carries weight = 3 provided by wb1, e2 inherits weight = 1 provided by weighted-hypergraph",
  flatWb1Lines.some(
    (line) => line.trim() === "weight = 3  // provided by wb1",
  ) &&
    flatWb1Lines.some(
      (line) =>
        line.trim() === "weight = 1  // provided by weighted-hypergraph",
    ),
);
check(
  "(a) the abstract slots speak the language's gesture — abstract identifier, declared by multihypergraph, provided by none",
  flatWb1Lines.some(
    (line) =>
      line.trim() ===
      "abstract identifier  // declared by multihypergraph, provided by none",
  ),
);
check(
  "(a) no key line of the flattened DSL carries refines — the hierarchy is what the view removes (the word may live inside a note's data, never as a key)",
  flatWb1Lines.every((line) => !/^\s*refines(\s|=)/.test(line)),
);
check(
  "(a) the provenance travels as a comment on every entry line",
  flatWb1Lines
    .slice(4)
    .every((line) => line.trim() === "" || line.includes("//")),
);

const flatGraph = writeFlattenedLayerSource({
  space: kernel.space,
  layer: asLayerName("graph"),
});
check(
  '(a) the purity of the graph reads flattened: checks = ["simple", "nonempty"] provided by hypergraph',
  flatGraph
    .split("\n")
    .some(
      (line) =>
        line.trim() ===
        'checks = ["simple", "nonempty"]  // provided by hypergraph',
    ),
);
check(
  "(a) the references stay references — @graph/edge_type, not a copied tree",
  flatGraph
    .split("\n")
    .some((line) => line.trim().startsWith("edge_type = @graph/edge_type  //")),
);

// The foldable flattened DSL (2.24.1): the page renders a structure,
// the artifact stays the text — the two must agree byte for byte.
const flatWb1Text = writeFlattenedLayerSections({
  space: kernel.space,
  layer: asLayerName("wb1"),
});
check(
  "(a) the foldable structure serializes to the same text — the page folds lines, it never rewrites them (wb1)",
  serializeFlattenedLayerText({ text: flatWb1Text }) === flatWb1,
);
const flatDinnerText = writeFlattenedLayerSections({
  space: kernel.space,
  layer: asLayerName("pn-philosophers-5"),
});
const flatDinnerLines = writeFlattenedLayerSource({
  space: kernel.space,
  layer: asLayerName("pn-philosophers-5"),
}).split("\n");
check(
  "(a) the foldable structure serializes to the same text (the dinner — 12 000+ lines)",
  serializeFlattenedLayerText({ text: flatDinnerText }) ===
    flatDinnerLines.join("\n"),
);
check(
  "(a) the fold counts what it hides: the sections of the dinner cover exactly its serialized lines (header included)",
  flatDinnerText.headerLines.length === 4 &&
    flatDinnerText.sections.reduce(
      (total, section) => total + countFlattenedSectionLines({ section }),
      0,
    ) ===
      flatDinnerLines.length - 4,
);
check(
  "(a) the dinner folds: at least one root section carries nested sections — the +N badge never lies",
  flatDinnerText.sections.some((section) => section.sections.length > 0) &&
    flatDinnerText.sections.some(
      (section) =>
        countFlattenedSectionLines({ section }) > 1 + section.sections.length,
    ),
);

// =====================================================================
// (b) the lens drawing of the formalism page — the exact discipline
//     of panel ④ (the extraction the workshop now calls too)
// =====================================================================

const dinnerGenericLook = buildWorkshopLook({
  space: kernel.space,
  selectedView: "graph-display",
  currentLayer: "pn-philosophers-5",
});
check(
  "(b) the generic lens dresses the dinner: 25 vertices, 25 arcs, all dressed",
  dinnerGenericLook.vertices.length === 25 &&
    dinnerGenericLook.edges.length === 25 &&
    dinnerGenericLook.applicability.dressed === 25 &&
    dinnerGenericLook.applicability.total === 25,
);
const dinnerPetriLook = buildWorkshopLook({
  space: kernel.space,
  selectedView: "petrinet-display",
  currentLayer: "pn-philosophers-5",
});
check(
  "(b) the Petri lens dresses the dinner with its own shapes — ellipses for the places, rectangles for the transitions",
  dinnerPetriLook.vertices.length === 25 &&
    dinnerPetriLook.vertices.filter(
      (vertex) =>
        vertex.drawn !== null && vertex.drawn.spec.shape === "ellipse",
    ).length === 15 &&
    dinnerPetriLook.vertices.filter(
      (vertex) =>
        vertex.drawn !== null && vertex.drawn.spec.shape === "rectangle",
    ).length === 10,
);
const dinnerKahnLook = buildWorkshopLook({
  space: kernel.space,
  selectedView: "kahn-display",
  currentLayer: "pn-philosophers-5",
});
check(
  "(b) the Kahn lens on the dinner is a legal degradation: it dresses, with the generic shapes it inherited",
  dinnerKahnLook.applicability.dressed === 25 &&
    dinnerKahnLook.vertices.every((vertex) => vertex.drawn !== null),
);
const diamondLook = buildWorkshopLook({
  space: kernel.space,
  selectedView: "graph-display",
  currentLayer: "wb1",
});
check(
  "(b) the diamond through the generic lens: 3 circles, 2 lines, the weights read through the view — 3 and 1",
  diamondLook.vertices.length === 3 &&
    diamondLook.edges.length === 2 &&
    diamondLook.edges.map((edge) => edge.weight).join(",") === "3,1",
);
const recordLook = buildWorkshopLook({
  space: kernel.space,
  selectedView: "graph-display",
  currentLayer: "record",
});
check(
  "(b) a layer without vertices collection: the lens has nothing to dress, the reading stays honest (0 vertices, applicability −1)",
  recordLook.vertices.length === 0 &&
    recordLook.applicability.dressed === -1 &&
    recordLook.applicability.total === -1,
);
const viewpointLook = buildWorkshopLook({
  space: kernel.space,
  selectedView: "pn-philosophers-5-course",
  currentLayer: "record",
});
check(
  "(b) a viewpoint imposes its own model: the course resolves the dinner as model, the Petri lens as display, and decides the positions",
  viewpointLook.model === "pn-philosophers-5" &&
    viewpointLook.lens === "petrinet-display" &&
    viewpointLook.viewpointDecidesPositions === true,
);

// =====================================================================
// (c) the session ledger of the creation page — written once,
//     materialized everywhere, never twice
// =====================================================================

const draftSource = [
  "layer draft-pages-checks refines @wb1",
  "  extend arcsAB",
  "    e3 refines @wb1/specification/arcAB_type",
  "      source = @wb1/left/a1",
  "      target = @wb1/right/b1",
].join("\n");
const versionBefore = readSessionVersion();
writeSessionAddition({
  addition: { source: draftSource, layerNames: ["draft-pages-checks"] },
});
check(
  "(c) the write moves the ledger: one addition kept, the version follows",
  readSessionAdditions().length === 1 &&
    readSessionVersion() === versionBefore + 1,
);
const materialized = materializeSessionAdditions({ kernel });
check(
  "(c) the materialization stages and applies the addition against the corpus: the layer enters the space, its block and source are counted",
  materialized.layerNames.includes("draft-pages-checks") &&
    "draft-pages-checks" in kernel.space.layers &&
    materialized.sources.length === 1 &&
    (materialized.blocks["draft-pages-checks"] ?? "").includes(
      "layer draft-pages-checks",
    ),
);
const layerCountAfterFirst = materialized.layerNames.length;
const reMaterialized = materializeSessionAdditions({ kernel });
check(
  "(c) the materialization is idempotent: the same ledger materializes to the same layers, sources and blocks — never twice",
  reMaterialized.layerNames.length === layerCountAfterFirst &&
    reMaterialized.sources.length === materialized.sources.length &&
    Object.keys(reMaterialized.blocks).length ===
      Object.keys(materialized.blocks).length,
);
const otherKernel = assembleLayeredDataKernel({ layerSources });
const otherMaterialized = materializeSessionAdditions({ kernel: otherKernel });
check(
  "(c) another kernel (another page) materializes the same session independently — the replay is deterministic",
  otherMaterialized.layerNames.length === layerCountAfterFirst &&
    "draft-pages-checks" in otherKernel.space.layers,
);
const sessionDag = new RefinementDag({
  space: kernel.space,
  layerNames: reMaterialized.layerNames,
});
check(
  "(c) the session layer enters the refinement DAG of the hierarchy page: it refines wb1, its closure crosses the diamond",
  sessionDag.targetsOf("draft-pages-checks").join(",") === "wb1" &&
    sessionDag.ancestorsOf("draft-pages-checks").has("weighted-bipartite") &&
    sessionDag.ancestorsOf("draft-pages-checks").has("weighted-hypergraph"),
);
const flatDraft = writeFlattenedLayerSource({
  space: kernel.space,
  layer: asLayerName("draft-pages-checks"),
});
check(
  "(c) the session layer flattens like any layer: its own key, its inherited weight — first-winner across the session boundary",
  flatDraft.split("\n").some((line) => line.includes("weight = 1")) &&
    flatDraft
      .split("\n")
      .some((line) =>
        line.trim().startsWith("e3 = @draft-pages-checks/arcsAB/e3"),
      ),
);

// =====================================================================
// (d) the refinement DAG of the hierarchy page — the whole corpus,
//     measured before the layout lays it out
// =====================================================================

const corpusDag = new RefinementDag({
  space: kernel.space,
  layerNames: KERNEL_LAYER_NAMES,
});
check(
  "(d) the corpus DAG knows the multiple inheritance: the diamond layer refines bipartite-digraph then weighted-hypergraph, and wb1 hangs from it",
  corpusDag.targetsOf("weighted-bipartite").join(",") ===
    "bipartite-digraph,weighted-hypergraph" &&
    corpusDag.targetsOf("wb1").join(",") === "weighted-bipartite",
);
check(
  "(d) the closure of the dinner reaches the bases — record and multihypergraph are in it",
  corpusDag.ancestorsOf("pn-philosophers-5").has("record") &&
    corpusDag.ancestorsOf("pn-philosophers-5").has("multihypergraph"),
);
check(
  "(d) the descendants of the base cover the family — more than thirty layers descend from multihypergraph",
  corpusDag.descendantsOf("multihypergraph").size > 30,
);
const layout = computeGraphLayout({
  layerNames: [...KERNEL_LAYER_NAMES],
  dag: corpusDag,
});
const secondLayout = computeGraphLayout({
  layerNames: [...KERNEL_LAYER_NAMES],
  dag: corpusDag,
});
check(
  "(d) the layout is deterministic: two passes place every layer at the same pixel — the hierarchy page is measured, not drawn",
  KERNEL_LAYER_NAMES.every(
    (layerName) =>
      JSON.stringify(layout.position(layerName)) ===
      JSON.stringify(secondLayout.position(layerName)),
  ) && layout.rows.length > 1,
);

// =====================================================================
// (e) the tutorial corpus — the dedicated ten-layer hierarchy the
//     markdown tutorial flattens, measured like any corpus
// =====================================================================

const tutorialDirectory = join(
  import.meta.dirname,
  "..",
  "formalisms",
  "tutorial",
);
const tutorialLayerSources = Object.fromEntries(
  TUTORIAL_LAYER_NAMES.map((layerName) => [
    layerName,
    readFileSync(join(tutorialDirectory, layerName + ".ld"), "utf8"),
  ]),
);
const tutorial = assembleTutorialKernel({ layerSources: tutorialLayerSources });
check(
  "(e) the tutorial corpus assembles clean — nine layers, no verdict, its tests replayed",
  TUTORIAL_LAYER_NAMES.length === 9 &&
    tutorial.validation.verdicts.length === 0 &&
    tutorial.validation.stats.tests === 7 &&
    tutorial.validation.stats.trahis === 0,
);

const dinnerPlaces = tutorial.space
  .keys({ layer: asLayerName("philosophers-5"), path: asLayerPath(["places"]) })
  .filter((key) => key.startsWith("philo"));
const dinnerTransitions = tutorial.space
  .keys({
    layer: asLayerName("philosophers-5"),
    path: asLayerPath(["transitions"]),
  })
  .filter((key) => key.startsWith("philo"));
const dinnerArcs = tutorial.space
  .keys({ layer: asLayerName("philosophers-5"), path: asLayerPath(["arcs"]) })
  .filter(
    (key) =>
      key.startsWith("philo") || key.startsWith("fk") || key.startsWith("rf"),
  );
check(
  "(e) the dinner measures as the tutorial claims: 15 places, 10 transitions, 25 arcs — the citations land qualified, the ring closes",
  dinnerPlaces.length === 15 &&
    dinnerTransitions.length === 10 &&
    dinnerArcs.length === 25 &&
    dinnerPlaces.includes("philo3.fork") &&
    dinnerArcs.includes("fk5") &&
    dinnerArcs.includes("rf1"),
);
const dinnerWeightScan: unknown[] = [];
const dinnerWeight = tutorial.space.read({
  layer: asLayerName("philosophers-5"),
  path: asLayerPath(["arcs", "fk2"]),
  key: "weight",
  scan: dinnerWeightScan as never,
});
check(
  "(e) the ring arc inherits its weight from the template's type — the model never wrote it",
  dinnerWeight === 1 && dinnerWeightScan.length === 2,
);
const dinnerForkSource = tutorial.space.read({
  layer: asLayerName("philosophers-5"),
  path: asLayerPath(["arcs", "fk5"]),
  key: "source",
});
check(
  "(e) the ring's last arc takes the fifth fork to the first philosopher — modulo 5, as authored",
  dinnerForkSource instanceof AddressView &&
    dinnerForkSource.layer === "philosophers-5" &&
    dinnerForkSource.path.join("/") === "places/philo5.fork",
);
check(
  "(e) the dinner declares its own cardinality contract: five philosophers, five seats, the bounds read through the collection's specification",
  tutorial.space.read({
    layer: asLayerName("philosophers-5"),
    path: asLayerPath(["philosophes", "specification", "collection"]),
    key: "minimum",
  }) === 5 &&
    tutorial.space.read({
      layer: asLayerName("philosophers-5"),
      path: asLayerPath(["philosophes", "specification", "collection"]),
      key: "maximum",
    }) === 5 &&
    tutorial.space.keys({
      layer: asLayerName("philosophers-5"),
      path: asLayerPath(["philosophes"]),
    }).length === 5,
);
check(
  "(e) the checks carried since graph judge the whole tutorial corpus and find nothing to say",
  TUTORIAL_LAYER_NAMES.every(
    (layerName) =>
      runChecks({ space: tutorial.space, layer: layerName }).length === 0,
  ),
);

const stateMarking = tutorial.space.read({
  layer: asLayerName("philosophers-5-state-space"),
  path: asLayerPath(["states", "initial", "places", "philo1.think"]),
  key: "marking",
});
const stateBinding = tutorial.space.read({
  layer: asLayerName("philosophers-5-state-space"),
  path: asLayerPath(["alphabet", "b1"]),
  key: "transition",
});
check(
  "(e) the late binding resolves: the state lays its delta (marking = 2), the binding designates the dinner's philo1.take through the slot",
  stateMarking === 2 &&
    stateBinding instanceof AddressView &&
    stateBinding.layer === "philosophers-5" &&
    stateBinding.path.join("/") === "transitions/philo1.take",
);

const flatTutorialLayer = (layerName: string) =>
  writeFlattenedLayerSections({
    space: tutorial.space,
    layer: asLayerName(layerName),
  });
const walkTutorialSections = (
  sections: FlattenedSection[],
  visit: (section: FlattenedSection) => void,
): void => {
  for (const section of sections) {
    visit(section);
    walkTutorialSections(section.sections, visit);
  }
};
let sectionAgreement = true;
let targetAgreement = true;
for (const layerName of TUTORIAL_LAYER_NAMES) {
  walkTutorialSections(flatTutorialLayer(layerName).sections, (section) => {
    const expectedLine =
      section.value === null
        ? "abstract " + section.key + "  // "
        : section.key + " = " + section.value + "  // ";
    if (!section.line.startsWith(expectedLine)) sectionAgreement = false;
    if (section.node !== (section.target.key === null)) targetAgreement = false;
    if (
      section.node &&
      section.target.path[section.target.path.length - 1] !== section.key
    ) {
      targetAgreement = false;
    }
    if (!section.node && section.target.key !== section.key)
      targetAgreement = false;
  });
}
check(
  "(e) every flattened section carries its parts: the line agrees with the key and the value, the click target points at the key (a value) or the node (a block)",
  sectionAgreement && targetAgreement,
);
check(
  "(e) the tutorial's listings open by size: the metamodels stay under the fold threshold, the two models of the dinner cross it — the widget opens them folded, never truncated",
  listingVisibleLines({ sections: flatTutorialLayer("graph").sections }) <=
    250 &&
    listingVisibleLines({
      sections: flatTutorialLayer("state-space").sections,
    }) <= 250 &&
    listingVisibleLines({
      sections: flatTutorialLayer("philosophers-5").sections,
    }) > 250 &&
    listingVisibleLines({
      sections: flatTutorialLayer("philosophers-5-state-space").sections,
    }) > 250,
);

// =====================================================================
// the ledger
// =====================================================================

console.log(
  "pages checks: " +
    assertions +
    " assertions, " +
    failures.length +
    " failure(s)",
);
for (const failure of failures) {
  console.log("FAIL " + failure);
}
process.exit(failures.length > 0 ? 1 : 0);
