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

import React, { useEffect, useId, useMemo, useRef, useState } from "react";
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
import { DEFAULT_NODE_SIZE, drawnShape, type Glyph, type NodeSize } from "../domain/views.ts";
import { flattenLayer } from "../application/flatten.ts";
import { RefinementDag } from "./workshopInventory.ts";
import { expectationsOf, formatExpectation, readMatchesExpectation } from "../domain/validation.ts";
import { circlePosition, lensLayers, sizeOf } from "./viewTree.ts";
import { EdgeGlyph } from "./glyphs.tsx";
import { glyphBounds, labelPosition, scaledGlyph, vertexGlyphElement } from "./glyphShape.tsx";
import { editionRefusalLabel, labelOf } from "./i18n.ts";
import { t } from "../infrastructure/i18n.ts";
import {
  connectEditorSync,
  type EditorSyncHandle,
  type SessionSnapshot,
} from "../infrastructure/editorSync.ts";
import { onAccessCodeVerified } from "../infrastructure/accessCodeEvents.ts";
import { hashOf } from "../components/Router.tsx";
import {
  readMemberContainers,
  positionContainerOf,
  sizeContainerOf,
  draftMemberSize,
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
  parseArcWaypoints,
  draftArcWaypoints,
  waypointInsertionAt,
  type MemberContainer,
  type ArcWaypoint,
} from "../application/modelEditing.ts";

const CANVAS_WIDTH = 960;
const CANVAS_HEIGHT = 540;
const DRAG_THRESHOLD = 4;
const MAXIMUM_SCALE = 3;
const MINIMUM_SCALE = 0.3;

/** The shape template of a lens entry, as the glyphs read it (null:
 * the lens knows nothing of the type, the dashed fallback). */
type ShapeSpec = Glyph[] | null;

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
 * its size datum (issue #285 — the gabarit's defaults when the model
 * poses none), the lens's shape for its type (null: the dashed
 * fallback). */
interface VertexView {
  container: string;
  name: string;
  position: { x: number; y: number };
  size: NodeSize;
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
  fromVertex: VertexView | null;
  toVertex: VertexView | null;
  spec: ShapeSpec;
  weight: number | null;
  waypoints: ArcWaypoint[];
}

/** The gesture in flight: a pan of the canvas, a drag of one vertex,
 * or an elastic arc being pulled from a vertex. */
type Gesture =
  | {
      kind: "pan";
      clientX: number;
      clientY: number;
      originX: number;
      originY: number;
      moved: boolean;
    }
  | {
      kind: "drag";
      container: string;
      name: string;
      startX: number;
      startY: number;
      x: number;
      y: number;
      moved: boolean;
    }
  | {
      kind: "elastic";
      fromContainer: string;
      fromName: string;
      fromX: number;
      fromY: number;
      x: number;
      y: number;
    }
  | {
      kind: "waypoint";
      container: string;
      name: string;
      index: number;
      startX: number;
      startY: number;
      x: number;
      y: number;
      moved: boolean;
    }
  | {
      kind: "resize" | "rotate";
      container: string;
      name: string;
      startX: number;
      startY: number;
      x: number;
      y: number;
      moved: boolean;
    };

/** The verdict banner of the last gesture: the tribunal's refusal,
 * or the declaration of the write. */
interface Banner {
  tone: "refused" | "written";
  text: string;
}

export function ModelEditorPage({
  language,
}: {
  language: Language;
}) {
  // ---- the kernel, the frame -----------------------------------------
  // Assembled from the corpus files — the same single source the
  // workshop reads. In shared mode (ADR-0110) the kernel is REPLACED
  // by a fresh assembly + the server's additions on every state
  // event, so the server stays the single writer; locally the space
  // is mutated in place by each accepted gesture.
  const [KERNEL, setKERNEL] = useState(() =>
    assembleLayeredDataKernel({ layerSources: loadKernelLayerSources() }),
  );

  // ---- the living workshop -----------------------------------------
  const [additions, setAdditions] = useState<LivingAddition[]>([]);
  const [addedLayerBlocks, setAddedLayerBlocks] = useState<Record<string, string>>({});
  const [spaceVersion, setSpaceVersion] = useState(0);
  // ---- the shared session (ADR-0110): connected to the server's
  // SSE stream, or local when the server is absent ----
  const [shared, setShared] = useState(false);
  const [presence, setPresence] = useState<{ id: string; focus: string | null }[]>([]);
  // true when the session stream was refused (401) or the server is
  // absent — the page then points at the key button of the site
  // header instead of a silent local fallback (issues #198, #222).
  // accessVersion re-triggers the connection after a code is verified.
  const [needsAccess, setNeedsAccess] = useState(false);
  const [accessVersion, setAccessVersion] = useState(0);
  useEffect(
    () =>
      onAccessCodeVerified(() => setAccessVersion((version) => version + 1)),
    [],
  );
  const syncRef = useRef<EditorSyncHandle | null>(null);
  const serverVersionRef = useRef(0);
  // ---- the editor's own choices ------------------------------------
  const [model, setModel] = useState<string | null>(null);
  const [lens, setLens] = useState<string>(() => lensLayers({ space: KERNEL.space })[0] ?? "");
  const [tool, setTool] = useState<EditorTool>({ kind: "select" });
  const [selected, setSelected] = useState<SelectedMember | null>(null);
  const [banner, setBanner] = useState<Banner | null>(null);
  const [fieldDrafts, setFieldDrafts] = useState<Record<string, string>>({});
  // ---- the model creation form -------------------------------------
  const [creationOpen, setCreationOpen] = useState(false);
  const [creationName, setCreationName] = useState("");
  const [creationParents, setCreationParents] = useState<string[]>(() =>
    suggestModelRefines({ space: KERNEL.space, layerNames: KERNEL.layerNames })
      .split(" then ")
      .map((entry) => entry.trim().replace(/^@/, ""))
      .filter((entry) => entry.length > 0),
  );

  // ---- the canvas in motion ----------------------------------------
  const [view, setView] = useState({ x: 0, y: 0, scale: 1 });
  const [gesture, setGesture] = useState<Gesture | null>(null);
  // the last bare tap on a waypoint handle — a second tap within 400ms
  // on the same handle removes the waypoint (issue #220)
  const lastWaypointTapRef = useRef<{
    container: string;
    name: string;
    index: number;
    time: number;
  } | null>(null);
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

  // The candidate parents (issue #218): the living layers that carry
  // member containers — the formalisms a new model can refine.
  const candidateParents = useMemo(
    () =>
      livingLayerNames.filter(
        (layerName) => readMemberContainers({ space: KERNEL.space, model: layerName }).length > 0,
      ),
    [livingLayerNames, spaceVersion],
  );

  const containers = useMemo(() => {
    if (model === null) return [];
    return readMemberContainers({ space: KERNEL.space, model });
  }, [model, spaceVersion]);

  const positionContainer = useMemo(() => positionContainerOf({ containers }), [containers]);

  /** The size container (issue #285): the model's `sizes` block when
   * the formalism poses one — the resize/rotate gestures draft there. */
  const sizeContainer = useMemo(() => sizeContainerOf({ containers }), [containers]);

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
  /** The palette's containers (issue #218): the vocabulary the model
   * itself declares — the first layer of the refinement chain (the
   * model, then its parents in consultation order) that wins at least
   * one container provides the palette. Inherited axis containers
   * (left/right of bipartite-digraph under petrinet-scheme) stay out. */
  const paletteContainers = useMemo(() => {
    if (model === null) return containers;
    const flattened = flattenLayer({ space: KERNEL.space, layer: asLayerName(model) });
    const winnerOf = new Map(
      flattened.root.entries.map((entry) => [entry.key, entry.winner] as const),
    );
    const dag = new RefinementDag({ space: KERNEL.space, layerNames: livingLayerNames });
    const chain: string[] = [];
    const queue = [model];
    const seen = new Set<string>();
    while (queue.length > 0) {
      const current = queue.shift();
      if (current === undefined || seen.has(current)) continue;
      seen.add(current);
      chain.push(current);
      queue.push(...dag.targetsOf(current));
    }
    for (const layerName of chain) {
      // the position container never counts as a vocabulary: a
      // positions layer in the chain must not mask the scheme below it
      const own = containers.filter(
        (container) =>
          container.name !== positionContainer?.name && winnerOf.get(container.name) === layerName,
      );
      if (own.length > 0) return own;
    }
    return containers;
  }, [model, containers, livingLayerNames, spaceVersion, positionContainer]);
  const vertexContainers = useMemo(() => {
    return paletteContainers.filter(
      (container) => container.kind === "sommet" && container.name !== positionContainer?.name,
    );
  }, [paletteContainers, positionContainer]);
  const arcContainers = useMemo(() => {
    return paletteContainers.filter((container) => container.kind === "arc");
  }, [paletteContainers]);

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
    const pending: {
      container: string;
      name: string;
      position: { x: number; y: number } | null;
      size: NodeSize;
      spec: ShapeSpec;
    }[] = [];
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
        const size =
          sizeContainer !== null
            ? (sizeOf({ space: KERNEL.space, source: model, container: sizeContainer.name, name }) ??
              DEFAULT_NODE_SIZE)
            : DEFAULT_NODE_SIZE;
        const shape = drawnShape({
          space: KERNEL.space,
          lens: asLayerName(lens),
          layer: asLayerName(model),
          path: asLayerPath([container.name, name]),
        });
        pending.push({ container: container.name, name, position, size, spec: shape?.spec ?? null });
      }
    }
    const vertices: VertexView[] = pending.map((vertex, index) => ({
      container: vertex.container,
      name: vertex.name,
      position: vertex.position ??
        circlePosition({ index, total: pending.length }) ?? {
          x: CANVAS_WIDTH / 2,
          y: CANVAS_HEIGHT / 2,
        },
      size: vertex.size,
      spec: vertex.spec,
    }));
    const vertexOfMember = (reference: unknown): VertexView | null => {
      if (!(reference instanceof AddressView) || reference.path.length !== 2) return null;
      return (
        vertices.find(
          (candidate) =>
            candidate.container === reference.path[0] && candidate.name === reference.path[1],
        ) ?? null
      );
    };
    const positionOfMember = (reference: unknown): { x: number; y: number } | null => {
      const vertex = vertexOfMember(reference);
      return vertex ? vertex.position : null;
    };
    const arcs: ArcView[] = [];
    for (const container of arcContainers) {
      for (const arcName of readMemberNames({
        space: KERNEL.space,
        model,
        container: container.name,
      })) {
        const shape = drawnShape({
          space: KERNEL.space,
          lens: asLayerName(lens),
          layer: asLayerName(model),
          path: asLayerPath([container.name, arcName]),
        });
        // the arc's label: the first declared annotation key that
        // reads a number — the formalism's data names it, never a
        // hardcoded key
        const labelKey = arcLabelKeyOf({
          space: KERNEL.space,
          model,
          arcContainer: container,
          arcName,
        });
        const label =
          labelKey === null
            ? null
            : KERNEL.space.read({
                layer: asLayerName(model),
                path: asLayerPath([container.name, arcName]),
                key: labelKey,
              });
        arcs.push({
          container: container.name,
          name: arcName,
          from: positionOfMember(
            KERNEL.space.read({
              layer: asLayerName(model),
              path: asLayerPath([container.name, arcName]),
              key: "source",
            }),
          ),
          to: positionOfMember(
            KERNEL.space.read({
              layer: asLayerName(model),
              path: asLayerPath([container.name, arcName]),
              key: "target",
            }),
          ),
          fromVertex: vertexOfMember(
            KERNEL.space.read({
              layer: asLayerName(model),
              path: asLayerPath([container.name, arcName]),
              key: "source",
            }),
          ),
          toVertex: vertexOfMember(
            KERNEL.space.read({
              layer: asLayerName(model),
              path: asLayerPath([container.name, arcName]),
              key: "target",
            }),
          ),
          spec: shape?.spec ?? null,
          weight: typeof label === "number" ? label : null,
          waypoints: parseArcWaypoints({
            value: KERNEL.space.read({
              layer: asLayerName(model),
              path: asLayerPath([container.name, arcName]),
              key: "waypoints",
            }),
          }),
        });
      }
    }
    return { vertices, arcs };
  }, [model, lens, spaceVersion, vertexContainers, arcContainers, positionContainer, sizeContainer]);

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
    setAdditions(
      snapshot.additions.map((entry) => ({ source: entry.source, layerNames: [entry.name] })),
    );
    setAddedLayerBlocks(
      Object.fromEntries(snapshot.additions.map((entry) => [entry.name, entry.source])),
    );
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
      setNeedsAccess(handle === null);
    });
    return () => {
      cancelled = true;
      syncRef.current?.close();
      syncRef.current = null;
    };
    // reconnect when a new access code is verified (issue #198)
  }, [accessVersion]);

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
          setBanner({
            tone: "refused",
            text: t(
              "another editor wrote first — the shared state was reloaded, replay your gesture",
            ),
          });
        } else if (result.status === 422) {
          serverVersionRef.current = result.body.version;
          setBanner({
            tone: "refused",
            text: t("the server's staging refused the gesture — the shared state was reloaded"),
          });
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
      parts.push(
        labelOf({ code: verdict.kind, language }) +
          " — " +
          renderMessage({ message: verdict.fact, language }),
      );
    }
    return parts.join(" ; ");
  }

  /** Render an edition outcome's refusal: the guards first, then the
   * staging's own words. */
  function editionRefusalText({ outcome }: { outcome: EditionOutcome }): string {
    const parts = outcome.refusals.map((refusal) =>
      editionRefusalLabel({ code: refusal, language }),
    );
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
        rewriteLivingAddition({
          addition,
          layerName: asLayerName(targetModel),
          block: edition.block,
        }),
      ),
    );
    setAddedLayerBlocks({ ...addedLayerBlocks, [targetModel]: edition.block });
    setSpaceVersion(spaceVersion + 1);
    sendSharedGesture({ source: draftedSource });
    setBanner({
      tone: "written",
      text: t(
        "staging: 0 failed checks — the layer is rewritten, the write is declared, the canvas re-reads the space",
      ),
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

  /** The viewBox transform of the svg's rendered rect: with the
   * default preserveAspectRatio="xMidYMid meet" the drawing is
   * letterboxed — scale = min(rect/viewBox), centered. Pointer
   * events must go through this mapping, not a plain proportion
   * (issue #221: the canvas now has its own height, the rect aspect
   * differs from the viewBox aspect). */
  function viewBoxTransform(): {
    scale: number;
    offsetX: number;
    offsetY: number;
    left: number;
    top: number;
  } {
    const svg = svgRef.current;
    if (svg === null) return { scale: 1, offsetX: 0, offsetY: 0, left: 0, top: 0 };
    const rectangle = svg.getBoundingClientRect();
    const scale = Math.min(rectangle.width / CANVAS_WIDTH, rectangle.height / CANVAS_HEIGHT);
    return {
      scale,
      offsetX: (rectangle.width - CANVAS_WIDTH * scale) / 2,
      offsetY: (rectangle.height - CANVAS_HEIGHT * scale) / 2,
      left: rectangle.left,
      top: rectangle.top,
    };
  }

  /** The canvas point (viewBox coordinates, before the pan/zoom view)
   * under one pointer position. */
  function toCanvasPoint({ clientX, clientY }: { clientX: number; clientY: number }): {
    x: number;
    y: number;
  } {
    const transform = viewBoxTransform();
    return {
      x: (clientX - transform.left - transform.offsetX) / transform.scale,
      y: (clientY - transform.top - transform.offsetY) / transform.scale,
    };
  }

  /** The world point under one pointer event. */
  function toWorld({ clientX, clientY }: { clientX: number; clientY: number }): {
    x: number;
    y: number;
  } {
    const base = toCanvasPoint({ clientX, clientY });
    return { x: (base.x - view.x) / view.scale, y: (base.y - view.y) / view.scale };
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

  function handleVertexPointerDown(event: React.PointerEvent<SVGGElement>, vertex: VertexView) {
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

  /** Grab one waypoint handle of a selected arc: the gesture drags
   * it, the drop drafts the new `waypoints` field (issue #220). */
  function handleWaypointPointerDown(
    event: React.PointerEvent<SVGCircleElement>,
    arc: ArcView,
    index: number,
  ) {
    event.stopPropagation();
    svgRef.current?.setPointerCapture(event.pointerId);
    const world = toWorld({ clientX: event.clientX, clientY: event.clientY });
    setGesture({
      kind: "waypoint",
      container: arc.container,
      name: arc.name,
      index,
      startX: world.x,
      startY: world.y,
      x: world.x,
      y: world.y,
      moved: false,
    });
  }

  /** A double-click on the arc bends it: the waypoint inserts at the
   * projection of the click on the nearest segment. */
  function handleEdgeDoubleClick(event: React.MouseEvent<SVGGElement>, arc: ArcView) {
    if (arc.from === null || arc.to === null || model === null) return;
    const world = toWorld({ clientX: event.clientX, clientY: event.clientY });
    const insertion = waypointInsertionAt({
      from: arc.from,
      to: arc.to,
      waypoints: arc.waypoints,
      point: world,
    });
    const waypoints = [...arc.waypoints];
    waypoints.splice(insertion.index, 0, insertion.point);
    proposeEdition({
      draftedSource: draftArcWaypoints({
        block: modelSource,
        container: arc.container,
        name: arc.name,
        waypoints,
      }),
    });
  }

  /** A double-click on a waypoint handle removes it. */
  function handleWaypointDoubleClick(arc: ArcView, index: number) {
    if (model === null) return;
    const waypoints = arc.waypoints.filter((_, cursor) => cursor !== index);
    proposeEdition({
      draftedSource: draftArcWaypoints({
        block: modelSource,
        container: arc.container,
        name: arc.name,
        waypoints,
      }),
    });
  }

  /** Grab the resize or rotate handle of the selected vertex (issue
   * #285): the gesture drags it, the drop drafts the `sizes` datum. */
  function handleSizePointerDown(
    event: React.PointerEvent<SVGGElement>,
    vertex: VertexView,
    kind: "resize" | "rotate",
  ) {
    event.stopPropagation();
    svgRef.current?.setPointerCapture(event.pointerId);
    const world = toWorld({ clientX: event.clientX, clientY: event.clientY });
    setGesture({
      kind,
      container: vertex.container,
      name: vertex.name,
      startX: world.x,
      startY: world.y,
      x: world.x,
      y: world.y,
      moved: false,
    });
  }

  /** A double-click on a size handle removes the datum: the node
   * falls back to the gabarit's defaults. */
  function handleSizeHandleDoubleClick(vertex: VertexView, kind: "resize" | "rotate") {
    if (model === null || sizeContainer === null) return;
    void kind;
    proposeEdition({
      draftedSource: draftMemberRemoval({
        block: modelSource,
        container: sizeContainer.name,
        name: vertex.name,
      }),
    });
  }

  /** The live size of a vertex during a resize/rotate gesture. */
  function gestureSizeOf(vertex: VertexView): NodeSize {
    if (
      gesture === null ||
      (gesture.kind !== "resize" && gesture.kind !== "rotate") ||
      gesture.container !== vertex.container ||
      gesture.name !== vertex.name
    ) {
      return vertex.size;
    }
    const center = vertex.position;
    const startDistance = Math.hypot(gesture.startX - center.x, gesture.startY - center.y);
    const distance = Math.hypot(gesture.x - center.x, gesture.y - center.y);
    if (gesture.kind === "resize") {
      const scale = startDistance > 0 ? distance / startDistance : 1;
      return { ...vertex.size, scale: Math.min(4, Math.max(0.25, scale)) };
    }
    const startAngle = (Math.atan2(gesture.startY - center.y, gesture.startX - center.x) * 180) / Math.PI;
    const angle = (Math.atan2(gesture.y - center.y, gesture.x - center.x) * 180) / Math.PI;
    return { ...vertex.size, angle: vertex.size.angle + angle - startAngle };
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
    if (
      gesture.kind === "drag" ||
      gesture.kind === "waypoint" ||
      gesture.kind === "resize" ||
      gesture.kind === "rotate"
    ) {
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
      const moved =
        vertex !== undefined &&
        (Math.abs(gesture.x - gesture.startX) > DRAG_THRESHOLD ||
          Math.abs(gesture.y - gesture.startY) > DRAG_THRESHOLD);
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
    if (gesture.kind === "waypoint") {
      const arc = drawing.arcs.find(
        (candidate) => candidate.container === gesture.container && candidate.name === gesture.name,
      );
      const moved =
        arc !== undefined &&
        (Math.abs(gesture.x - gesture.startX) > DRAG_THRESHOLD ||
          Math.abs(gesture.y - gesture.startY) > DRAG_THRESHOLD);
      // a bare tap on a handle twice in a row removes the waypoint —
      // the pointer capture of the drag retargets the derived
      // dblclick to the svg, so the double-tap is detected here
      if (!moved && arc !== undefined) {
        const now = Date.now();
        const last = lastWaypointTapRef.current;
        if (
          last !== null &&
          last.container === arc.container &&
          last.name === arc.name &&
          last.index === gesture.index &&
          now - last.time < 400
        ) {
          lastWaypointTapRef.current = null;
          if (model !== null) {
            proposeEdition({
              draftedSource: draftArcWaypoints({
                block: modelSource,
                container: arc.container,
                name: arc.name,
                waypoints: arc.waypoints.filter((_, cursor) => cursor !== gesture.index),
              }),
            });
          }
          setGesture(null);
          return;
        }
        lastWaypointTapRef.current = {
          container: arc.container,
          name: arc.name,
          index: gesture.index,
          time: now,
        };
      }
      if (moved && arc !== undefined && model !== null) {
        const original = arc.waypoints[gesture.index];
        if (original !== undefined) {
          const waypoints = [...arc.waypoints];
          waypoints[gesture.index] = {
            x: Math.round(original.x + gesture.x - gesture.startX),
            y: Math.round(original.y + gesture.y - gesture.startY),
          };
          proposeEdition({
            draftedSource: draftArcWaypoints({
              block: modelSource,
              container: arc.container,
              name: arc.name,
              waypoints,
            }),
          });
        }
      }
      setGesture(null);
      return;
    }
    if (gesture.kind === "resize" || gesture.kind === "rotate") {
      const vertex = drawing.vertices.find(
        (candidate) => candidate.container === gesture.container && candidate.name === gesture.name,
      );
      const moved =
        vertex !== undefined &&
        (Math.abs(gesture.x - gesture.startX) > DRAG_THRESHOLD ||
          Math.abs(gesture.y - gesture.startY) > DRAG_THRESHOLD);
      if (moved && vertex !== undefined && model !== null && sizeContainer !== null) {
        const size = gestureSizeOf(vertex);
        proposeEdition({
          draftedSource: draftMemberSize({
            block: modelSource,
            sizeContainer: sizeContainer.name,
            name: gesture.name,
            scale: Math.round(size.scale * 100) / 100,
            angle: Math.round(size.angle),
            typeReference: typeReferenceText({ address: sizeContainer.memberType }),
          }),
        });
      }
      setGesture(null);
      return;
    }
    // the elastic arc: drop on a vertex — the formalism's rules say
    // which container the arc belongs to, or the banner refuses
    if (gesture.kind !== "elastic") {
      setGesture(null);
      return;
    }
    const world = toWorld({ clientX: event.clientX, clientY: event.clientY });
    const hit = drawing.vertices.find((vertex) => {
      if (vertex.container === gesture.fromContainer && vertex.name === gesture.fromName)
        return false;
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
            "the formalism declares no arc from “ {{fromContainer}} ” to “ {{toContainer}} ” — the direction is the formalism's to decide",
            { fromContainer: gesture.fromContainer, toContainer: hit.container },
          ),
        });
      } else {
        const arcName = nextMemberName({
          space: KERNEL.space,
          model,
          container: arcContainer.name,
        });
        proposeEdition({
          draftedSource: draftMemberInsertion({
            block: modelSource,
            container: arcContainer.name,
            name: arcName,
            typeReference: typeReferenceText({ address: arcContainer.memberType }),
            fields: {
              source: memberReferenceText({
                model,
                container: gesture.fromContainer,
                member: gesture.fromName,
              }),
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
      const scale = Math.min(rectangle.width / CANVAS_WIDTH, rectangle.height / CANVAS_HEIGHT);
      const baseX = (event.clientX - rectangle.left - (rectangle.width - CANVAS_WIDTH * scale) / 2) / scale;
      const baseY = (event.clientY - rectangle.top - (rectangle.height - CANVAS_HEIGHT * scale) / 2) / scale;
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
    const refinesText = creationParents.map((parent) => "@" + parent).join(" then ");
    const draftSource = "layer " + creationName.trim() + " refines " + refinesText;
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
    setAdditions([
      ...additions,
      { source: draftSource.trim(), layerNames: [...applied.newLayerNames] },
    ]);
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
    <div className="mx-auto max-w-6xl px-4 py-6" aria-live="off">
      {/* Editor state changes are announced via the banner below */}
      <h1 className="mb-4 text-2xl font-bold text-slate-800 dark:text-slate-100">
        {t("the graphical model editor")}
      </h1>
      {needsAccess && !shared && (
        <div className="mb-4" role="status">
          <p className="text-sm text-slate-600 dark:text-slate-300">
            {t("the shared session needs the site access code — enter it via the key button of the site header to collaborate; the editor also works locally")}
          </p>
        </div>
      )}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <span className="rounded bg-emerald-600 dark:bg-emerald-700 px-1.5 py-0.5 text-[11px] font-bold text-white">
          ✎
        </span>
        <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
          {t("the graphical model editor")}
        </span>
        {shared ? (
          <span
            className="rounded border border-emerald-300 bg-emerald-50 dark:bg-emerald-950 px-1.5 py-0.5 text-[11px] text-emerald-700 dark:text-emerald-300"
            title={presence.map((entry) => entry.focus ?? "…").join(", ")}
          >
            {t("shared — {{editors}} other editor(s) online", { editors: presence.length })}
          </span>
        ) : (
          <span className="rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-1.5 py-0.5 text-[11px] text-slate-500 dark:text-slate-400">
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
          className="rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1 text-xs"
        >
          <option value="">{t("no model")}</option>
          {editableModels.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
        <label className="text-xs text-slate-500 dark:text-slate-400" htmlFor="editor-lens-picker">
          {t("lens")}
        </label>
        <select
          id="editor-lens-picker"
          value={lens}
          onChange={(event) => setLens(event.target.value)}
          title={t("a lens is a layer that refines a display scheme (e.g. @graph-display) and overrides the display fields of each type — shape (circle, ellipse, rectangle, box, path, line), label, fill, stroke, arrow, ports, plus r/rx/ry/w/h, dash, dx/dy, angle, label-side, curve. Define one in formalisms/kernel/*.ld or from the Creation page.")}
          className="rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1 text-xs"
        >
          {lensLayers({ space: KERNEL.space }).map((lensName) => (
            <option key={lensName} value={lensName}>
              {lensName}
            </option>
          ))}
        </select>
        <a
          type="button"
           href={hashOf("formalism", lens)}
          title={t("edit the lens — its DSL source on the formalism page")}
          className="rounded border border-slate-300 dark:border-slate-600 px-2 py-1 text-xs text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 dark:bg-slate-900"
        >
          {t("edit the lens")}
        </a>
        <button type="button"
          onClick={() => setCreationOpen(!creationOpen)}
          title={t("create a new model — pick its parent formalisms in the list")}
          className="rounded bg-sky-600 dark:bg-sky-700 px-3 py-1.5 text-xs font-bold text-white shadow ring-1 ring-sky-300 dark:ring-sky-600 hover:bg-sky-500 dark:hover:bg-sky-600"
        >
          {t("+ new model")}
        </button>
        <button type="button"
          onClick={undo}
          disabled={history.length === 0}
          title={t("undo (Ctrl+Z)")}
          aria-label={t("undo (Ctrl+Z)")}
          className="rounded border border-slate-300 dark:border-slate-600 px-2 py-1 text-xs text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 dark:bg-slate-900 disabled:opacity-40"
        >
          ↶
        </button>
        <button type="button"
          onClick={redo}
          disabled={future.length === 0}
          title={t("redo (Ctrl+Shift+Z)")}
          aria-label={t("redo (Ctrl+Shift+Z)")}
          className="rounded border border-slate-300 dark:border-slate-600 px-2 py-1 text-xs text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 dark:bg-slate-900 disabled:opacity-40"
        >
          ↷
        </button>
        <button type="button"
          onClick={() => setShowSource((previous) => !previous)}
          disabled={model === null}
          title={t("show the model's source block")}
          className="rounded border border-slate-300 dark:border-slate-600 px-2 py-1 text-xs text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 dark:bg-slate-900 disabled:opacity-40"
        >
          {t("source")}
        </button>
        <button type="button"
          onClick={exportModel}
          disabled={model === null}
          title={t("download the model as .ld")}
          className="rounded border border-slate-300 dark:border-slate-600 px-2 py-1 text-xs text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 dark:bg-slate-900 disabled:opacity-40"
        >
          {t("export .ld")}
        </button>
        <button type="button"
          onClick={() => importInputRef.current?.click()}
          title={t("import a .ld draft — judged by the staging")}
          className="rounded border border-slate-300 dark:border-slate-600 px-2 py-1 text-xs text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 dark:bg-slate-900"
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
      </div>

      {creationOpen && (
        <div className="mb-4 rounded-lg border border-sky-200 dark:border-sky-800 bg-sky-50/40 dark:bg-sky-950/40 p-3">
          <p className="mb-2 text-[11px] leading-4 text-slate-500 dark:text-slate-400">
            {t(
              "a model is a layer that refines a formalism — the staging judges the draft, the palette is read from what it refines",
            )}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <input
              value={creationName}
              onChange={(event) => setCreationName(event.target.value)}
              placeholder={t("model name")}
              className="rounded border border-slate-300 dark:border-slate-600 px-2 py-1 text-xs"
            />
            <span className="text-xs text-slate-600 dark:text-slate-400">refines</span>
            <div className="flex max-h-32 flex-wrap gap-1 overflow-auto rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 p-1.5">
              {candidateParents.map((parentName) => (
                <label
                  key={parentName}
                  className={
                    "flex cursor-pointer items-center gap-1 rounded border px-1.5 py-0.5 font-mono text-[10px] " +
                    (creationParents.includes(parentName)
                      ? "border-sky-500 bg-sky-50 dark:bg-sky-950 text-sky-700 dark:text-sky-300"
                      : "border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:border-slate-400")
                  }
                >
                  <input
                    type="checkbox"
                    className="h-3 w-3"
                    checked={creationParents.includes(parentName)}
                    onChange={(event) =>
                      setCreationParents((previous) =>
                        event.target.checked
                          ? [...previous, parentName]
                          : previous.filter((entry) => entry !== parentName),
                      )
                    }
                  />
                  {parentName}
                </label>
              ))}
            </div>
            <button type="button"
              onClick={handleCreateModel}
              disabled={creationName.trim().length === 0}
              className="rounded bg-sky-600 dark:bg-sky-700 px-2 py-1 text-xs font-semibold text-white hover:bg-sky-500 dark:hover:bg-sky-600 disabled:opacity-50"
            >
              {t("staging — create the model")}
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
        {/* the palette: read from the formalism, never hardcoded */}
        <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-2 lg:w-44 lg:shrink-0">
          <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400">
            {t("palette")}
          </div>
          {model === null && (
            <p className="text-[11px] leading-4 text-slate-600 dark:text-slate-400">
              {t("no model — create or pick one, the palette follows its formalism")}
            </p>
          )}
          <div className="flex flex-col gap-1">
            <button type="button"
              onClick={() => setTool({ kind: "select" })}
              className={
                "rounded px-2 py-1 text-left text-[11px] " +
                (tool.kind === "select"
                  ? "bg-sky-600 dark:bg-sky-700 text-white"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-600")
              }
            >
              {t("pointer")}
            </button>
            {vertexContainers.map((container) => (
              <button type="button"
                key={container.name}
                onClick={() => setTool({ kind: "sommet", container: container.name })}
                className={
                  "flex items-center gap-1.5 rounded px-2 py-1 text-left text-[11px] " +
                  (tool.kind === "sommet" && tool.container === container.name
                    ? "bg-sky-600 dark:bg-sky-700 text-white"
                    : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-600")
                }
                title={container.name + " — " + container.annotationKeys.join(", ")}
              >
                <PaletteGlyph
                  spec={drawnShape({
                    space: KERNEL.space,
                    lens: asLayerName(lens),
                    layer: asLayerName(container.memberType[0]),
                    path: asLayerPath(container.memberType[1]),
                  })?.spec ?? null}
                />
                {container.name}
              </button>
            ))}
            {arcContainers.length > 0 && (
              <button type="button"
                onClick={() => setTool({ kind: "arc" })}
                className={
                  "flex items-center gap-1.5 rounded px-2 py-1 text-left text-[11px] " +
                  (tool.kind === "arc"
                    ? "bg-sky-600 dark:bg-sky-700 text-white"
                    : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-600")
                }
                title={t(
                  "drag from a vertex to another — pre or post, the formalism's rules decide",
                )}
              >
                <PaletteGlyph spec={[{ shape: "line", arrow: "plain" }]} />
                {t("arc")}
              </button>
            )}
          </div>
        </div>

        {/* the canvas: a reading of the model's truth */}
        <div className="min-w-0 flex-1">
          <div>
          <svg
            ref={svgRef}
            viewBox={"0 0 " + CANVAS_WIDTH + " " + CANVAS_HEIGHT}
            role="application"
            aria-label={t(
              "model canvas — drag vertices to move them, pull an arc from a vertex to another, drag the square handle of a selected vertex to resize it, the round handle to rotate it (double-click a handle to remove the datum)",
            )}
            className="h-[calc(100vh-13rem)] min-h-[24rem] w-full touch-none select-none rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
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
                const dragOfWaypoint =
                  gesture !== null &&
                  gesture.kind === "waypoint" &&
                  gesture.container === arc.container &&
                  gesture.name === arc.name
                    ? gesture
                    : null;
                const displayWaypoints =
                  dragOfWaypoint !== null
                    ? arc.waypoints.map((point, index) =>
                        index === dragOfWaypoint.index
                          ? {
                              x: point.x + dragOfWaypoint.x - dragOfWaypoint.startX,
                              y: point.y + dragOfWaypoint.y - dragOfWaypoint.startY,
                            }
                          : point,
                      )
                    : arc.waypoints;
                return (
                  <EdgeGlyph
                    key={arc.container + "/" + arc.name}
                    name={arc.name}
                    shape={arc.spec}
                    weight={arc.weight}
                    from={arc.from}
                    to={arc.to}
                    fromShape={arc.fromVertex?.spec ?? null}
                    fromSize={arc.fromVertex?.size}
                    toShape={arc.toVertex?.spec ?? null}
                    toSize={arc.toVertex?.size}
                    waypoints={displayWaypoints}
                    selected={
                      selected !== null &&
                      selected.container === arc.container &&
                      selected.name === arc.name
                    }
                    waypointDragIndex={
                      gesture !== null &&
                      gesture.kind === "waypoint" &&
                      gesture.container === arc.container &&
                      gesture.name === arc.name
                        ? gesture.index
                        : null
                    }
                    onPick={() => {
                      setSelected({ container: arc.container, name: arc.name });
                      setFieldDrafts({});
                    }}
                    onAddWaypoint={(event) => handleEdgeDoubleClick(event, arc)}
                    onWaypointPointerDown={(index, event) => handleWaypointPointerDown(event, arc, index)}
                    onWaypointDoubleClick={(index) => handleWaypointDoubleClick(arc, index)}
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
                    size={gestureSizeOf(vertex)}
                    selected={
                      selected !== null &&
                      selected.container === vertex.container &&
                      selected.name === vertex.name
                    }
                    onPointerDown={(event) => handleVertexPointerDown(event, vertex)}
                    onResizePointerDown={(event) => handleSizePointerDown(event, vertex, "resize")}
                    onRotatePointerDown={(event) => handleSizePointerDown(event, vertex, "rotate")}
                    onSizeHandleDoubleClick={(kind) => handleSizeHandleDoubleClick(vertex, kind)}
                  />
                );
              })}
            </g>
          </svg>
          </div>
          {banner !== null && (
            <div
              role="status"
              aria-live="polite"
              aria-atomic="true"
              className={
                "mt-2 rounded-md border px-2 py-1.5 text-[11px] leading-4 " +
                (banner.tone === "refused"
                  ? "border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950 text-amber-800 dark:text-amber-300"
                  : "border-sky-200 dark:border-sky-800 bg-white dark:bg-slate-800 text-sky-700 dark:text-sky-300")
              }
            >
              {banner.text}
            </div>
          )}
        </div>

        {/* the right column: the source (on demand) and the
            inspector, compact — the canvas keeps the width and the
            height (issue #221) */}
        <div className="flex flex-col gap-4 lg:w-72 lg:shrink-0">
        {showSource && model !== null && (
          <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-2">
            <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400">
              {t("source — the only truth")}
            </div>
            <pre className="max-h-64 overflow-auto whitespace-pre-wrap font-mono text-[10px] leading-4 text-slate-600 dark:text-slate-400">
              {modelSource}
            </pre>
          </div>
        )}

        <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-2">
          <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400">
            {t("inspector")}
          </div>
          {selected === null || selectedDeclaration === null || model === null ? (
            <p className="text-[11px] leading-4 text-slate-600 dark:text-slate-400">
              {t(
                "pick a member on the canvas — its declared keys open here, every edition goes through the staging",
              )}
            </p>
          ) : (
            <div>
              <div className="mb-1 font-mono text-[11px] font-semibold text-slate-700 dark:text-slate-200">
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
                    <label
                      key={key}
                      className="mb-1 flex items-center gap-1 text-[11px] text-slate-600 dark:text-slate-400"
                    >
                      <span className="w-20 shrink-0 font-mono text-slate-600 dark:text-slate-400">{key}</span>
                      <input
                        value={shown}
                        spellCheck={false}
                        onChange={(event) =>
                          setFieldDrafts({ ...fieldDrafts, [key]: event.target.value })
                        }
                        onBlur={(event) => commitField({ key, text: event.target.value })}
                        onKeyDown={(event) => {
                          if (event.key === "Enter")
                            commitField({ key, text: event.currentTarget.value });
                        }}
                        className="w-40 rounded border border-slate-200 dark:border-slate-700 px-1 py-0.5 font-mono text-[11px]"
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
                  <label
                    key={key}
                    className="mb-1 flex items-center gap-1 text-[11px] text-slate-600 dark:text-slate-400"
                  >
                    <span className="w-20 shrink-0 font-mono text-slate-600 dark:text-slate-400">{key}</span>
                    <input
                      value={shown}
                      onChange={(event) =>
                        setFieldDrafts({ ...fieldDrafts, [key]: event.target.value })
                      }
                      onBlur={(event) => commitField({ key, text: event.target.value })}
                      onKeyDown={(event) => {
                        if (event.key === "Enter")
                          commitField({ key, text: event.currentTarget.value });
                      }}
                      className="w-24 rounded border border-slate-200 dark:border-slate-700 px-1 py-0.5 font-mono text-[11px]"
                    />
                  </label>
                );
              })}
              <button type="button"
                onClick={deleteSelectedMember}
                className="mt-1 rounded border border-red-200 dark:border-red-800 px-2 py-1 text-[11px] text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950"
              >
                {t("delete (Suppr)")}
              </button>
            </div>
          )}
          {model !== null && expectations.length > 0 && (
            <div className="mt-2 border-t border-slate-100 dark:border-slate-700 pt-2">
              <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400">
                {t("declared expectations")}
              </div>
              {expectations.map((expectation) => (
                <div
                  key={expectation.address}
                  className={
                    "mb-0.5 font-mono text-[10px] leading-4 " +
                    (expectation.holds ? "text-emerald-600 dark:text-emerald-400 " : "text-red-600 dark:text-red-400")
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
    </div>
  );
}

/** The palette's mini-glyph (issue #218): the lens's shape for the
 * container's member type — a place is an ellipse, a transition a
 * rectangle, an arc a line — the name stays beside it. */
function PaletteGlyph({ spec }: { spec: ShapeSpec }) {
  const arrowId = useId();
  const glyph = spec !== null && spec.length > 0 ? spec[0] : undefined;
  const stroke = (glyph !== undefined && "stroke" in glyph ? glyph.stroke : undefined) ?? "#64748b";
  const fill = (glyph !== undefined && "fill" in glyph ? glyph.fill : undefined) ?? "#ffffff";
  // a vertex glyph renders as a miniature normalised to its bounds
  // (the `path` genre included); the line keeps its own strip
  if (glyph !== undefined && glyph.shape !== "line") {
    const bounds = glyphBounds(glyph);
    const width = Math.max(bounds.x1 - bounds.x0, 1);
    const height = Math.max(bounds.y1 - bounds.y0, 1);
    const scale = Math.min(18 / width, 12 / height, 1);
    const viewX = bounds.x0 - (18 / scale - width) / 2;
    const viewY = bounds.y0 - (12 / scale - height) / 2;
    return (
      <svg width="20" height="14" viewBox={viewX + " " + viewY + " " + 18 / scale + " " + 12 / scale} aria-hidden="true" className="shrink-0">
        <g transform={"translate(" + (-viewX - (18 / scale) / 2) + " " + (-viewY - (12 / scale) / 2) + ") scale(" + scale + ")"}>
          {vertexGlyphElement({ glyph, x: 0, y: 0, strokeWidth: 1.5 / scale })}
        </g>
      </svg>
    );
  }
  return (
    <svg width="20" height="14" viewBox="0 0 20 14" aria-hidden="true" className="shrink-0">
      {glyph === undefined ? (
        <circle cx="10" cy="7" r="5" fill={fill} stroke={stroke} strokeDasharray="2 2" />
      ) : (
        <line x1="2" y1="7" x2="18" y2="7" stroke={stroke} strokeWidth="1.5" markerEnd={"url(#" + arrowId + ")"} />
      )}
      <defs>
        <marker id={arrowId} viewBox="0 0 6 6" refX="5" refY="3" markerWidth="5" markerHeight="5" orient="auto">
          <path d="M0,0 L6,3 L0,6 z" fill={stroke} />
        </marker>
      </defs>
    </svg>
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
  size,
  selected,
  onPointerDown,
  onResizePointerDown,
  onRotatePointerDown,
  onSizeHandleDoubleClick,
}: {
  name: string;
  shape: ShapeSpec;
  position: { x: number; y: number };
  size?: NodeSize | undefined;
  selected: boolean;
  onPointerDown: (event: React.PointerEvent<SVGGElement>) => void;
  onResizePointerDown?: (event: React.PointerEvent<SVGGElement>) => void;
  onRotatePointerDown?: (event: React.PointerEvent<SVGGElement>) => void;
  onSizeHandleDoubleClick?: (kind: "resize" | "rotate") => void;
}) {
  const { x, y } = position;
  const glyphs = shape ?? [];
  const shapeKind = glyphs.length > 0 ? (glyphs[0]?.shape ?? null) : null;
  const stroke = "#94a3b8";
  const strokeWidth = selected ? 2.5 : 1.5;
  const nodeAngle = size?.angle ?? 0;
  const label =
    glyphs.length > 0
      ? labelPosition({ glyph: scaledGlyph(glyphs[0] as Glyph, size?.scale ?? 1), x, y, angle: nodeAngle })
      : null;
  // the handles sit on the EFFECTIVE bounds of the (scaled, rotated)
  // primary glyph — the same bounds the arcs attach to (issue #285)
  const bounds =
    glyphs.length > 0
      ? glyphBounds(scaledGlyph(glyphs[0] as Glyph, size?.scale ?? 1), nodeAngle)
      : { x0: -16, y0: -16, x1: 16, y1: 16 };
  const resizeHandle = { x: x + bounds.x1 + 8, y };
  const rotateHandle = { x, y: y + bounds.y0 - 12 };
  return (
    <g onPointerDown={onPointerDown} style={{ cursor: "grab" }}>
      {glyphs.map((glyph, index) => (
        <g key={index}>{vertexGlyphElement({ glyph, x, y, strokeWidth, size })}</g>
      ))}
      {glyphs.length === 0 && (
        <circle
          cx={x}
          cy={y}
          r={16}
          fill="none"
          stroke={stroke}
          strokeDasharray="3 3"
          strokeWidth={strokeWidth}
        />
      )}
      {selected && (
        <circle
          cx={x}
          cy={y}
          r={Math.max(bounds.x1, bounds.y1) + 5}
          fill="none"
          stroke="#0ea5e9"
          strokeWidth={1}
          strokeDasharray="2 2"
        />
      )}
      {selected && (
        <>
          <rect
            x={resizeHandle.x - 4}
            y={resizeHandle.y - 4}
            width={8}
            height={8}
            className="fill-sky-500 stroke-white dark:stroke-slate-800"
            strokeWidth={1}
            style={{ cursor: "ew-resize" }}
            data-handle={"resize:" + name}
            onPointerDown={onResizePointerDown}
            onDoubleClick={(event) => {
              event.stopPropagation();
              onSizeHandleDoubleClick?.("resize");
            }}
          />
          <circle
            cx={rotateHandle.x}
            cy={rotateHandle.y}
            r={4}
            className="fill-sky-500 stroke-white dark:stroke-slate-800"
            strokeWidth={1}
            style={{ cursor: "crosshair" }}
            data-handle={"rotate:" + name}
            onPointerDown={onRotatePointerDown}
            onDoubleClick={(event) => {
              event.stopPropagation();
              onSizeHandleDoubleClick?.("rotate");
            }}
          />
        </>
      )}
      <text
        x={label?.x ?? x}
        y={label?.y ?? y + 3}
        textAnchor={label?.textAnchor ?? "middle"}
        fontSize={9}
        className={shapeKind === "rectangle" ? "fill-slate-50 dark:fill-slate-100" : shapeKind === null ? "fill-slate-700 dark:fill-slate-300" : "fill-slate-700"}
      >
        {name}
      </text>
    </g>
  );
}
