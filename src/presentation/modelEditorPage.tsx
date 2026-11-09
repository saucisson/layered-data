// The graphical model editor page: one living model, one lens, one
// canvas. GENERICITY IS THE CONTRACT — nothing here knows a
// formalism name: the palette is read from the model's refinement
// chain (`refines @collection` declarations), the arc direction is
// inferred from the formalism's own source/target `container` rules,
// and every gesture is drafted as SOURCE TEXT for the living layer,
// then judged by the staging: the gesture proposes, the tribunal
// decides, the block is the only truth, the canvas is a reading of
// it. The corpus stays read-only (ADR-0020): only the layers added
// at runtime open here, and the kernel judges declared
// expectations — the palette's citation guard is an AFFORDANCE, not
// a second tribunal (the message names the citing arcs, the
// deletion goes through once they have left).

import React, { useEffect, useMemo, useRef, useState } from "react";
import { asLayerName, asLayerPath } from "../domain/identifiers.ts";
import { AddressView } from "../domain/addresses.ts";
import { renderMessage, type Language } from "../domain/messages.ts";
import { assembleLayeredDataKernel } from "../application/corpus.ts";
import { loadKernelLayerSources } from "../infrastructure/corpusLoader.ts";
import {
  stageLayerAddition,
  applyStagedAddition,
  extractLayerBlock,
  type StagingOutcome,
} from "../application/staging.ts";
import {
  stageLayerEdition,
  applyStagedEdition,
  rewriteLivingAddition,
  editableLayerNames,
  type EditionOutcome,
  type LivingAddition,
} from "../application/edition.ts";
import { drawnShape, type DrawnShape } from "../domain/views.ts";
import { circlePosition, LENS_LAYERS } from "./viewTree.ts";
import { EdgeGlyph } from "./glyphs.tsx";
import { editionRefusalLabel, labelOf, say } from "./i18n.ts";
import {
  readMemberContainers,
  positionContainerOf,
  readMemberNames,
  nextMemberName,
  readMemberPosition,
  readMemberCitations,
  draftMemberInsertion,
  draftMemberRemoval,
  draftMemberFieldEdition,
  draftMemberPosition,
  arcContainerBetween,
  memberReferenceText,
  typeReferenceText,
  type MemberContainer,
} from "../application/modelEditing.ts";

// ---- the kernel, the frame ------------------------------------------
// Assembled once from the corpus files — the same single source the
// workshop reads; the editor keeps its own living additions.

const KERNEL = assembleLayeredDataKernel({ layerSources: loadKernelLayerSources() });

const CANVAS_WIDTH = 960;
const CANVAS_HEIGHT = 540;
const DRAG_THRESHOLD = 4;
const MAXIMUM_SCALE = 3;
const MINIMUM_SCALE = 0.3;

/** The shape template of a lens entry, as the glyphs read it. */
type ShapeSpec = DrawnShape["spec"];

/** The tool in the hand: the plain pointer, one vertex container, or
 * the SINGLE arc tool — pre or post is never the user's question,
 * the formalism's own rules answer it (drag from place to
 * transition, the reader says « pre »). */
type EditorTool = { kind: "select" } | { kind: "sommet"; container: string } | { kind: "arc" };

/** One member pointed at on the canvas. */
interface SelectedMember {
  container: string;
  name: string;
}

/** One drawn vertex: its container, its name, its resolved position,
 * the lens's shape for its type (null: the dashed fallback). */
interface VertexView {
  container: string;
  name: string;
  position: { x: number; y: number };
  spec: ShapeSpec;
}

/** One drawn arc: its container, its name, its two ends (null: a
 * dangling citation, nothing is drawn), the lens's shape, the
 * weight datum when it reads. */
interface ArcView {
  container: string;
  name: string;
  from: { x: number; y: number } | null;
  to: { x: number; y: number } | null;
  spec: ShapeSpec;
  weight: number | null;
}

/** The gesture in flight: a pan of the canvas, a drag of one vertex,
 * or an elastic arc being pulled from a vertex. */
type Gesture =
  | { kind: "pan"; clientX: number; clientY: number; originX: number; originY: number; moved: boolean }
  | { kind: "drag"; container: string; name: string; startX: number; startY: number; x: number; y: number; moved: boolean }
  | { kind: "elastic"; fromContainer: string; fromName: string; fromX: number; fromY: number; x: number; y: number };

/** The verdict banner of the last gesture: the tribunal's refusal,
 * or the declaration of the write. */
interface Banner {
  tone: "refused" | "written";
  text: string;
}

export function ModelEditorPage({
  language,
  onChooseLanguage,
}: {
  language: Language;
  onChooseLanguage: (language: Language) => void;
}) {
  // ---- the living workshop -----------------------------------------
  const [additions, setAdditions] = useState<LivingAddition[]>([]);
  const [addedLayerBlocks, setAddedLayerBlocks] = useState<Record<string, string>>({});
  const [spaceVersion, setSpaceVersion] = useState(0);
  // ---- the editor's own choices ------------------------------------
  const [model, setModel] = useState<string | null>(null);
  const [lens, setLens] = useState<string>(LENS_LAYERS[0]);
  const [tool, setTool] = useState<EditorTool>({ kind: "select" });
  const [selected, setSelected] = useState<SelectedMember | null>(null);
  const [banner, setBanner] = useState<Banner | null>(null);
  const [fieldDrafts, setFieldDrafts] = useState<Record<string, string>>({});
  // ---- the model creation form -------------------------------------
  const [creationOpen, setCreationOpen] = useState(false);
  const [creationName, setCreationName] = useState("");
  const [creationRefines, setCreationRefines] = useState("@petrinet-scheme then @positions-grid");
  // ---- the canvas in motion ----------------------------------------
  const [view, setView] = useState({ x: 0, y: 0, scale: 1 });
  const [gesture, setGesture] = useState<Gesture | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);

  // ---- the derived reading -------------------------------------------

  const livingLayerNames = useMemo(() => {
    return [...KERNEL.layerNames, ...additions.flatMap((addition) => addition.layerNames)];
  }, [additions]);

  const editableModels = useMemo(() => {
    return editableLayerNames({ livingLayerNames, readonlyLayerNames: KERNEL.layerNames });
  }, [livingLayerNames]);

  const containers = useMemo(() => {
    if (model === null) return [];
    return readMemberContainers({ space: KERNEL.space, model });
  }, [model, spaceVersion]);

  const positionContainer = useMemo(() => positionContainerOf({ containers }), [containers]);
  const vertexContainers = useMemo(() => {
    return containers.filter(
      (container) => container.kind === "sommet" && container.name !== positionContainer?.name,
    );
  }, [containers, positionContainer]);
  const arcContainers = useMemo(() => {
    return containers.filter((container) => container.kind === "arc");
  }, [containers]);

  /** The model's own source block (header included), as every gesture
   * drafts on it. */
  const modelSource = useMemo(() => {
    if (model === null) return "";
    for (const addition of additions) {
      if (!addition.layerNames.includes(model)) continue;
      return extractLayerBlock({ name: model, source: addition.source }) ?? addition.source;
    }
    return addedLayerBlocks[model] ?? "";
  }, [additions, addedLayerBlocks, model]);

  /** The drawing: the vertices with their resolved positions (the
   * formalism's grid, else the circle layout), the arcs with their
   * two ends — a dangling citation draws nothing, no error. */
  const drawing = useMemo(() => {
    if (model === null) return { vertices: [] as VertexView[], arcs: [] as ArcView[] };
    const pending: { container: string; name: string; position: { x: number; y: number } | null; spec: ShapeSpec }[] = [];
    for (const container of vertexContainers) {
      const names = readMemberNames({ space: KERNEL.space, model, container: container.name });
      for (const name of names) {
        const position =
          positionContainer !== null
            ? readMemberPosition({
                space: KERNEL.space,
                model,
                positionContainer: positionContainer.name,
                name,
                visited: new Set<string>(),
              })
            : null;
        const shape = drawnShape({
          space: KERNEL.space,
          lens: asLayerName(lens),
          layer: asLayerName(model),
          path: asLayerPath([container.name, name]),
        });
        pending.push({ container: container.name, name, position, spec: shape?.spec ?? null });
      }
    }
    const vertices: VertexView[] = pending.map((vertex, index) => ({
      container: vertex.container,
      name: vertex.name,
      position: vertex.position ?? circlePosition({ index, total: pending.length }) ?? { x: CANVAS_WIDTH / 2, y: CANVAS_HEIGHT / 2 },
      spec: vertex.spec,
    }));
    const positionOfMember = (reference: unknown): { x: number; y: number } | null => {
      if (!(reference instanceof AddressView) || reference.path.length !== 2) return null;
      const vertex = vertices.find(
        (candidate) => candidate.container === reference.path[0] && candidate.name === reference.path[1],
      );
      return vertex ? vertex.position : null;
    };
    const arcs: ArcView[] = [];
    for (const container of arcContainers) {
      for (const arcName of readMemberNames({ space: KERNEL.space, model, container: container.name })) {
        const shape = drawnShape({
          space: KERNEL.space,
          lens: asLayerName(lens),
          layer: asLayerName(model),
          path: asLayerPath([container.name, arcName]),
        });
        const weight = KERNEL.space.read({
          layer: asLayerName(model),
          path: asLayerPath([container.name, arcName]),
          key: "weight",
        });
        arcs.push({
          container: container.name,
          name: arcName,
          from: positionOfMember(
            KERNEL.space.read({ layer: asLayerName(model), path: asLayerPath([container.name, arcName]), key: "source" }),
          ),
          to: positionOfMember(
            KERNEL.space.read({ layer: asLayerName(model), path: asLayerPath([container.name, arcName]), key: "target" }),
          ),
          spec: shape?.spec ?? null,
          weight: typeof weight === "number" ? weight : null,
        });
      }
    }
    return { vertices, arcs };
  }, [model, lens, spaceVersion, vertexContainers, arcContainers, positionContainer]);

  // ---- the tribunal ---------------------------------------------------

  /** Render a staging outcome's refusal as one readable text. */
  function stagingRefusalText({ staging }: { staging: StagingOutcome }): string {
    const parts: string[] = [];
    if (staging.step === "syntaxe") parts.push(...staging.errors);
    for (const verdict of staging.verdicts) {
      parts.push(labelOf({ code: verdict.kind, language }) + " — " + renderMessage({ message: verdict.fact, language }));
    }
    return parts.join(" ; ");
  }

  /** Render an edition outcome's refusal: the guards first, then the
   * staging's own words. */
  function editionRefusalText({ outcome }: { outcome: EditionOutcome }): string {
    const parts = outcome.refusals.map((refusal) => editionRefusalLabel({ code: refusal, language }));
    const stagingText = stagingRefusalText({ staging: outcome.staging });
    if (stagingText.length > 0) parts.push(stagingText);
    return parts.join(" ; ");
  }

  /** One gesture of the canvas: draft the model's source, stage the
   * edition — on acceptance apply it, rewrite the kept addition,
   * count a re-read; on refusal the banner speaks and the space
   * stays intact. Returns the verdict. */
  function proposeEdition({ draftedSource }: { draftedSource: string }): boolean {
    if (model === null) return false;
    const outcome = stageLayerEdition({
      languageSource: KERNEL.languageSource,
      livingAdditions: additions,
      livingLayerNames,
      readonlyLayerNames: KERNEL.layerNames,
      layerName: asLayerName(model),
      editedSource: draftedSource,
      language,
    });
    if (!outcome.ok) {
      setBanner({ tone: "refused", text: editionRefusalText({ outcome }) });
      return false;
    }
    const edition = applyStagedEdition({
      space: KERNEL.space,
      layerName: asLayerName(model),
      staging: outcome.staging,
      readonlyLayerNames: KERNEL.layerNames,
    });
    setAdditions(
      additions.map((addition) =>
        rewriteLivingAddition({ addition, layerName: asLayerName(model), block: edition.block }),
      ),
    );
    setAddedLayerBlocks({ ...addedLayerBlocks, [model]: edition.block });
    setSpaceVersion(spaceVersion + 1);
    setBanner({
      tone: "written",
      text: say({
        language,
        en: "staging: 0 verdict — the layer is rewritten, the write is declared, the canvas re-reads the space",
        fr: "staging : 0 verdict — la couche est réécrite, l'écriture est déclarée, le canevas relit l'espace",
      }),
    });
    return true;
  }

  /** The container declaration of one name, or null. */
  function containerNamed({ name }: { name: string }): MemberContainer | null {
    return containers.find((container) => container.name === name) ?? null;
  }

  // ---- the gestures ---------------------------------------------------

  /** The world point under one pointer event. */
  function toWorld({ clientX, clientY }: { clientX: number; clientY: number }): { x: number; y: number } {
    const svg = svgRef.current;
    if (svg === null) return { x: 0, y: 0 };
    const rectangle = svg.getBoundingClientRect();
    const baseX = (CANVAS_WIDTH * (clientX - rectangle.left)) / rectangle.width;
    const baseY = (CANVAS_HEIGHT * (clientY - rectangle.top)) / rectangle.height;
    return { x: (baseX - view.x) / view.scale, y: (baseY - view.y) / view.scale };
  }

  function handleBackgroundPointerDown(event: React.PointerEvent<SVGRectElement>) {
    setGesture({
      kind: "pan",
      clientX: event.clientX,
      clientY: event.clientY,
      originX: view.x,
      originY: view.y,
      moved: false,
    });
    svgRef.current?.setPointerCapture(event.pointerId);
  }

  function handleVertexPointerDown(
    event: React.PointerEvent<SVGGElement>,
    vertex: VertexView,
  ) {
    event.stopPropagation();
    svgRef.current?.setPointerCapture(event.pointerId);
    if (tool.kind === "arc") {
      setGesture({
        kind: "elastic",
        fromContainer: vertex.container,
        fromName: vertex.name,
        fromX: vertex.position.x,
        fromY: vertex.position.y,
        x: vertex.position.x,
        y: vertex.position.y,
      });
      return;
    }
    setSelected({ container: vertex.container, name: vertex.name });
    setFieldDrafts({});
    const world = toWorld({ clientX: event.clientX, clientY: event.clientY });
    setGesture({
      kind: "drag",
      container: vertex.container,
      name: vertex.name,
      startX: world.x,
      startY: world.y,
      x: world.x,
      y: world.y,
      moved: false,
    });
  }

  function handlePointerMove(event: React.PointerEvent<SVGSVGElement>) {
    if (gesture === null) return;
    if (gesture.kind === "pan") {
      const moved =
        gesture.moved ||
        Math.abs(event.clientX - gesture.clientX) > DRAG_THRESHOLD ||
        Math.abs(event.clientY - gesture.clientY) > DRAG_THRESHOLD;
      setGesture({ ...gesture, moved });
      setView({
        ...view,
        x: gesture.originX + event.clientX - gesture.clientX,
        y: gesture.originY + event.clientY - gesture.clientY,
      });
      return;
    }
    const world = toWorld({ clientX: event.clientX, clientY: event.clientY });
    if (gesture.kind === "drag") {
      const moved =
        gesture.moved ||
        Math.abs(world.x - gesture.startX) > DRAG_THRESHOLD ||
        Math.abs(world.y - gesture.startY) > DRAG_THRESHOLD;
      setGesture({ ...gesture, x: world.x, y: world.y, moved });
      return;
    }
    setGesture({ ...gesture, x: world.x, y: world.y });
  }

  function handlePointerUp(event: React.PointerEvent<SVGSVGElement>) {
    if (gesture === null) return;
    if (gesture.kind === "pan") {
      // a bare click on the canvas: the sommet tool creates here,
      // the plain pointer lays the selection down
      if (!gesture.moved && tool.kind === "sommet" && model !== null) {
        const world = toWorld({ clientX: event.clientX, clientY: event.clientY });
        createMemberAt({ container: tool.container, x: world.x, y: world.y });
      } else if (!gesture.moved) {
        setSelected(null);
        setFieldDrafts({});
      }
      setGesture(null);
      return;
    }
    if (gesture.kind === "drag") {
      const vertex = drawing.vertices.find(
        (candidate) => candidate.container === gesture.container && candidate.name === gesture.name,
      );
      const moved = vertex !== undefined && (Math.abs(gesture.x - gesture.startX) > DRAG_THRESHOLD || Math.abs(gesture.y - gesture.startY) > DRAG_THRESHOLD);
      if (moved && vertex !== undefined && model !== null && positionContainer !== null) {
        const nextX = Math.round(vertex.position.x + gesture.x - gesture.startX);
        const nextY = Math.round(vertex.position.y + gesture.y - gesture.startY);
        proposeEdition({
          draftedSource: draftMemberPosition({
            block: modelSource,
            positionContainer: positionContainer.name,
            name: gesture.name,
            x: nextX,
            y: nextY,
            typeReference: typeReferenceText({ address: positionContainer.memberType }),
          }),
        });
      }
      setGesture(null);
      return;
    }
    // the elastic arc: drop on a vertex — the formalism's rules say
    // which container the arc belongs to, or the banner refuses
    const world = toWorld({ clientX: event.clientX, clientY: event.clientY });
    const hit = drawing.vertices.find((vertex) => {
      if (vertex.container === gesture.fromContainer && vertex.name === gesture.fromName) return false;
      return Math.hypot(vertex.position.x - world.x, vertex.position.y - world.y) < 20;
    });
    if (hit !== undefined && model !== null) {
      const arcContainer = arcContainerBetween({
        containers,
        fromContainer: gesture.fromContainer,
        toContainer: hit.container,
      });
      if (arcContainer === null) {
        setBanner({
          tone: "refused",
          text: say({
            language,
            en:
              "the formalism declares no arc from « " +
              gesture.fromContainer +
              " » to « " +
              hit.container +
              " » — the direction is the formalism's to decide",
            fr:
              "le formalisme ne déclare aucun arc de « " +
              gesture.fromContainer +
              " » vers « " +
              hit.container +
              " » — la direction, c'est à lui de la décider",
          }),
        });
      } else {
        const arcName = nextMemberName({ space: KERNEL.space, model, container: arcContainer.name });
        proposeEdition({
          draftedSource: draftMemberInsertion({
            block: modelSource,
            container: arcContainer.name,
            name: arcName,
            typeReference: typeReferenceText({ address: arcContainer.memberType }),
            fields: {
              source: memberReferenceText({ model, container: gesture.fromContainer, member: gesture.fromName }),
              target: memberReferenceText({ model, container: hit.container, member: hit.name }),
            },
          }),
        });
      }
    }
    setGesture(null);
  }

  /** Create one member of one vertex container at a canvas point: the
   * member first, its position when the formalism poses one. */
  function createMemberAt({ container, x, y }: { container: string; x: number; y: number }) {
    const declaration = containerNamed({ name: container });
    if (declaration === null || model === null) return;
    const name = nextMemberName({ space: KERNEL.space, model, container });
    let drafted = draftMemberInsertion({
      block: modelSource,
      container,
      name,
      typeReference: typeReferenceText({ address: declaration.memberType }),
      fields: {},
    });
    if (positionContainer !== null) {
      drafted = draftMemberPosition({
        block: drafted,
        positionContainer: positionContainer.name,
        name,
        x: Math.round(x),
        y: Math.round(y),
        typeReference: typeReferenceText({ address: positionContainer.memberType }),
      });
    }
    proposeEdition({ draftedSource: drafted });
  }

  /** Delete the selected member — the citation guard first: the
   * kernel judges declared expectations, not reference integrity;
   * the palette holds the gesture, names the citing arcs, and the
   * deletion goes through once they have left. */
  function deleteSelectedMember() {
    if (selected === null || model === null) return;
    const citations = readMemberCitations({
      space: KERNEL.space,
      model,
      containers,
      container: selected.container,
      name: selected.name,
    });
    if (citations.length > 0) {
      setBanner({
        tone: "refused",
        text:
          say({
            language,
            en: "the member is cited — delete the citing arcs first:",
            fr: "le membre est cité — supprimez d'abord les arcs qui le citent :",
          }) +
          " " +
          citations.map((citation) => citation.container + "/" + citation.name + " (" + citation.via + ")").join(", "),
      });
      return;
    }
    const accepted = proposeEdition({
      draftedSource: draftMemberRemoval({
        block: modelSource,
        container: selected.container,
        name: selected.name,
      }),
    });
    if (accepted) {
      setSelected(null);
      setFieldDrafts({});
    }
  }

  /** Edit one annotation of the selected member: the gesture proposes
   * the field, the tribunal judges the whole layer. A numeric text
   * drafts a number; any other non-empty text drafts a quoted string
   * (the language's literal syntax) — `polar`, not `"polar"`. */
  function commitField({ key, text }: { key: string; text: string }) {
    if (selected === null || model === null) return;
    const trimmed = text.trim();
    if (trimmed.length === 0) return;
    const numeric = Number(trimmed);
    const value: number | string = Number.isFinite(numeric) && trimmed !== "" ? numeric : trimmed;
    proposeEdition({
      draftedSource: draftMemberFieldEdition({
        block: modelSource,
        container: selected.container,
        name: selected.name,
        fields: { [key]: value },
      }),
    });
    setFieldDrafts({});
  }

  // the keyboard: Suppr deletes the selected member, Escape lays the
  // tool down — never while a text input holds the focus
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const target = event.target;
      if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) return;
      if (event.key === "Escape") {
        setTool({ kind: "select" });
        setSelected(null);
        setFieldDrafts({});
        setGesture(null);
        return;
      }
      if ((event.key === "Delete" || event.key === "Backspace") && selected !== null) {
        event.preventDefault();
        deleteSelectedMember();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  });

  // the wheel zooms around the cursor — a native listener, the
  // wheel is not passive here
  useEffect(() => {
    const svgElement = svgRef.current;
    if (svgElement === null) return;
    const svg: SVGSVGElement = svgElement;
    function handleWheel(event: WheelEvent) {
      event.preventDefault();
      const factor = event.deltaY < 0 ? 1.1 : 1 / 1.1;
      const nextScale = Math.min(MAXIMUM_SCALE, Math.max(MINIMUM_SCALE, view.scale * factor));
      const rectangle = svg.getBoundingClientRect();
      const baseX = (CANVAS_WIDTH * (event.clientX - rectangle.left)) / rectangle.width;
      const baseY = (CANVAS_HEIGHT * (event.clientY - rectangle.top)) / rectangle.height;
      setView({
        scale: nextScale,
        x: baseX - ((baseX - view.x) * nextScale) / view.scale,
        y: baseY - ((baseY - view.y) * nextScale) / view.scale,
      });
    }
    svg.addEventListener("wheel", handleWheel, { passive: false });
    return () => svg.removeEventListener("wheel", handleWheel);
  }, [view]);

  // ---- the model creation ---------------------------------------------

  function handleCreateModel() {
    const draftSource = "layer " + creationName.trim() + " refines " + creationRefines.trim();
    const staging = stageLayerAddition({
      languageSource: KERNEL.languageSource,
      previousAdditionSources: additions.map((addition) => addition.source),
      draftSource,
      livingLayerNames,
      readonlyLayerNames: KERNEL.layerNames,
      language,
    });
    if (!staging.ok) {
      setBanner({ tone: "refused", text: stagingRefusalText({ staging }) });
      return;
    }
    const applied = applyStagedAddition({
      space: KERNEL.space,
      staging,
      knownLayerNames: livingLayerNames,
      readonlyLayerNames: KERNEL.layerNames,
    });
    setAdditions([...additions, { source: draftSource.trim(), layerNames: [...applied.newLayerNames] }]);
    const nextBlocks = { ...addedLayerBlocks };
    for (const layerName of applied.newLayerNames) {
      const block = staging.blocks[layerName];
      if (block !== undefined) nextBlocks[layerName] = block;
    }
    setAddedLayerBlocks(nextBlocks);
    setSpaceVersion(spaceVersion + 1);
    setModel(creationName.trim());
    setSelected(null);
    setTool({ kind: "select" });
    setCreationOpen(false);
    setBanner({
      tone: "written",
      text: say({
        language,
        en: "the model enters the space — its palette is read from its formalism",
        fr: "le modèle entre dans l'espace — sa palette se lit dans son formalisme",
      }),
    });
  }

  // ---- the rendering ---------------------------------------------------

  const selectedDeclaration =
    selected !== null ? containerNamed({ name: selected.container }) : null;

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <span className="rounded bg-emerald-600 px-1.5 py-0.5 text-[11px] font-bold text-white">✎</span>
        <span className="text-sm font-semibold text-slate-700">
          {say({ language, en: "the graphical model editor", fr: "l'éditeur graphique de modèles" })}
        </span>
        <select
          value={model ?? ""}
          onChange={(event) => {
            setModel(event.target.value === "" ? null : event.target.value);
            setSelected(null);
            setFieldDrafts({});
            setTool({ kind: "select" });
            setBanner(null);
          }}
          className="rounded border border-slate-300 bg-white px-2 py-1 text-xs"
        >
          <option value="">{say({ language, en: "no model", fr: "aucun modèle" })}</option>
          {editableModels.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
        <select
          value={lens}
          onChange={(event) => setLens(event.target.value)}
          className="rounded border border-slate-300 bg-white px-2 py-1 text-xs"
        >
          {LENS_LAYERS.map((lensName) => (
            <option key={lensName} value={lensName}>
              {lensName}
            </option>
          ))}
        </select>
        <button
          onClick={() => setCreationOpen(!creationOpen)}
          className="rounded bg-sky-600 px-2 py-1 text-xs font-semibold text-white hover:bg-sky-500"
        >
          {say({ language, en: "+ new model", fr: "+ nouveau modèle" })}
        </button>
        <button
          onClick={() => onChooseLanguage(language === "fr" ? "en" : "fr")}
          className="ml-auto rounded border border-slate-300 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50"
        >
          {language === "fr" ? "EN" : "FR"}
        </button>
      </div>

      {creationOpen && (
        <div className="mb-4 rounded-lg border border-sky-200 bg-sky-50/40 p-3">
          <p className="mb-2 text-[11px] leading-4 text-slate-500">
            {say({
              language,
              en: "a model is a layer that refines a formalism — the staging judges the draft, the palette is read from what it refines",
              fr: "un modèle est une couche qui raffine un formalisme — le staging juge le brouillon, la palette se lit dans ce qu'il raffine",
            })}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <input
              value={creationName}
              onChange={(event) => setCreationName(event.target.value)}
              placeholder={say({ language, en: "model name", fr: "nom du modèle" })}
              className="rounded border border-slate-300 px-2 py-1 text-xs"
            />
            <span className="text-xs text-slate-400">refines</span>
            <input
              value={creationRefines}
              onChange={(event) => setCreationRefines(event.target.value)}
              spellCheck={false}
              className="w-72 rounded border border-slate-300 px-2 py-1 font-mono text-xs"
            />
            <button
              onClick={handleCreateModel}
              disabled={creationName.trim().length === 0}
              className="rounded bg-sky-600 px-2 py-1 text-xs font-semibold text-white hover:bg-sky-500 disabled:opacity-50"
            >
              {say({ language, en: "staging — create the model", fr: "staging — créer le modèle" })}
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-12 gap-4">
        {/* the palette: read from the formalism, never hardcoded */}
        <div className="col-span-2 rounded-lg border border-slate-200 bg-white p-2">
          <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
            {say({ language, en: "palette", fr: "palette" })}
          </div>
          {model === null && (
            <p className="text-[11px] leading-4 text-slate-400">
              {say({
                language,
                en: "no model — create or pick one, the palette follows its formalism",
                fr: "aucun modèle — créez-en ou choisissez-en un, la palette suit son formalisme",
              })}
            </p>
          )}
          <div className="flex flex-col gap-1">
            <button
              onClick={() => setTool({ kind: "select" })}
              className={
                "rounded px-2 py-1 text-left text-[11px] " +
                (tool.kind === "select" ? "bg-sky-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200")
              }
            >
              {say({ language, en: "pointer", fr: "pointeur" })}
            </button>
            {vertexContainers.map((container) => (
              <button
                key={container.name}
                onClick={() => setTool({ kind: "sommet", container: container.name })}
                className={
                  "rounded px-2 py-1 text-left text-[11px] " +
                  (tool.kind === "sommet" && tool.container === container.name
                    ? "bg-sky-600 text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200")
                }
                title={container.name + " — " + container.annotationKeys.join(", ")}
              >
                {container.name}
              </button>
            ))}
            {arcContainers.length > 0 && (
              <button
                onClick={() => setTool({ kind: "arc" })}
                className={
                  "rounded px-2 py-1 text-left text-[11px] " +
                  (tool.kind === "arc" ? "bg-sky-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200")
                }
                title={say({
                  language,
                  en: "drag from a vertex to another — pre or post, the formalism's rules decide",
                  fr: "tirez d'un sommet vers un autre — pré ou post, les règles du formalisme décident",
                })}
              >
                {say({ language, en: "arc", fr: "arc" })}
              </button>
            )}
          </div>
        </div>

        {/* the canvas: a reading of the model's truth */}
        <div className="col-span-7">
          <svg
            ref={svgRef}
            viewBox={"0 0 " + CANVAS_WIDTH + " " + CANVAS_HEIGHT}
            className="w-full touch-none select-none rounded-lg border border-slate-200 bg-white"
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
          >
            <defs>
              <pattern id="editor-grid" width="20" height="20" patternUnits="userSpaceOnUse">
                <circle cx="0.5" cy="0.5" r="0.5" fill="#e2e8f0" />
              </pattern>
            </defs>
            <rect
              x={0}
              y={0}
              width={CANVAS_WIDTH}
              height={CANVAS_HEIGHT}
              fill="url(#editor-grid)"
              onPointerDown={handleBackgroundPointerDown}
            />
            <g transform={"translate(" + view.x + "," + view.y + ") scale(" + view.scale + ")"}>
              {drawing.arcs.map((arc) => {
                if (arc.from === null || arc.to === null) return null;
                return (
                  <EdgeGlyph
                    key={arc.container + "/" + arc.name}
                    name={arc.name}
                    shape={arc.spec}
                    weight={arc.weight}
                    from={arc.from}
                    to={arc.to}
                    selected={selected !== null && selected.container === arc.container && selected.name === arc.name}
                    onPick={() => {
                      setSelected({ container: arc.container, name: arc.name });
                      setFieldDrafts({});
                    }}
                  />
                );
              })}
              {gesture !== null && gesture.kind === "elastic" && (
                <line
                  x1={gesture.fromX}
                  y1={gesture.fromY}
                  x2={gesture.x}
                  y2={gesture.y}
                  stroke="#0ea5e9"
                  strokeWidth={1.5}
                  strokeDasharray="4 3"
                />
              )}
              {drawing.vertices.map((vertex) => {
                const dragOfVertex =
                  gesture !== null &&
                  gesture.kind === "drag" &&
                  gesture.container === vertex.container &&
                  gesture.name === vertex.name
                    ? gesture
                    : null;
                const offsetX = dragOfVertex !== null ? dragOfVertex.x - dragOfVertex.startX : 0;
                const offsetY = dragOfVertex !== null ? dragOfVertex.y - dragOfVertex.startY : 0;
                return (
                  <EditorVertexGlyph
                    key={vertex.container + "/" + vertex.name}
                    name={vertex.name}
                    shape={vertex.spec}
                    position={{ x: vertex.position.x + offsetX, y: vertex.position.y + offsetY }}
                    selected={selected !== null && selected.container === vertex.container && selected.name === vertex.name}
                    onPointerDown={(event) => handleVertexPointerDown(event, vertex)}
                  />
                );
              })}
            </g>
          </svg>
          {banner !== null && (
            <div
              className={
                "mt-2 rounded-md border px-2 py-1.5 text-[11px] leading-4 " +
                (banner.tone === "refused"
                  ? "border-amber-200 bg-amber-50 text-amber-800"
                  : "border-sky-200 bg-white text-sky-700")
              }
            >
              {banner.text}
            </div>
          )}
          {model !== null && (
            <details className="mt-2 rounded-md border border-slate-200 px-2 py-1.5">
              <summary className="cursor-pointer text-[11px] font-semibold text-slate-500">
                {say({ language, en: "the layer's source — the only truth", fr: "la source de la couche — la seule vérité" })}
              </summary>
              <pre className="mt-1 overflow-x-auto font-mono text-[10px] leading-4 text-slate-600">{modelSource}</pre>
            </details>
          )}
        </div>

        {/* the inspector: the selected member and its declared keys */}
        <div className="col-span-3 rounded-lg border border-slate-200 bg-white p-2">
          <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
            {say({ language, en: "inspector", fr: "inspecteur" })}
          </div>
          {selected === null || selectedDeclaration === null || model === null ? (
            <p className="text-[11px] leading-4 text-slate-400">
              {say({
                language,
                en: "pick a member on the canvas — its declared keys open here, every edition goes through the staging",
                fr: "choisissez un membre sur le canevas — ses clés déclarées s'ouvrent ici, chaque édition passe par le staging",
              })}
            </p>
          ) : (
            <div>
              <div className="mb-1 font-mono text-[11px] font-semibold text-slate-700">
                {selected.container + "/" + selected.name}
              </div>
              {selectedDeclaration.kind === "arc" && (
                <div className="mb-1 font-mono text-[10px] text-slate-400">
                  {["source", "target"].map((key) => {
                    const reference = KERNEL.space.read({
                      layer: asLayerName(model),
                      path: asLayerPath([selected.container, selected.name]),
                      key,
                    });
                    return (
                      <div key={key}>
                        {key + " = "}
                        {reference instanceof AddressView && reference.path.length === 2
                          ? "@" + reference.layer + "/" + reference.path.join("/")
                          : "?"}
                      </div>
                    );
                  })}
                </div>
              )}
              {selectedDeclaration.annotationKeys.map((key) => {
                const value = KERNEL.space.read({
                  layer: asLayerName(model),
                  path: asLayerPath([selected.container, selected.name]),
                  key,
                });
                if (value instanceof AddressView) return null;
                const shown =
                  fieldDrafts[key] ??
                  (typeof value === "number" || typeof value === "string" ? String(value) : "");
                return (
                  <label key={key} className="mb-1 flex items-center gap-1 text-[11px] text-slate-600">
                    <span className="w-20 shrink-0 font-mono text-slate-400">{key}</span>
                    <input
                      value={shown}
                      onChange={(event) => setFieldDrafts({ ...fieldDrafts, [key]: event.target.value })}
                      onBlur={(event) => commitField({ key, text: event.target.value })}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") commitField({ key, text: event.currentTarget.value });
                      }}
                      className="w-24 rounded border border-slate-200 px-1 py-0.5 font-mono text-[11px]"
                    />
                  </label>
                );
              })}
              <button
                onClick={deleteSelectedMember}
                className="mt-1 rounded border border-red-200 px-2 py-1 text-[11px] text-red-600 hover:bg-red-50"
              >
                {say({ language, en: "delete (Suppr)", fr: "supprimer (Suppr)" })}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/** One editable vertex glyph: the lens's shape (dashed circle when
 * the lens knows nothing of the type), the name inside, the pointer
 * gestures — press to select or drag, press with the arc tool to
 * pull an elastic arc. */
function EditorVertexGlyph({
  name,
  shape,
  position,
  selected,
  onPointerDown,
}: {
  name: string;
  shape: ShapeSpec;
  position: { x: number; y: number };
  selected: boolean;
  onPointerDown: (event: React.PointerEvent<SVGGElement>) => void;
}) {
  const { x, y } = position;
  const shapeKind = shape ? shape.shape : null;
  const stroke = shape ? shape.stroke : "#94a3b8";
  const fill = shape && shape.fill ? shape.fill : "none";
  const strokeWidth = selected ? 2.5 : 1.5;
  return (
    <g onPointerDown={onPointerDown} style={{ cursor: "grab" }}>
      {shapeKind === "circle" && <circle cx={x} cy={y} r={16} fill={fill} stroke={stroke} strokeWidth={strokeWidth} />}
      {shapeKind === "ellipse" && (
        <ellipse cx={x} cy={y} rx={24} ry={14} fill={fill} stroke={stroke} strokeWidth={strokeWidth} />
      )}
      {shapeKind === "rectangle" && (
        <rect x={x - 22} y={y - 12} width={44} height={24} rx={2} fill={fill} stroke={stroke} strokeWidth={strokeWidth} />
      )}
      {shapeKind === "box" && (
        <rect x={x - 26} y={y - 12} width={52} height={24} rx={3} fill="#ffffff" stroke="#455555" strokeWidth={strokeWidth} />
      )}
      {!shape && <circle cx={x} cy={y} r={16} fill="none" stroke={stroke} strokeDasharray="3 3" strokeWidth={strokeWidth} />}
      {selected && <circle cx={x} cy={y} r={21} fill="none" stroke="#0ea5e9" strokeWidth={1} strokeDasharray="2 2" />}
      <text x={x} y={y + 3} textAnchor="middle" fontSize={9} fill={shapeKind === "rectangle" ? "#f8fafc" : "#334155"}>
        {name}
      </text>
    </g>
  );
}
