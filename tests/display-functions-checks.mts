// Display functions (ADR-0119, issue #288, L6): the ONE code slot of
// the language — `fn (params) [[ expression ]]` — legal only inside
// the `display` blocks of lenses. These checks pin: the tokenizer
// token, the parser slot (and its absence everywhere else), the
// staging syntax verdict (expression-illisible — the server parses
// but never executes), the render-side resolution against the field
// schema, the SVG whitelist, and the fallback on a throwing function.

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { assembleLayeredDataKernel, KERNEL_LAYER_NAMES } from "../src/application/corpus.ts";
import { applyStagedAddition, stageLayerAddition } from "../src/application/staging.ts";
import { asLayerName, asLayerPath } from "../src/domain/identifiers.ts";
import { parseLanguage } from "../src/domain/language/parser.ts";
import { tokenizeLanguage } from "../src/domain/language/tokenizer.ts";
import {
  asDisplayFn,
  isParsableDisplayExpression,
} from "../src/domain/displayFunctions.ts";
import { drawnShape, flattenAddress } from "../src/domain/views.ts";
import {
  resolveDrawFn,
  resolveGlyph,
  whitelistSvgTree,
} from "../src/presentation/displayFunctions.ts";

// ---- the assertion ledger ----------------------------------------------

const failures: string[] = [];
let assertions = 0;

function check(label: string, condition: boolean): void {
  assertions++;
  if (!condition) failures.push(label);
}

// ---- the kernel ---------------------------------------------------------

const corpusDirectory = join(import.meta.dirname, "..", "formalisms", "kernel");
const layerSources: Record<string, string> = Object.fromEntries(
  KERNEL_LAYER_NAMES.map((layerName) => [
    layerName,
    readFileSync(join(corpusDirectory, layerName + ".ld"), "utf8"),
  ]),
);
const kernel = assembleLayeredDataKernel({ layerSources });
const bedrock = kernel.layerNames.map(String);

const stage = (draftSource: string, previous: string[]) =>
  stageLayerAddition({
    languageSource: kernel.languageSource,
    previousAdditionSources: previous,
    draftSource,
    livingLayerNames: bedrock,
    readonlyLayerNames: bedrock,
  });

// ---- the tokenizer: the [[ … ]] token -----------------------------------

{
  const tokens = tokenizeLanguage("r = fn (place) [[ 8 + 2 * place.marking ]]");
  const code = tokens.find((token) => token.kind === "code");
  check(
    "the tokenizer emits one code token carrying the raw body",
    code !== undefined && code.text === " 8 + 2 * place.marking ",
  );
  let threw = false;
  try {
    tokenizeLanguage("r = fn (place) [[ 8 + 2");
  } catch {
    threw = true;
  }
  check("an unterminated [[ is a syntax error", threw);
}

// ---- the parser: the fn slot exists ONLY in display blocks --------------

{
  const inside = parseLanguage(
    "layer l refines @petrinet-display\n" +
      "  extend specification\n" +
      "    extend place_type\n" +
      "      extend display\n" +
      "        r = fn (place) [[ 8 + 2 * place.marking ]]\n",
  );
  check("fn inside a display block parses without error", inside.errors.length === 0);
  const member = inside.layers[0]?.acts[0];
  const foundFn = JSON.stringify(inside.layers[0]?.acts ?? []).includes('"kind":"fn"');
  check("the fn value is carried by the parsed acts", foundFn && member !== undefined);

  // parser errors are thrown (the staging turns them into syntax
  // verdicts) — the refusal is the throw itself
  const parseErrorOf = (source: string): string | null => {
    try {
      parseLanguage(source);
      return null;
    } catch (error) {
      return (error as Error).message;
    }
  };
  const outside = parseErrorOf(
    "layer l refines @petrinet-scheme\n" +
      "  extend specification\n" +
      "    extend place_type\n" +
      "      marking = fn (place) [[ 1 ]]\n",
  );
  check(
    "fn outside a display block is refused — no code slot there",
    outside !== null && outside.includes("display"),
  );

  const rootLevel = parseErrorOf("layer l refines @petrinet-scheme\n  note = fn (x) [[ 1 ]]\n");
  check("fn at the layer root is refused too", rootLevel !== null && rootLevel.includes("display"));
}

// ---- the expression grammar (staging syntax check, never executed) ------

check(
  "the grammar accepts the ADR examples",
  isParsableDisplayExpression("8 + 2 * place.marking") &&
    isParsableDisplayExpression("f(x, [1, 2], { tag: \"circle\", attrs: { r: 8 } })") &&
    isParsableDisplayExpression("a.b.c > 0 && !done"),
);
check(
  "the grammar refuses statements, assignments and junk",
  !isParsableDisplayExpression("8 +") &&
    !isParsableDisplayExpression("x = 1") &&
    !isParsableDisplayExpression("alert(1);") &&
    !isParsableDisplayExpression("1 2") &&
    !isParsableDisplayExpression("") &&
    !isParsableDisplayExpression("x => { return 1 }"),
);

// ---- staging: accepted fn, and expression-illisible ---------------------

const goodLens =
  "layer fn-lens refines @petrinet-display then @petrinet-scheme\n" +
  "  extend specification\n" +
  "    extend place_type\n" +
  "      extend display\n" +
  "        override shape = \"ellipse\"\n" +
  "        rx = fn (place) [[ 8 + 2 * place.marking ]]\n";
const goodStaging = stage(goodLens, []);
check(
  "rx = fn (place) [[ 8 + 2 * place.marking ]] is accepted in a lens",
  goodStaging.verdicts.length === 0,
);
applyStagedAddition({
  space: kernel.space,
  staging: goodStaging,
  knownLayerNames: bedrock,
  readonlyLayerNames: bedrock,
});

const badLens =
  "layer fn-lens-bad refines @petrinet-display then @petrinet-scheme\n" +
  "  extend specification\n" +
  "    extend place_type\n" +
  "      extend display\n" +
  "        override shape = \"ellipse\"\n" +
  "        rx = fn (place) [[ 8 + ]]\n";
const badStaging = stage(badLens, [goodLens]);
check(
  "rx = fn (place) [[ 8 + ]] is refused at staging with expression-illisible",
  badStaging.verdicts.some((verdict) => verdict.kind === "expression-illisible"),
);

// ---- resolution: the fn field computes per node --------------------------

const placeShape = drawnShape({
  space: kernel.space,
  lens: asLayerName("fn-lens"),
  layer: asLayerName("pn-philosophers-5"),
  path: asLayerPath(["places", "philo1.think1"]),
});
const placeGlyph =
  placeShape !== null && placeShape.spec.length > 0 ? placeShape.spec[0] ?? null : null;
check(
  "the lens entry carries the fn as data (a DisplayFn, not a number)",
  placeGlyph !== null &&
    placeGlyph.shape === "ellipse" &&
    asDisplayFn(placeGlyph.rx) !== null,
);

const element = flattenAddress({
  space: kernel.space,
  layer: asLayerName("pn-philosophers-5"),
  path: asLayerPath(["places", "philo1.think1"]),
});
const modelFlat = flattenAddress({
  space: kernel.space,
  layer: asLayerName("pn-philosophers-5"),
  path: asLayerPath([]),
});
check(
  "the flattened element is pure data and carries its own __path",
  typeof element["marking"] === "number" &&
    Array.isArray(element["__path"]) &&
    (element["__path"] as unknown[])[2] === "philo1.think1",
);

if (placeGlyph !== null && placeGlyph.shape === "ellipse") {
  const resolved = resolveGlyph(placeGlyph, { element, model: modelFlat });
  const marking = typeof element["marking"] === "number" ? element["marking"] : 0;
  check(
    "rx = fn (place) [[ 8 + 2 * place.marking ]] resolves to 8 + 2 * marking",
    resolved.shape === "ellipse" && resolved.rx === 8 + 2 * marking,
  );
}

// a throwing function falls back to the default (the field is dropped)
{
  const throwing = stage(
    "layer fn-lens-throw refines @petrinet-display then @petrinet-scheme\n" +
      "  extend specification\n" +
      "    extend place_type\n" +
      "      extend display\n" +
      "        override shape = \"ellipse\"\n" +
      "        rx = fn (place) [[ null.x ]]\n",
    [goodLens],
  );
  check("a syntactically valid but throwing body still stages (parse only)", throwing.verdicts.length === 0);
  applyStagedAddition({
    space: kernel.space,
    staging: throwing,
    knownLayerNames: bedrock,
    readonlyLayerNames: bedrock,
  });
  const shape = drawnShape({
    space: kernel.space,
    lens: asLayerName("fn-lens-throw"),
    layer: asLayerName("pn-philosophers-5"),
    path: asLayerPath(["places", "philo1.think1"]),
  });
  const glyph = shape !== null && shape.spec.length > 0 ? shape.spec[0] ?? null : null;
  if (glyph !== null) {
    const resolved = resolveGlyph(glyph, { element, model: modelFlat });
    check(
      "a throwing fn falls back to the default (rx absent, never a crash)",
      resolved.shape === "ellipse" && resolved.rx === undefined,
    );
  } else {
    check("the throwing-fn lens still dresses the place", false);
  }
}

// ---- the draw function: a multiplicity, one dot per token ----------------

const drawLens =
  "layer token-lens refines @petrinet-display then @petrinet-scheme\n" +
  "  extend specification\n" +
  "    extend place_type\n" +
  "      extend display\n" +
  "        draw = fn (place, net) [[ Array.from({ length: place.marking }, (_, i) => ({ tag: \"circle\", attrs: { cx: -6 + i * 6, cy: 0, r: 2, fill: \"#455555\" }, children: [] })) ]]\n";
const drawStaging = stage(drawLens, [goodLens]);
check("a draw = fn (place, net) [[ … ]] template is accepted", drawStaging.verdicts.length === 0);
applyStagedAddition({
  space: kernel.space,
  staging: drawStaging,
  knownLayerNames: bedrock,
  readonlyLayerNames: bedrock,
});

const drawShape = drawnShape({
  space: kernel.space,
  lens: asLayerName("token-lens"),
  layer: asLayerName("pn-philosophers-5"),
  path: asLayerPath(["places", "philo1.think1"]),
});
const marking = typeof element["marking"] === "number" ? element["marking"] : 0;
const drawTree =
  drawShape !== null ? resolveDrawFn(drawShape.draw, { element, model: modelFlat }) : null;
check(
  "the draw fn renders a multiplicity: one circle per token",
  drawTree !== null &&
    drawTree.tag === "g" &&
    drawTree.children.length === marking &&
    drawTree.children.every((child) => child.tag === "circle" && child.attrs["r"] === 2),
);

// ---- the draw function counting incoming arcs by data equality -----------

const arcLens =
  "layer arc-lens refines @petrinet-display then @petrinet-scheme\n" +
  "  extend specification\n" +
  "    extend place_type\n" +
  "      extend display\n" +
  "        draw = fn (place, net) [[ [{ tag: \"rect\", attrs: { x: -8, y: -8, width: 16, height: 16, fill: \"none\", stroke: \"#455555\" }, children: [] }, { tag: \"circle\", attrs: { cx: 0, cy: -14, r: 3, fill: \"#455555\" }, children: [] }].slice(0, 1 + Math.min(1, Object.values(net[\"arcs.__node\"] || {}).filter((a) => JSON.stringify(a.source) === JSON.stringify({ __addr: place.__path })).length)) ]]\n";
const arcStaging = stage(arcLens, [goodLens, drawLens]);
check("the arc-counting draw fn stages", arcStaging.verdicts.length === 0);
applyStagedAddition({
  space: kernel.space,
  staging: arcStaging,
  knownLayerNames: bedrock,
  readonlyLayerNames: bedrock,
});
const arcShape = drawnShape({
  space: kernel.space,
  lens: asLayerName("arc-lens"),
  layer: asLayerName("pn-philosophers-5"),
  path: asLayerPath(["places", "philo1.think1"]),
});
const arcTree =
  arcShape !== null ? resolveDrawFn(arcShape.draw, { element, model: modelFlat }) : null;
// philo1.think1 has incoming arcs in the dinner (the take arcs) — the
// count is read by data equality on __addr, without dereferencing
const incoming = (() => {
  const arcs = modelFlat["arcs.__node"];
  if (typeof arcs !== "object" || arcs === null) return 0;
  const want = JSON.stringify({ __addr: element["__path"] });
  let count = 0;
  for (const key of Object.keys(arcs as Record<string, unknown>)) {
    const arc = (arcs as Record<string, unknown>)[key] as { source?: unknown } | null;
    if (arc !== null && JSON.stringify(arc.source) === want) count++;
  }
  return count;
})();
check(
  "the draw fn counts incoming arcs by __addr equality (one marker per arc)",
  arcTree !== null && arcTree.children.length === 1 + (incoming > 0 ? 1 : 0) && incoming > 0,
);

// ---- the SVG whitelist ----------------------------------------------------

check(
  "a whitelisted tree passes, a script tag is dropped",
  whitelistSvgTree({
    tag: "g",
    attrs: { transform: "translate(1 2)" },
    children: [{ tag: "circle", attrs: { cx: 0, cy: 0, r: 4, fill: "#fff" }, children: [] }],
  }) !== null &&
    whitelistSvgTree({ tag: "script", attrs: {}, children: [] }) === null &&
    whitelistSvgTree({ tag: "circle", attrs: { onload: "alert(1)" }, children: [] }) === null &&
    whitelistSvgTree({ tag: "circle", attrs: { r: "8;stroke:red" }, children: [] }) !== null, // string attrs pass; the value is inert data
);
{
  const mixed = whitelistSvgTree({
    tag: "g",
    attrs: {},
    children: [
      { tag: "circle", attrs: { r: 2 }, children: [] },
      { tag: "foreignObject", attrs: {}, children: [] },
    ],
  });
  check(
    "a bad child is dropped, the rest of the tree survives",
    mixed !== null && mixed.children.length === 1 && mixed.children[0]?.tag === "circle",
  );
  check(
    "non-data output is no tree at all",
    whitelistSvgTree("<circle/>") === null &&
      whitelistSvgTree(42) === null &&
      whitelistSvgTree(null) === null,
  );
}

// ---- the ledger -----------------------------------------------------------

console.log(
  "display functions checks: " +
    assertions +
    " assertions, " +
    failures.length +
    " failure(s)",
);
for (const failure of failures) {
  console.log("FAIL " + failure);
}
process.exit(failures.length > 0 ? 1 : 0);
