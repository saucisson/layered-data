// The composition root of the workshop: one kernel assembled from
// the corpus, one refinement graph over it, and the three panels —
// ① the layers, ② the formalism, ③ the reading and its
// resolution (the point of view lives on #lenses, issue #227).
// The first render is a pure
// pass: every derivation is a memo, nothing is written back.
// The panels live in ./presentation/workshop/ (issue #200); this
// file keeps only the state, the handlers and the memos.

import { useMemo, useState } from "react";
import { asLayerName, asLayerPath } from "./domain/identifiers.ts";
import { addressesEqual, PathReference } from "./domain/addresses.ts";
import { Tracer } from "./domain/space.ts";
import { type Language } from "./domain/messages.ts";

import { WORKSHOP_SCENARIOS } from "./presentation/scenarios.ts";

import { say } from "./presentation/i18n.ts";
import { addressText } from "./presentation/valueRendering.tsx";
import {
  editableLayerNames,
  livingLayerBlock,
  rewriteLivingAddition,
  type AppliedEdition,
} from "./application/edition.ts";
import { useToast } from "./components/Toast.tsx";

import {
  KERNEL,
  REFINEMENT_DAG,
  SOURCE_LINE_TARGETS,
  type HistoryEntry,
  type AcceptedAdditionState,
} from "./presentation/workshop/workshopKernel.ts";
import { WorkshopHeader } from "./presentation/workshop/WorkshopHeader.tsx";
import { WorkshopLayersPanel } from "./presentation/workshop/WorkshopLayersPanel.tsx";
import { FormalismPanel } from "./presentation/formalismPanel.tsx";
import { WorkshopFlatPanel, type AddressKeyInfo } from "./presentation/workshop/WorkshopFlatPanel.tsx";
import {
  WorkshopMechanismPanel,
  type ClosureData,
  type SelectedKeyDetail,
} from "./presentation/workshop/WorkshopMechanismPanel.tsx";
import type { AcceptedAddition } from "./presentation/addFormalism.tsx";

// ---- the kernel, the graph, the line-target table -------------
// Assembled once from the corpus files — the single source, never
// an embedded copy. The graph and the line-target table are pure
// derivations of the assembled kernel.

export function WorkshopPage({
  language,
}: {
  language: Language;
}) {
  // The workshop tongue: remembered from the last visit, else
  // detected from the browser, English by default. The choice is
  // written back at every change — it travels by props from here
  // down to every leaf, never by context.
  // A tool, not a demonstrator: the app opens on the workspace —
  // no active scenario at rest; the guided tour S1–S14 stays one
  // click away, folded in the header.
  const [scenarioIndex, setScenarioIndex] = useState(-1);
  const { notify } = useToast();
  const [layer, setLayer] = useState(WORKSHOP_SCENARIOS[0]?.layer ?? "");
  const [path, setPath] = useState<string[]>(WORKSHOP_SCENARIOS[0]?.path ?? []);
  const [selectedKey, setSelectedKey] = useState<string | null>(WORKSHOP_SCENARIOS[0]?.key ?? null);
  // The closure calculation folds — opened automatically by the
  // click on a key, closed with one gesture.
  const [showClosureCalculation, setShowClosureCalculation] = useState(false);
  // The ＋ button of ① — the additions accepted by the staging, as
  // state; the composer opens/closes with one click.
  const [additions, setAdditions] = useState<AcceptedAdditionState[]>([]);
  const [addedLayerBlocks, setAddedLayerBlocks] = useState<Record<string, string>>({});
  const [composerOpen, setComposerOpen] = useState(false);
  // The living editor of ①: the runtime-added layer being rewritten
  // (null = closed). The corpus layers never open here — they are
  // read-only, their ranks frozen.
  const [editorLayer, setEditorLayer] = useState<string | null>(null);
  // The edition writes into the space in place; the reading memos
  // of ③ key on this counter — the panels re-read the living truth,
  // never a stale memoized closure.
  const [spaceVersion, setSpaceVersion] = useState(0);
  // View of panel ①: "graph" (the DAG of refinements, default) or
  // "list" (the principal-parent axis, one parent per layer).
  const [graphView, setGraphView] = useState(true);
  // Tool ergonomics: search (filters ① layers and ② keys), the
  // stack of visited addresses (back), the clipboard (the address
  // is the shareable artifact of the workshop).
  const [search, setSearch] = useState("");
  const [guidedTourOpen, setGuidedTourOpen] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [copied, setCopied] = useState(false);

  // ---- navigation -------------------------------------------------
  // Navigation pushes the current address on the stack; going back
  // pops it. No forward arrow: we move forward by address, never by
  // replaying history (the space may have changed in between).
  // The stack ALSO carries the key being read — each step of the
  // cascade remembers what we were reading there.
  function goto(targetLayer: string, targetPath: string[], targetKey: string | null = null) {
    if (!(targetLayer === layer && targetPath.join("/") === path.join("/"))) {
      setHistory([...history, { layer, path, key: selectedKey }]);
    }
    setLayer(targetLayer);
    setPath(targetPath);
    setSelectedKey(targetKey);
    setCopied(false);
  }

  function goBack() {
    const last = history[history.length - 1];
    if (last === undefined) return;
    setHistory(history.slice(0, -1));
    setLayer(last.layer);
    setPath(last.path);
    setSelectedKey(last.key ?? null);
    setCopied(false);
  }

  function activateScenario(index: number) {
    setScenarioIndex(index);
    if (index < 0) return;
    const scenario = WORKSHOP_SCENARIOS[index];
    if (scenario === undefined) return;
    if (!(scenario.layer === layer && scenario.path.join("/") === path.join("/"))) {
      setHistory([...history, { layer, path, key: selectedKey }]);
    }
    setLayer(scenario.layer);
    setPath(scenario.path);
    setSelectedKey(scenario.key);
    setShowClosureCalculation(true);
    setCopied(false);
  }

  // A line of the layer source opens its step — the address it writes
  // enters on the right of the cascade, the key is read there, the
  // calculation unfolds: the resolution becomes a story.
  function openSourceLine(target: { layer: string; path: string[]; key: string | null }) {
    goto(target.layer, target.path, target.key);
    setShowClosureCalculation(true);
  }

  // ---- search and clipboard --------------------------------------
  // Search: minimal normalization (lowercase); Enter goes to the
  // first matching layer, otherwise selects the first matching key
  // of the current address; Escape empties the field; Ctrl+K
  // returns to it from anywhere (onKeyDown of the container).
  const needle = search.toLowerCase();
  const layerMatches = (layerName: string) => !needle || layerName.toLowerCase().includes(needle);
  const keyMatches = (key: string) => !needle || key.toLowerCase().includes(needle);
  function submitSearch() {
    // The search also walks the layers added at runtime.
    const first = livingLayerNames.find((layerName) => layerMatches(layerName));
    if (first) {
      goto(first, []);
      return;
    }
    const match = addressKeys.find((info) => keyMatches(info.key));
    if (match) {
      setSelectedKey(match.key);
      setShowClosureCalculation(true);
    }
  }
  function copyAddress() {
    // Silent copy: outside a browser (render harness) nothing
    // happens — the tool lives in the canvas, the button is
    // measured there.
    try {
      (globalThis as any).navigator?.clipboard?.writeText?.(
        addressText([layer, path]) + (selectedKey ? " :: " + selectedKey : ""),
      );
    } catch {
      // clipboard unavailable: the copy is best-effort
    }
    setCopied(true);
    notify(say({ language, en: "Address copied to clipboard" }), "success");
  }

  // ---- additions --------------------------------------------------
  // The ＋ flow: the staging judged the draft, the space holds the
  // layers; the workshop keeps the source (for the next stagings),
  // the blocks (for the language tab) and extends the graph — the
  // ranks of the corpus stay frozen, only the living inventory
  // grows.
  function registerAddition(addition: AcceptedAddition) {
    setAdditions([...additions, { source: addition.source, layerNames: addition.newLayerNames }]);
    const nextBlocks = { ...addedLayerBlocks };
    for (const layerName of addition.newLayerNames) {
      if (addition.blocks[layerName]) nextBlocks[layerName] = addition.blocks[layerName];
    }
    setAddedLayerBlocks(nextBlocks);
    for (const [layerName, targets] of Object.entries(addition.refinementTargets)) {
      REFINEMENT_DAG.addLayer({ layerName, targets });
    }
  }
  function handleComposerAdded(addition: AcceptedAddition) {
    registerAddition(addition);
    setComposerOpen(false);
    const firstNewLayer = addition.newLayerNames[0];
    if (firstNewLayer !== undefined) goto(firstNewLayer, []);
  }
  function handleWardrobeAdded(addition: AcceptedAddition) {
    registerAddition(addition);
    const firstNewLayer = addition.newLayerNames[0];
    if (firstNewLayer !== undefined) goto(firstNewLayer, []);
  }

  // The ＋ flow's sibling: the editor's staging accepted the
  // rewritten layer, the space holds the new tree — the workshop
  // keeps the edited source (for the next stagings and the language
  // tab), re-aims the graph, and counts a re-read so ③ serves the
  // living truth.
  function handleEditorApplied(edition: AppliedEdition) {
    setAdditions(
      additions.map((addition) =>
        rewriteLivingAddition({ addition, layerName: edition.layerName, block: edition.block }),
      ),
    );
    setAddedLayerBlocks({ ...addedLayerBlocks, [edition.layerName]: edition.block });
    REFINEMENT_DAG.retargetLayer({
      layerName: edition.layerName,
      targets: edition.refinementTargetsOf,
    });
    setSpaceVersion(spaceVersion + 1);
    setEditorLayer(null);
  }

  // ---- readings of the current address ----------------------------
  // Closure + trace of the mechanism (depth 1 only).
  const closureData = useMemo(() => {
    const tracer = new Tracer();
    const closure = KERNEL.space.closure({
      layer: asLayerName(layer),
      path: asLayerPath(path),
      tracer,
      trace: true,
    });
    const events = tracer.events.filter((event) => event.depth === 1);
    return { closure, events } as ClosureData;
  }, [layer, path, spaceVersion]);

  // Visible keys + winner for each key.
  const addressKeys = useMemo(() => {
    const keys = KERNEL.space.keys({ layer: asLayerName(layer), path: asLayerPath(path) });
    return keys.map((key) => {
      const scan: any[] = [];
      const value = KERNEL.space.read({
        layer: asLayerName(layer),
        path: asLayerPath(path),
        key,
        scan,
      });
      const last = scan.length ? scan[scan.length - 1] : null;
      const winner = last && last.status === "fournit" ? last.source : null;
      return { key, value, winner, scan } as AddressKeyInfo;
    });
  }, [layer, path, spaceVersion]);

  // Keys of ② filtered by the search: find the key that matters,
  // not scroll the list.
  const shownKeys = addressKeys.filter((info) => keyMatches(info.key));

  // Detail of the selected key (trace of its reference resolution only).
  const selectedKeyDetail = useMemo(() => {
    if (!selectedKey) return null;
    const scan: any[] = [];
    const value = KERNEL.space.read({
      layer: asLayerName(layer),
      path: asLayerPath(path),
      key: selectedKey,
      scan,
    });
    const last = scan.length ? scan[scan.length - 1] : null;
    const winner = last && last.status === "fournit" ? last.source : null;
    let referenceEvents: any[] = [];
    if (last && last.raw instanceof PathReference) {
      referenceEvents = KERNEL.space
        .traceReferenceResolution({
          reference: last.raw,
          holder: [asLayerName(layer), asLayerPath(path)],
        })
        .events.filter((event: any) => event.kind === "refsearch" && event.depth === 1);
    }
    return { value, scan, winner, referenceEvents } as SelectedKeyDetail;
  }, [layer, path, selectedKey, spaceVersion]);

  const statusBySource = useMemo(() => {
    const map = new Map<string, string>();
    if (selectedKeyDetail) {
      selectedKeyDetail.scan.forEach((observation: any) =>
        map.set(addressText(observation.source), observation.status),
      );
    }
    return map;
  }, [selectedKeyDetail]);

  const winnerIndex = useMemo(() => {
    if (!selectedKeyDetail || !selectedKeyDetail.winner) return -1;
    return closureData.closure.findIndex((address) =>
      addressesEqual(address, selectedKeyDetail.winner!),
    );
  }, [closureData, selectedKeyDetail]);

  const activeScenario = scenarioIndex >= 0 ? WORKSHOP_SCENARIOS[scenarioIndex] : null;
  const currentAddress: [string, string[]] = [layer, path];

  // The story of the steps — the address stack becomes a strip, the
  // current address is its last step; pure derivation, nothing is
  // stored twice.
  const cascade = [...history, { layer, path, key: selectedKey }];

  // The living layers — the loaded corpus plus those added at
  // runtime; the structures of ① extend on addition, the ranks of
  // the corpus stay frozen.
  const livingLayerNames = useMemo(
    () => [...KERNEL.layerNames, ...additions.flatMap((addition) => addition.layerNames)],
    [additions],
  );

  // The editable layers: the living ones minus the corpus — a
  // living layer re-enters the tribunal, a corpus layer never does.
  const editableLayerSet = useMemo(
    () =>
      new Set(
        editableLayerNames({
          livingLayerNames,
          readonlyLayerNames: KERNEL.layerNames,
        }).map((name) => name as string),
      ),
    [livingLayerNames],
  );

  // The editor of ① opens on the block the workshop kept (or the
  // block extracted from the owning addition's source).
  const editorInitialSource =
    editorLayer === null
      ? ""
      : livingLayerBlock({
          layerName: asLayerName(editorLayer),
          keptBlocks: addedLayerBlocks,
          livingAdditions: additions,
        });

  // ---- the render --------------------------------------------------
  return (
    <div
      className="min-h-screen bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
      onKeyDown={(event: any) => {
        // Ctrl+K / ⌘K: bring the focus back on the search, from
        // anywhere — without useEffect, timer or context (the
        // render stays a pure pass, measurable by the harness).
        if ((event.ctrlKey || event.metaKey) && (event.key === "k" || event.key === "K")) {
          event.preventDefault();
          const element = (globalThis as any).document?.getElementById?.("workshop-search");
          if (element) element.focus();
        }
      }}
    >
      <WorkshopHeader
        language={language}
        search={search}
        onSearchChange={setSearch}
        onSubmitSearch={submitSearch}
        guidedTourOpen={guidedTourOpen}
        onToggleGuidedTour={() => setGuidedTourOpen(!guidedTourOpen)}
        scenarioIndex={scenarioIndex}
        onActivateScenario={activateScenario}
        activeScenario={activeScenario ?? null}
        onCloseScenario={() => setScenarioIndex(-1)}
      />

      <div
        className={
          graphView
            ? "grid grid-cols-1 gap-3 p-2 sm:p-4"
            : "grid grid-cols-1 gap-3 p-2 sm:p-4 lg:grid-cols-[220px_minmax(0,1fr)_minmax(0,1fr)_380px]"
        }
      >
        <WorkshopLayersPanel
          language={language}
          kernel={KERNEL}
          dag={REFINEMENT_DAG}
          layer={layer}
          search={search}
          graphView={graphView}
          onGraphViewChange={setGraphView}
          composerOpen={composerOpen}
          onComposerToggle={() => setComposerOpen(!composerOpen)}
          additions={additions}
          livingLayerNames={livingLayerNames}
          addedLayerBlocks={addedLayerBlocks}
          onComposerAdded={handleComposerAdded}
          onWardrobeAdded={handleWardrobeAdded}
          editorLayer={editorLayer}
          editorInitialSource={editorInitialSource}
          onEditorApplied={handleEditorApplied}
          onEditorClose={() => setEditorLayer(null)}
          onPickLayer={goto}
          closureSet={new Set(closureData.closure.map((address) => address[0]))}
          layerMatches={layerMatches}
          editableLayerSet={editableLayerSet}
          onEditorToggle={(layerName) => setEditorLayer(editorLayer === layerName ? null : layerName)}
        />

        {/* ② the formalism — side by side with ③ the flattened
            data (issue #239) */}
        <FormalismPanel
          kernel={KERNEL}
          layer={layer}
          language={language}
          addedLayerSources={addedLayerBlocks}
          sourceLineTargets={SOURCE_LINE_TARGETS}
          onPick={goto}
          onLine={openSourceLine}
        />

        <WorkshopFlatPanel
          language={language}
          layer={layer}
          path={path}
          onResetPath={() => setPath([])}
          onSegmentClick={(index) => setPath(path.slice(0, index + 1))}
          historyLength={history.length}
          onBack={goBack}
          copied={copied}
          onCopyAddress={copyAddress}
          shownKeys={shownKeys}
          addressKeysCount={addressKeys.length}
          search={search}
          selectedKey={selectedKey}
          onSelectKey={setSelectedKey}
          onGotoAddress={goto}
          onShowClosure={() => setShowClosureCalculation(true)}
        />

        <WorkshopMechanismPanel
          language={language}
          kernel={KERNEL}
          currentAddress={currentAddress}
          selectedKey={selectedKey}
          closureData={closureData}
          statusBySource={statusBySource}
          winnerIndex={winnerIndex}
          selectedKeyDetail={selectedKeyDetail}
          onGoto={goto}
          cascade={cascade}
          showClosureCalculation={showClosureCalculation}
          onToggleClosure={() => setShowClosureCalculation(!showClosureCalculation)}
        />
      </div>

      {/* The panels are counted on one hand — ① the layers, ② the
          formalism, ③ the reading and its resolution; the ＋ button
          of ① covers the flow, from the request to the validation */}

      {/* The diagnostics and the validation live in the
          "Diagnostics & validation" fold of the formalism (②), the
          flattened view and the language in its tabs; no
          standalone panel at the end of the page */}

      <footer className="px-5 pb-6 text-[10px] leading-4 text-slate-600 dark:text-slate-400">
        {say({
          language,
          en:
            "Measured workshop: the kernel's behavior is pinned by the " +
            "executable specification — property checks over the whole " +
            "corpus, self-contained harness, no external call; first " +
            "render a pure pass, without side effect. The figures quoted " +
            "in the workshop are measured by that same harness.",
        })}
      </footer>
    </div>
  );
}
