// The graphical model editor page: one living model, one lens, one
// canvas. GENERICITY IS THE CONTRACT — nothing here knows a
// formalism name: the palette is read from the model's refinement
// chain (`refines @collection` declarations), the arc direction is
// inferred from the formalism's own source/target `container` rules,
// and every gesture is drafted as SOURCE TEXT for the living layer,
// then judged by the staging: the gesture proposes, the tribunal
// decides, the block is the only truth, the canvas is a reading of
// it. The corpus stays read-only (ADR-0103): only the layers added
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
import { expectationsOf, formatExpectation, readMatchesExpectation } from "../domain/validation.ts";
import { circlePosition, LENS_LAYERS } from "./viewTree.ts";
import { EdgeGlyph } from "./glyphs.tsx";
import { editionRefusalLabel, labelOf } from "./i18n.ts";
import { t } from "../infrastructure/i18n.ts";
import { connectEditorSync, type EditorSyncHandle, type SessionSnapshot } from "../infrastructure/editorSync.ts";
import {
  readMemberContainers,
  positionContainerOf,
  readMemberNames,
  nextMemberName,
  readMemberPosition,
  readMemberCitations,
  draftMemberInsertion,
  draftMemberRemovalCascade,
  draftMemberFieldEdition,
  draftMemberPosition,
  arcContainerBetween,
  arcLabelKeyOf,
  suggestModelRefines,
  memberReferenceText,
  typeReferenceText,
  type MemberContainer,
} from "../application/modelEditing.ts";

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
  // ---- the kernel, the frame -----------------------------------------
  // Assembled from the corpus files — the same single source the
  // workshop reads. In shared mode (ADR-0110) the kernel is REPLACED
  // by a fresh assembly + the server's additions on every state
  // event, so the server stays the single writer; locally the space
  // is mutated in place by each accepted gesture.
  const [KERNEL, setKERNEL] = useState(() => assembleLayeredDataKernel({ layerSources: loadKernelLayerSources() }));

  // ---- the living workshop -----------------------------------------
  const [additions, setAdditions] = useState<LivingAddition[]>([]);
  const [addedLayerBlocks, setAddedLayerBlocks] = useState<Record<string, string>>({});
  const [spaceVersion, setSpaceVersion] = useState(0);
  // ---- the shared session (ADR-0110): connected to the server's
  // SSE stream, or local when the server is absent ----
  const [shared, setShared] = useState(false);
  const [presence, setPresence] = useState<{ id: string; focus: string | null }[]>([]);
  const syncRef = useRef<EditorSyncHandle | null>(null);
  const serverVersionRef = useRef(0);
  // ---- the editor's own choices ------------------------------------
  const [model, setModel] = useState<string | null>(null);
  const [lens, setLens] = useState<string>(LENS_LAYERS[0] ?? "");
  const [tool, setTool] = useState<EditorTool>({ kind: "select" });
  const [selected, setSelected] = useState<SelectedMember | null>(null);
  const [banner, setBanner] = useState<Banner | null>(null);
  const [fieldDrafts, setFieldDrafts] = useState<Record<string, string>>({});
  // ---- the model creation form -------------------------------------
  const [creationOpen, setCreationOpen] = useState(false);
  const [creationName, setCreationName] = useState("");
  const [creationRefines, setCreationRefines] = useState(() =>
    suggestModelRefines({ space: KERNEL.space, layerNames: KERNEL.layerNames }),
  );
  // ---- the canvas in motion ----------------------------------------
  const [view, setView] = useState({ x: 0, y: 0, scale: 1 });
  const [gesture, setGesture] = useState<Gesture | null>(null);
  const [showSource, setShowSource] = useState(false);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const importInputRef = useRef<HTMLInputElement | null>(null);
  // ---- the undo journal: the model's block BEFORE each accepted
  // edition — Ctrl+Z walks back, Ctrl+Shift+Z walks forward. A
  // refused gesture never enters the journal. ----
  interface BlockSnapshot {
    model: string;
    block: string;
  }
  const [history, setHistory] = useState<BlockSnapshot[]>([]);
  const [future, setFuture] = useState<BlockSnapshot[]>([]);

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

  /** The model's declared expectations (`expect` lines), re-read live:
   * each shows its current value and whether it still holds. */
  const expectations = useMemo(() => {
    if (model === null) return [] as { address: string; expected: string; holds: boolean }[];
    const layerNode = KERNEL.compiledLanguage.layers[asLayerName(model)];
    return expectationsOf(layerNode).map((expectation) => {
      let read: unknown;
      try {
        read = KERNEL.space.read({
          layer: asLayerName(model),
          path: asLayerPath(expectation.path),
          key: expectation.key,
        });
      } catch {
        read = undefined;
      }
      return {
        address: expectation.address,
        expected: formatExpectation(expectation.expectation),
        holds: readMatchesExpectation(read, expectation.expectation),
      };
    });
  }, [model, spaceVersion]);
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
        // the arc's label: the first declared annotation key that
        // reads a number — the formalism's data names it, never a
        // hardcoded key
        const labelKey = arcLabelKeyOf({ space: KERNEL.space, model, arcContainer: container, arcName });
        const label = labelKey === null ? null : KERNEL.space.read({
          layer: asLayerName(model),
          path: asLayerPath([container.name, arcName]),
          key: labelKey,
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
          weight: typeof label === "number" ? label : null,
        });
      }
    }
    return { vertices, arcs };
  }, [model, lens, spaceVersion, vertexContainers, arcContainers, positionContainer]);

  // ---- the shared session (ADR-0110) ----------------------------------

  /** Rebuild the kernel from the corpus and re-apply the given
   * additions in order — the server's snapshot becomes the local
   * truth. Used on every state event in shared mode. */
  function rematerialize({ snapshot }: { snapshot: SessionSnapshot }): void {
    const kernel = assembleLayeredDataKernel({ layerSources: loadKernelLayerSources() });
    const livingLayerNames: string[] = [...kernel.layerNames];
    const previousAdditionSources: string[] = [];
    for (const entry of snapshot.additions) {
      const staging = stageLayerAddition({
        languageSource: kernel.languageSource,
        previousAdditionSources,
        draftSource: entry.source,
        livingLayerNames,
        readonlyLayerNames: [...kernel.layerNames],
      });
      if (!staging.ok) continue;
      const applied = applyStagedAddition({
        space: kernel.space,
        staging,
        knownLayerNames: [...livingLayerNames],
        readonlyLayerNames: [...kernel.layerNames],
      });
      livingLayerNames.push(...applied.newLayerNames);
      previousAdditionSources.push(entry.source);
    }
    serverVersionRef.current = snapshot.version;
    setKERNEL(kernel);
    setAdditions(snapshot.additions.map((entry) => ({ source: entry.source, layerNames: [entry.name] })));
    setAddedLayerBlocks(Object.fromEntries(snapshot.additions.map((entry) => [entry.name, entry.source])));
    setSpaceVersion((version) => version + 1);
  }

  /** Connect to the server's session stream on mount; stay local when
   * the server is absent or refuses the access code. */
  useEffect(() => {
    let cancelled = false;
    void connectEditorSync({
      onState: (snapshot) => {
        if (cancelled) return;
        setShared(true);
        rematerialize({ snapshot });
      },
      onPresence: (list) => {
        if (cancelled) return;
        setPresence(list.filter((entry) => entry.id !== syncRef.current?.clientId));
      },
      onEnd: () => {
        if (cancelled) return;
        setShared(false);
        setPresence([]);
      },
    }).then((handle) => {
      if (cancelled) {
        handle?.close();
        return;
      }
      syncRef.current = handle;
    });
    return () => {
      cancelled = true;
      syncRef.current?.close();
      syncRef.current = null;
    };
    // the connection lives for the page's lifetime — no dep array
  }, []);

  /** Report the edited model as this editor's focus. */
  useEffect(() => {
    syncRef.current?.setFocus({ focus: model });
  }, [model, shared]);

  /** Send one accepted gesture to the shared session. The local write
   * already happened; the server's answer only moves the version, or
   * speaks on conflict/refusal — the next state event re-syncs. */
  function sendSharedGesture({ source }: { source: string }): void {
    const sync = syncRef.current;
    if (sync === null) return;
    void sync
      .sendGesture({ source, baseVersion: serverVersionRef.current })
      .then((result) => {
        if (result.status === 200) {
          serverVersionRef.current = result.body.version;
        } else if (result.status === 409) {
          serverVersionRef.current = result.body.version;
          setBanner({ tone: "refused", text: t("another editor wrote first — the shared state was reloaded, replay your gesture") });
        } else if (result.status === 422) {
          serverVersionRef.current = result.body.version;
          setBanner({ tone: "refused", text: t("the server's staging refused the gesture — the shared state was reloaded") });
        }
      })
      .catch(() => {
        // the stream is gone: the onEnd callback falls the editor back to local
      });
  }

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
   * stays intact. Returns the verdict. When `journal` is true (a
   * user gesture), the accepted write pushes the pre-gesture block
   * onto the undo stack; undo/redo pass false to avoid journaling
   * themselves. */
  function proposeEdition({
    draftedSource,
    journal = true,
    modelName,
  }: {
    draftedSource: string;
    journal?: boolean;
    modelName?: string;
  }): boolean {
    const targetModel = modelName ?? model;
    if (targetModel === null) return false;
    const outcome = stageLayerEdition({
      languageSource: KERNEL.languageSource,
      livingAdditions: additions,
      livingLayerNames,
      readonlyLayerNames: KERNEL.layerNames,
      layerName: asLayerName(targetModel),
      editedSource: draftedSource,
      language,
    });
    if (!outcome.ok) {
      setBanner({ tone: "refused", text: editionRefusalText({ outcome }) });
      return false;
    }
    const edition = applyStagedEdition({
      space: KERNEL.space,
      layerName: asLayerName(targetModel),
      staging: outcome.staging,
      readonlyLayerNames: KERNEL.layerNames,
    });
    if (journal && model !== null) {
      // the accepted write enters the undo journal: the model's block
      // BEFORE the gesture, and the redo stack is cleared
      setHistory((previous) => [...previous, { model, block: modelSource }]);
      setFuture([]);
    }
    setAdditions(
      additions.map((addition) =>
        rewriteLivingAddition({ addition, layerName: asLayerName(targetModel), block: edition.block }),
      ),
    );
    setAddedLayerBlocks({ ...addedLayerBlocks, [targetModel]: edition.block });
    setSpaceVersion(spaceVersion + 1);
    sendSharedGesture({ source: draftedSource });
    setBanner({
      tone: "written",
      text: t("staging: 0 verdict — the layer is rewritten, the write is declared, the canvas re-reads the space"),
    });
    return true;
  }

  /** Walk the journal back: the last snapshot is restored THROUGH the
   * staging (the space is mutated in place, so the restore is an
   * edition of the snapshot's block on its model), and the current
   * block moves onto the redo stack. */
  function undo() {
    if (history.length === 0 || model === null) return;
    const snapshot = history[history.length - 1];
    if (snapshot === undefined) return;
    const accepted = proposeEdition({
      draftedSource: snapshot.block,
      journal: false,
      modelName: snapshot.model,
    });
    if (!accepted) return;
    setHistory((previous) => previous.slice(0, -1));
    setFuture((previous) => [...previous, { model, block: modelSource }]);
    setSelected(null);
    setFieldDrafts({});
  }

  /** Walk the journal forward: restore the next redo snapshot the
   * same way. */
  function redo() {
    if (future.length === 0 || model === null) return;
    const snapshot = future[0];
    if (snapshot === undefined) return;
    const accepted = proposeEdition({
      draftedSource: snapshot.block,
      journal: false,
      modelName: snapshot.model,
    });
    if (!accepted) return;
    setFuture((previous) => previous.slice(1));
    setHistory((previous) => [...previous, { model, block: modelSource }]);
    setSelected(null);
    setFieldDrafts({});
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
          text: t(
            "the formalism declares no arc from « {{fromContainer}} » to « {{toContainer}} » — the direction is the formalism's to decide",
            { fromContainer: gesture.fromContainer, toContainer: hit.container },
          ),
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
        text: t("the member is cited — delete the citing arcs first: {{citations}}", {
          citations: citations
            .map((citation) => citation.container + "/" + citation.name + " (" + citation.via + ")")
            .join(", "),
        }),
      });
      return;
    }
    const accepted = proposeEdition({
      draftedSource: draftMemberRemovalCascade({
        block: modelSource,
        container: selected.container,
        name: selected.name,
        positionContainer: positionContainer?.name ?? null,
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

  /** Nudge the selected member by (dx, dy) · step on the canvas —
   * the arrow keys move a vertex, Shift steps ten. Drafts the new
   * position through the staging like any gesture. */
  function nudgeSelected({ dx, dy, step }: { dx: number; dy: number; step: number }) {
    if (selected === null || model === null || positionContainer === null) return;
    const current = readMemberPosition({
      space: KERNEL.space,
      model,
      positionContainer: positionContainer.name,
      name: selected.name,
      visited: new Set<string>(),
    });
    if (current === null) return;
    proposeEdition({
      draftedSource: draftMemberPosition({
        block: modelSource,
        positionContainer: positionContainer.name,
        name: selected.name,
        x: current.x + dx * step,
        y: current.y + dy * step,
        typeReference: typeReferenceText({ address: positionContainer.memberType }),
      }),
    });
  }

  // the keyboard: Suppr deletes, Escape lays down, Ctrl+Z / Ctrl+Shift+Z
  // walk the undo journal, the arrows nudge the selected vertex — never
  // while a text input holds the focus. The handlers live in a ref so
  // the listener subscribes once and always calls the latest closure.
  const handlersRef = useRef({ deleteSelectedMember, undo, redo, nudgeSelected });
  handlersRef.current = { deleteSelectedMember, undo, redo, nudgeSelected };
  useEffect(() => {
    const ARROWS: Record<string, { dx: number; dy: number }> = {
      ArrowLeft: { dx: -1, dy: 0 },
      ArrowRight: { dx: 1, dy: 0 },
      ArrowUp: { dx: 0, dy: -1 },
      ArrowDown: { dx: 0, dy: 1 },
    };
    function handleKeyDown(event: KeyboardEvent) {
      const target = event.target;
      if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) return;
      const handlers = handlersRef.current;
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") {
        event.preventDefault();
        if (event.shiftKey) handlers.redo();
        else handlers.undo();
        return;
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "y") {
        event.preventDefault();
        handlers.redo();
        return;
      }
      if (event.key === "Escape") {
        setTool({ kind: "select" });
        setSelected(null);
        setFieldDrafts({});
        setGesture(null);
        return;
      }
      if ((event.key === "Delete" || event.key === "Backspace") && selected !== null) {
        event.preventDefault();
        handlers.deleteSelectedMember();
        return;
      }
      const arrow = ARROWS[event.key];
      if (arrow !== undefined && selected !== null) {
        event.preventDefault();
        handlers.nudgeSelected({ ...arrow, step: event.shiftKey ? 10 : 1 });
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selected]);

  // the wheel zooms around the cursor — a native listener, the
  // wheel is not passive here; subscribed once, the view is read
  // through the functional update
  useEffect(() => {
    const svgElement = svgRef.current;
    if (svgElement === null) return;
    const svg: SVGSVGElement = svgElement;
    function handleWheel(event: WheelEvent) {
      event.preventDefault();
      const factor = event.deltaY < 0 ? 1.1 : 1 / 1.1;
      const rectangle = svg.getBoundingClientRect();
      const baseX = (CANVAS_WIDTH * (event.clientX - rectangle.left)) / rectangle.width;
      const baseY = (CANVAS_HEIGHT * (event.clientY - rectangle.top)) / rectangle.height;
      setView((previous) => {
        const nextScale = Math.min(MAXIMUM_SCALE, Math.max(MINIMUM_SCALE, previous.scale * factor));
        return {
          scale: nextScale,
          x: baseX - ((baseX - previous.x) * nextScale) / previous.scale,
          y: baseY - ((baseY - previous.y) * nextScale) / previous.scale,
        };
      });
    }
    svg.addEventListener("wheel", handleWheel, { passive: false });
    return () => svg.removeEventListener("wheel", handleWheel);
  }, []);

  // ---- export / import (client-side, no server) ----------------------

  /** Download the current model's block as a .ld file. */
  function exportModel() {
    if (model === null) return;
    const blob = new Blob([modelSource], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = model + ".ld";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  /** Import a .ld file: the whole text is a draft addition, judged by
   * the staging exactly like the creation form. */
  function handleImportFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file === undefined) return;
    void file.text().then((text) => {
      const staging = stageLayerAddition({
        languageSource: KERNEL.languageSource,
        previousAdditionSources: additions.map((addition) => addition.source),
        draftSource: text,
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
      setAdditions([...additions, { source: text.trim(), layerNames: [...applied.newLayerNames] }]);
      const nextBlocks = { ...addedLayerBlocks };
      for (const layerName of applied.newLayerNames) {
        const block = staging.blocks[layerName];
        if (block !== undefined) nextBlocks[layerName] = block;
      }
      setAddedLayerBlocks(nextBlocks);
      setSpaceVersion(spaceVersion + 1);
      if (applied.newLayerNames.length > 0) setModel(applied.newLayerNames[0] ?? null);
      sendSharedGesture({ source: text });
      setBanner({
        tone: "written",
        text: t("the imported draft entered the space — the staging accepted it"),
      });
    });
  }

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
    sendSharedGesture({ source: draftSource });
    setBanner({
      tone: "written",
      text: t("the model enters the space — its palette is read from its formalism"),
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
          {t("the graphical model editor")}
        </span>
        {shared ? (
          <span
            className="rounded border border-emerald-300 bg-emerald-50 px-1.5 py-0.5 text-[11px] text-emerald-700"
            title={presence.map((entry) => entry.focus ?? "…").join(", ")}
          >
            {t("shared — {{editors}} other editor(s) online", { editors: presence.length })}
          </span>
        ) : (
          <span className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[11px] text-slate-500">
            {t("local — no shared session")}
          </span>
        )}
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
          <option value="">{t("no model")}</option>
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
          {t("+ new model")}
        </button>
        <button
          onClick={undo}
          disabled={history.length === 0}
          title={t("undo (Ctrl+Z)")}
          className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50 disabled:opacity-40"
        >
          ↶
        </button>
        <button
          onClick={redo}
          disabled={future.length === 0}
          title={t("redo (Ctrl+Shift+Z)")}
          className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50 disabled:opacity-40"
        >
          ↷
        </button>
        <button
          onClick={() => setShowSource((previous) => !previous)}
          disabled={model === null}
          title={t("show the model's source block")}
          className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50 disabled:opacity-40"
        >
          {t("source")}
        </button>
        <button
          onClick={exportModel}
          disabled={model === null}
          title={t("download the model as .ld")}
          className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50 disabled:opacity-40"
        >
          {t("export .ld")}
        </button>
        <button
          onClick={() => importInputRef.current?.click()}
          title={t("import a .ld draft — judged by the staging")}
          className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50"
        >
          {t("import .ld")}
        </button>
        <input
          ref={importInputRef}
          type="file"
          accept=".ld,.txt"
          className="hidden"
          onChange={handleImportFile}
        />
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
            {t(
              "a model is a layer that refines a formalism — the staging judges the draft, the palette is read from what it refines",
            )}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <input
              value={creationName}
              onChange={(event) => setCreationName(event.target.value)}
              placeholder={t("model name")}
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
              {t("staging — create the model")}
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-12 gap-4">
        {/* the palette: read from the formalism, never hardcoded */}
        <div className="col-span-2 rounded-lg border border-slate-200 bg-white p-2">
          <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
            {t("palette")}
          </div>
          {model === null && (
            <p className="text-[11px] leading-4 text-slate-400">
              {t("no model — create or pick one, the palette follows its formalism")}
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
              {t("pointer")}
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
                title={t("drag from a vertex to another — pre or post, the formalism's rules decide")}
              >
                {t("arc")}
              </button>
            )}
          </div>
        </div>

        {/* the canvas: a reading of the model's truth */}
        <div className={showSource ? "col-span-5" : "col-span-7"}>
          <svg
            ref={svgRef}
            viewBox={"0 0 " + CANVAS_WIDTH + " " + CANVAS_HEIGHT}
            role="application"
            aria-label={t(
              "model canvas — drag vertices to move them, pull an arc from a vertex to another",
            )}
            className="w-full touch-none select-none rounded-lg border border-slate-200 bg-white"
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={() => setGesture(null)}
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
        </div>

        {/* the source panel: the block the canvas reads — shown beside
            the canvas on demand, the only truth made visible */}
        {showSource && model !== null && (
          <div className="col-span-2 rounded-lg border border-slate-200 bg-white p-2">
            <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
              {t("source — the only truth")}
            </div>
            <pre className="max-h-[540px] overflow-auto whitespace-pre-wrap font-mono text-[10px] leading-4 text-slate-600">
              {modelSource}
            </pre>
          </div>
        )}

        {/* the inspector: the selected member and its declared keys */}
        <div className="col-span-3 rounded-lg border border-slate-200 bg-white p-2">
          <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
            {t("inspector")}
          </div>
          {selected === null || selectedDeclaration === null || model === null ? (
            <p className="text-[11px] leading-4 text-slate-400">
              {t(
                "pick a member on the canvas — its declared keys open here, every edition goes through the staging",
              )}
            </p>
          ) : (
            <div>
              <div className="mb-1 font-mono text-[11px] font-semibold text-slate-700">
                {selected.container + "/" + selected.name}
              </div>
              {/* the arc's ends are editable references: type
                  `@model/container/member` — the staging judges it */}
              {selectedDeclaration.kind === "arc" &&
                (["source", "target"] as const).map((key) => {
                  const reference = KERNEL.space.read({
                    layer: asLayerName(model),
                    path: asLayerPath([selected.container, selected.name]),
                    key,
                  });
                  const shown =
                    fieldDrafts[key] ??
                    (reference instanceof AddressView
                      ? "@" + reference.layer + "/" + reference.path.join("/")
                      : "");
                  return (
                    <label key={key} className="mb-1 flex items-center gap-1 text-[11px] text-slate-600">
                      <span className="w-20 shrink-0 font-mono text-slate-400">{key}</span>
                      <input
                        value={shown}
                        spellCheck={false}
                        onChange={(event) => setFieldDrafts({ ...fieldDrafts, [key]: event.target.value })}
                        onBlur={(event) => commitField({ key, text: event.target.value })}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") commitField({ key, text: event.currentTarget.value });
                        }}
                        className="w-40 rounded border border-slate-200 px-1 py-0.5 font-mono text-[11px]"
                      />
                    </label>
                  );
                })}
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
                {t("delete (Suppr)")}
              </button>
            </div>
          )}
          {model !== null && expectations.length > 0 && (
            <div className="mt-2 border-t border-slate-100 pt-2">
              <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                {t("declared expectations")}
              </div>
              {expectations.map((expectation) => (
                <div
                  key={expectation.address}
                  className={
                    "mb-0.5 font-mono text-[10px] leading-4 " +
                    (expectation.holds ? "text-emerald-600" : "text-red-600")
                  }
                >
                  {expectation.address} = {expectation.expected}
                  {expectation.holds ? "" : " ✕"}
                </div>
              ))}
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
