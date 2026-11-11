// The composition root of the workshop: one kernel assembled from
// the corpus, one refinement graph over it, and the four panels —
// ① the layers, ② the formalism, ③ the reading and its
// resolution, ④ the point of view. The first render is a pure
// pass: every derivation is a memo, nothing is written back.

import { useMemo, useState } from "react";
import { asLayerName, asLayerPath } from "./domain/identifiers.ts";
import { AddressView, PathReference, addressesEqual } from "./domain/addresses.ts";
import { Tracer } from "./domain/space.ts";
import { type Language } from "./domain/messages.ts";
import { coversAddresses, dressingEntries, type Glyph } from "./domain/views.ts";
import { assembleLayeredDataKernel } from "./application/corpus.ts";
import { loadKernelLayerSources } from "./infrastructure/corpusLoader.ts";

import {
  LAYER_COLOR,
  LAYER_ROLE,
  PRINCIPAL_PARENT,
  RefinementDag,
} from "./presentation/workshopInventory.ts";
import { WORKSHOP_SCENARIOS } from "./presentation/scenarios.ts";

import { localized, say } from "./presentation/i18n.ts";
import {
  KernelValue,
  StatusPill,
  TraceEventRow,
  addressText,
} from "./presentation/valueRendering.tsx";
import { LayerBadge } from "./presentation/layerBadge.tsx";
import { RefinesGraph } from "./presentation/refinesGraph.tsx";
import { FormalismPanel } from "./presentation/formalismPanel.tsx";
import { AccessCodeForm } from "./presentation/accessForm.tsx";
import { AddFormalismComposer, type AcceptedAddition } from "./presentation/addFormalism.tsx";
import { DiskWardrobe } from "./presentation/diskWardrobe.tsx";
import { LayerEditor } from "./presentation/layerEditor.tsx";
import {
  editableLayerNames,
  livingLayerBlock,
  rewriteLivingAddition,
  type AppliedEdition,
} from "./application/edition.ts";
import { CascadeCard } from "./presentation/cascadeMap.tsx";
import { buildSourceLineTargets, type SourceLineTarget } from "./presentation/layerSourceView.tsx";
import { NodeGlyph, EdgeGlyph } from "./presentation/glyphs.tsx";
import {
  LENS_LAYERS,
  VIEWPOINT_LAYERS,
  VIEW_NOTES,
  bindingOf,
  groupTree,
  shapeLabel,
} from "./presentation/viewTree.ts";
import { buildWorkshopLook } from "./presentation/lensDrawing.ts";

// ---- the kernel, the graph, the line-target table -------------
// Assembled once from the corpus files — the single source, never
// an embedded copy. The graph and the line-target table are pure
// derivations of the assembled kernel.

const KERNEL = assembleLayeredDataKernel({ layerSources: loadKernelLayerSources() });
const REFINEMENT_DAG = new RefinementDag({ space: KERNEL.space, layerNames: KERNEL.layerNames });
const SOURCE_LINE_TARGETS = buildSourceLineTargets({ parsedLanguage: KERNEL.parsedLanguage });

/** One entry of the address history: where we were, and which key
 * we were reading there. */
interface HistoryEntry {
  layer: string;
  path: string[];
  key: string | null;
}

/** One glyph selected in the drawing of ④. */
interface SelectedGlyph {
  kind: "vertex" | "edge";
  name: string;
}

/** One accepted ＋ addition, kept as workshop state. */
interface AcceptedAdditionState {
  source: string;
  layerNames: string[];
}

export function WorkshopPage({
  language,
  onChooseLanguage,
}: {
  language: Language;
  onChooseLanguage: (lang: Language) => void;
}) {
  // The workshop tongue: remembered from the last visit, else
  // detected from the browser, English by default. The choice is
  // written back at every change — it travels by props from here
  // down to every leaf, never by context.
  // A tool, not a demonstrator: the app opens on the workspace —
  // no active scenario at rest; the guided tour S1–S14 stays one
  // click away, folded in the header.
  const [scenarioIndex, setScenarioIndex] = useState(-1);
  const [layer, setLayer] = useState(WORKSHOP_SCENARIOS[0]?.layer ?? "");
  const [path, setPath] = useState<string[]>(WORKSHOP_SCENARIOS[0]?.path ?? []);
  const [selectedKey, setSelectedKey] = useState<string | null>(WORKSHOP_SCENARIOS[0]?.key ?? null);
  // The closure calculation folds — opened automatically by the
  // click on a key, closed with one gesture.
  const [showClosureCalculation, setShowClosureCalculation] = useState(false);
  // The selected glyph names a shape of the current drawing —
  // kind + name are enough.
  const [selectedGlyph, setSelectedGlyph] = useState<SelectedGlyph | null>(null);
  // The look chosen in the tree of ④ — a lens dresses the current
  // model of ①, a viewpoint imposes its own; default: the dinner
  // course.
  const [selectedView, setSelectedView] = useState("pn-philosophers-5-course");
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
  function openSourceLine(target: SourceLineTarget) {
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
    return { closure, events };
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
      return { key, value, winner, scan };
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
    return { value, scan, winner, referenceEvents };
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
      addressesEqual(address, selectedKeyDetail!.winner!),
    );
  }, [closureData, selectedKeyDetail]);

  const activeScenario = scenarioIndex >= 0 ? WORKSHOP_SCENARIOS[scenarioIndex] : null;
  const currentAddress: [string, string[]] = [layer, path];

  // The story of the steps — the address stack becomes a strip, the
  // current address is its last step; pure derivation, nothing is
  // stored twice.
  const cascade = [...history, { layer, path, key: selectedKey }];

  // ---- the current look (panel ④) ---------------------------------
  // Pure derivation — the tree chooses, the drawing follows. A
  // lone lens applies to the current model of ①; a viewpoint
  // imposes its own model; without decided positions, the circle
  // layout takes over.
  const look = useMemo(
    () => buildWorkshopLook({ space: KERNEL.space, selectedView, currentLayer: layer }),
    [selectedView, layer],
  );

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
      className="min-h-screen bg-slate-100 dark:bg-slate-800 text-slate-900"
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
      <header className="border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-5 py-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h1 className="text-lg font-bold">
            {say({
              language,
              en: "The formalism design workshop — data in strata",
              fr: "L'atelier de conception des formalismes — les données en strates",
            })}
          </h1>
          <span className="flex shrink-0 items-center gap-1 text-xs">
            <span className="mr-1 text-slate-600">
              {say({ language, en: "language: ", fr: "langue : " })}
            </span>
            {(["en", "fr"] as Language[]).map((choice) => (
              <button type="button"
                key={choice}
                onClick={() => onChooseLanguage(choice)}
                className={
                  "rounded border px-1.5 py-0.5 font-bold uppercase " +
                  (language === choice
                    ? "border-slate-800 bg-slate-800 text-white"
                    : "border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-500 hover:border-slate-500")
                }
              >
                {choice}
              </button>
            ))}
          </span>
        </div>
        <p className="mt-2 text-xs text-slate-500">
          {say({
            language,
            fr: "Atelier de conception des formalismes — données en strates, raffinement, lecture premier-gagné",
            en: "Formalism design workshop — data in strata, refinement, first-winner reading",
          })}
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <input
            id="workshop-search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            onKeyDown={(event: any) => {
              if (event.key === "Enter") submitSearch();
              if (event.key === "Escape") setSearch("");
            }}
            placeholder={say({
              language,
              fr:
                "Rechercher — couche, ou clé de l'adresse courante ; " +
                "Entrée : y aller · Ctrl+K",
              en: "Search — layer, or key of the current address; " + "Enter: go there · Ctrl+K",
            })}
            className="min-w-[240px] flex-1 rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-1.5 font-mono text-xs focus:border-slate-500 focus:outline-none"
          />
          <button type="button"
            onClick={() => setGuidedTourOpen(!guidedTourOpen)}
            aria-expanded={guidedTourOpen}
            title={say({
              language,
              fr: "les scénarios S1–S14 : le curriculum guidé de l'atelier",
              en: "the S1–S14 scenarios: the workshop's guided curriculum",
            })}
            className={
              "rounded-full border px-3 py-1 text-xs font-medium transition-colors " +
              (guidedTourOpen
                ? "border-slate-800 bg-slate-800 text-white"
                : "border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-600 hover:border-slate-500")
            }
          >
            {say({ language, fr: "Visite guidée S1–S14", en: "Guided tour S1–S14" })}{" "}
            {guidedTourOpen ? "▾" : "▸"}
          </button>
        </div>
        {guidedTourOpen && (
          <div className="mt-3 flex flex-wrap gap-2">
            {WORKSHOP_SCENARIOS.map((scenario, index) => (
              <button type="button"
                key={scenario.id}
                onClick={() => activateScenario(index)}
                title={localized({ language, text: scenario.text }).slice(0, 120) + "…"}
                className={
                  "rounded-full border px-3 py-1 text-xs font-medium transition-colors " +
                  (scenarioIndex === index
                    ? "border-slate-800 bg-slate-800 text-white"
                    : "border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-600 hover:border-slate-500")
                }
              >
                {scenario.id} · {localized({ language, text: scenario.label })}
              </button>
            ))}
          </div>
        )}
      </header>

      {/* The tutorial at the top: the workshop is learned before
              it is used — the addresses of the stratigraphic column navigate the
              space like the rest of the tool (goto: the address is
              the artifact) */}

      {activeScenario && (
        <div className="mx-4 mt-3 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-4 py-3 text-sm leading-6 text-slate-700 dark:text-slate-200 shadow-sm">
          <div className="mb-1 flex items-center gap-2">
            <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[11px] font-bold text-white">
              {activeScenario.id}
            </span>
            <span className="font-semibold">
              {localized({ language, text: activeScenario.label })}
            </span>
            <button type="button"
              className="ml-auto rounded px-2 text-slate-600 hover:bg-slate-100 dark:bg-slate-800 hover:text-slate-700 dark:text-slate-200"
              onClick={() => setScenarioIndex(-1)}
              aria-label={say({ language, fr: "fermer le scénario", en: "close the scenario" })}
            >
              ×
            </button>
          </div>
          {localized({ language, text: activeScenario.text })}
        </div>
      )}

      <main
        id="main-content"
        className={
          graphView
            ? "grid grid-cols-1 gap-3 p-4"
            : "grid grid-cols-1 gap-3 p-4 lg:grid-cols-[240px_minmax(0,1fr)_430px]"
        }
      >
        {/* ① the layers */}
        <section className="space-y-3" role="region" aria-labelledby="panel-layers-heading">
          <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-3">
            <h2 id="panel-layers-heading" className="mb-2 flex items-center gap-2 text-sm font-bold text-slate-800 dark:text-slate-100">
              {say({ language, fr: "① Les couches", en: "① The layers" })}
              <span className="font-normal text-slate-600">
                {graphView
                  ? say({
                      language,
                      fr: "le graphe des raffinements",
                      en: "the graph of refinements",
                    })
                  : say({ language, fr: "et leurs bruts", en: "and their raws" })}
              </span>
              <span className="ml-auto flex overflow-hidden rounded border border-slate-300 dark:border-slate-600 text-[10px] leading-4">
                <button type="button"
                  onClick={() => setGraphView(false)}
                  className={
                    "px-2 " +
                    (!graphView
                      ? "bg-slate-800 text-white"
                      : "bg-white dark:bg-slate-800 text-slate-500 hover:bg-slate-50 dark:bg-slate-900")
                  }
                >
                  {say({ language, fr: "liste", en: "list" })}
                </button>
                <button type="button"
                  onClick={() => setGraphView(true)}
                  className={
                    "px-2 " +
                    (graphView
                      ? "bg-slate-800 text-white"
                      : "bg-white dark:bg-slate-800 text-slate-500 hover:bg-slate-50 dark:bg-slate-900")
                  }
                >
                  {say({ language, fr: "graphe", en: "graph" })}
                </button>
              </span>
              <button type="button"
                onClick={() => setComposerOpen(!composerOpen)}
                title={say({
                  language,
                  fr:
                    "ajouter un formalisme — le candidat passe par le staging : " +
                    "corpus + suppléments revalidés entiers, 0 verdict d'assemblage exigé",
                  en:
                    "add a formalism — the candidate goes through staging: " +
                    "whole corpus + supplements revalidated, 0 assembly verdict demanded",
                })}
                className={
                  "ml-1 rounded-full border px-2 text-sm font-bold leading-5 " +
                  (composerOpen
                    ? "border-emerald-600 bg-emerald-600 text-white"
                    : "border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-500 hover:border-emerald-500 hover:text-emerald-600")
                }
              >
                ＋
              </button>
            </h2>
            {composerOpen && (
              <div className="space-y-2">
                <AccessCodeForm language={language} />
                <AddFormalismComposer
                  kernel={KERNEL}
                  language={language}
                  livingLayerNames={livingLayerNames}
                  previousAdditionSources={additions.map((addition) => addition.source)}
                  onAdded={handleComposerAdded}
                />
                <DiskWardrobe
                  kernel={KERNEL}
                  language={language}
                  livingLayerNames={livingLayerNames}
                  previousAdditionSources={additions.map((addition) => addition.source)}
                  localLayerSources={addedLayerBlocks}
                  onAdded={handleWardrobeAdded}
                />
              </div>
            )}
            {editorLayer !== null && (
              <LayerEditor
                kernel={KERNEL}
                language={language}
                layerName={editorLayer}
                initialSource={editorInitialSource}
                livingAdditions={additions}
                livingLayerNames={livingLayerNames}
                onApplied={handleEditorApplied}
                onClose={() => setEditorLayer(null)}
              />
            )}
            {graphView ? (
              <RefinesGraph
                layer={layer}
                search={search}
                language={language}
                layerNames={livingLayerNames}
                dag={REFINEMENT_DAG}
                closureSet={new Set(closureData.closure.map((address) => address[0]))}
                onPick={(layerName) => goto(layerName, [])}
              />
            ) : (
              <div className="space-y-1" onKeyDown={(event) => {
                if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
                const buttons = Array.from(event.currentTarget.querySelectorAll("button"));
                const currentIndex = buttons.findIndex((button) => button === document.activeElement);
                if (currentIndex === -1) return;
                event.preventDefault();
                const nextIndex = event.key === "ArrowDown"
                  ? Math.min(currentIndex + 1, buttons.length - 1)
                  : Math.max(currentIndex - 1, 0);
                buttons[nextIndex]?.focus();
              }}>
                {livingLayerNames.filter(layerMatches).length === 0 && (
                  <div className="py-2 text-xs text-slate-600">
                    {say({
                      language,
                      fr: "Aucune couche ne correspond à « " + search + " ».",
                      en: "No layer matches « " + search + " ».",
                    })}
                  </div>
                )}
                {livingLayerNames.filter(layerMatches).map((layerName) => {
                  const depth = (() => {
                    let steps = 0;
                    let current: string | null = layerName;
                    // != null covers undefined: a layer forgotten in
                    // PRINCIPAL_PARENT gives a wrong indentation, not
                    // an infinite loop.
                    while (current != null) {
                      current = PRINCIPAL_PARENT[current] ?? null;
                      steps += 1;
                    }
                    return steps - 1;
                  })();
                  const inClosure = closureData.closure.some((address) => address[0] === layerName);
                  return (
                    <div key={layerName} style={{ marginLeft: depth * 10 }}>
                      <div className="flex items-center gap-1">
                        <button type="button"
                          onClick={() => goto(layerName, [])}
                          title={localized({
                            language,
                            text: LAYER_ROLE[layerName] ?? { en: layerName, fr: layerName },
                          })}
                          className={
                            "flex flex-1 items-center gap-2 rounded-md px-2 py-1 text-left text-xs transition-colors " +
                            (layerName === layer
                              ? "bg-slate-100 dark:bg-slate-800 ring-1 ring-slate-400"
                              : "hover:bg-slate-50 dark:bg-slate-900") +
                            (inClosure ? " font-semibold" : "")
                          }
                        >
                          <span
                            className={
                              "h-2.5 w-2.5 shrink-0 rounded-full " + LAYER_COLOR[layerName]
                            }
                          />
                          <span>
                            {layerName}
                            <span
                              title={say({
                                language,
                                fr: "dans la fermeture de l'adresse courante (③)",
                                en: "in the closure of the current address (③)",
                              })}
                              className="ml-1 text-[10px] text-slate-600"
                            >
                              {inClosure ? "•" : ""}
                            </span>
                          </span>
                        </button>
                        {editableLayerSet.has(layerName) && (
                          <button type="button"
                            onClick={() =>
                              setEditorLayer(editorLayer === layerName ? null : layerName)
                            }
                            title={say({
                              language,
                              fr:
                                "éditer la couche vivante — le staging la rejuge " +
                                "(0 verdict exigé), l'écriture est déclarée, " +
                                "l'atelier relit l'espace",
                              en:
                                "edit the living layer — staging rejudges it " +
                                "(0 verdict demanded), the write is declared, " +
                                "the workshop re-reads the space",
                            })}
                            aria-label={
                              say({ language, fr: "éditer la couche ", en: "edit the layer " }) +
                              layerName
                            }
                            className={
                              "shrink-0 rounded-md px-1.5 py-1 text-xs transition-colors " +
                              (editorLayer === layerName
                                ? "bg-sky-600 text-white"
                                : "text-slate-600 hover:bg-sky-50 hover:text-sky-600")
                            }
                          >
                            ✎
                          </button>
                        )}
                      </div>
                      {layerName === layer && (
                        <div className="ml-4 text-[10px] leading-4 text-slate-600">
                          {localized({
                            language,
                            text: LAYER_ROLE[layerName] ?? { en: layerName, fr: layerName },
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* ② the formalism — three tabs (language, raw,
              flattened); every line of the language is clickable */}
          <FormalismPanel
            kernel={KERNEL}
            layer={layer}
            language={language}
            addedLayerSources={addedLayerBlocks}
            sourceLineTargets={SOURCE_LINE_TARGETS}
            onPick={goto}
            onLine={openSourceLine}
          />
        </section>

        {/* ③ the flattened view */}
        <section className="space-y-3" role="region" aria-labelledby="panel-flat-heading">
          <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-3">
            <h2 id="panel-flat-heading" className="mb-2 text-sm font-bold text-slate-800 dark:text-slate-100">
              {say({ language, fr: "③ Les données aplaties", en: "③ The flattened data" })}
              <span className="ml-1 font-normal text-slate-600">
                {say({ language, fr: "lecture à une adresse", en: "reading at an address" })}
              </span>
            </h2>
            <div className="flex flex-wrap items-center gap-1 text-xs">
              <button type="button"
                onClick={goBack}
                disabled={!history.length}
                title={
                  history.length
                    ? say({
                        language,
                        fr: "retour à l'adresse précédente (" + history.length + " dans la pile)",
                        en: "back to the previous address (" + history.length + " in the stack)",
                      })
                    : say({
                        language,
                        fr: "rien à défaire — aucune adresse parcourue",
                        en: "nothing to undo — no address visited",
                      })
                }
                aria-label={say({ language, fr: "adresse précédente", en: "previous address" })}
                className={
                  "rounded px-1.5 py-0.5 font-bold " +
                  (history.length
                    ? "bg-slate-100 dark:bg-slate-800 text-slate-600 hover:bg-slate-200"
                    : "text-slate-500")
                }
              >
                ←
              </button>
              <LayerBadge layer={layer} />
              <span className="text-slate-600">::</span>
              <button type="button" className="text-slate-600 hover:text-slate-600" onClick={() => setPath([])} aria-label={say({ language, fr: "réinitialiser le chemin", en: "reset path" })}>
                ()
              </button>
              {path.map((segment, index) => (
                <span key={index} className="flex items-center gap-1">
                  <span className="text-slate-500">/</span>
                  <button type="button"
                    className="font-mono font-medium text-slate-700 dark:text-slate-200 hover:underline"
                    onClick={() => setPath(path.slice(0, index + 1))}
                  >
                    {segment}
                  </button>
                </span>
              ))}
              <button type="button"
                onClick={copyAddress}
                title={say({
                  language,
                  fr:
                    "copier l'adresse (couche :: chemin :: clé) — " +
                    "l'artefact partageable de l'atelier",
                  en:
                    "copy the address (layer :: path :: key) — " +
                    "the workshop's shareable artifact",
                })}
                aria-label={say({ language, fr: "copier l'adresse", en: "copy the address" })}
                className={
                  "ml-auto rounded px-1.5 py-0.5 text-[10px] " +
                  (copied
                    ? "bg-emerald-50 text-emerald-700"
                    : "bg-slate-100 dark:bg-slate-800 text-slate-600 hover:bg-slate-200")
                }
              >
                {copied
                  ? say({ language, fr: "adresse copiée ✓", en: "address copied ✓" })
                  : say({ language, fr: "copier ⧉", en: "copy ⧉" })}
              </button>
            </div>

            <div className="mt-3 divide-y divide-slate-100">
              {shownKeys.length === 0 && (
                <div className="py-2 text-xs text-slate-600">
                  {addressKeys.length === 0
                    ? say({
                        language,
                        fr: "Aucune clé visible à cette adresse (nœud de déclaration).",
                        en: "No visible key at this address (declaration node).",
                      })
                    : say({
                        language,
                        fr: "Aucune clé ne correspond à « " + search + " ».",
                        en: "No key matches « " + search + " ».",
                      })}
                </div>
              )}
              {shownKeys.map((info) => {
                const active = info.key === selectedKey;
                const isNode = info.value instanceof AddressView;
                return (
                  <div
                    key={info.key}
                    className={
                      "flex items-center gap-2 py-1.5 text-xs " +
                      (active ? "rounded-md bg-sky-50 px-1 ring-1 ring-sky-200" : "")
                    }
                  >
                    <button type="button"
                      className="min-w-24 text-left font-mono font-semibold text-slate-800 dark:text-slate-100 hover:underline"
                      onClick={() => {
                        setSelectedKey(active ? null : info.key);
                        if (!active) setShowClosureCalculation(true);
                      }}
                    >
                      {info.key}
                    </button>
                    {info.winner ? (
                      <LayerBadge layer={info.winner[0]} small />
                    ) : (
                      <span className="text-[10px] text-slate-600">
                        {say({ language, fr: "sans valeur", en: "no value" })}
                      </span>
                    )}
                    <span className="truncate">
                      <KernelValue value={info.value} language={language} />
                    </span>
                    {isNode && (
                      <button type="button"
                        className="ml-auto shrink-0 rounded border border-slate-300 dark:border-slate-600 px-1.5 py-0.5 text-[10px] text-slate-500 hover:border-slate-600 hover:text-slate-800 dark:text-slate-100"
                        onClick={() =>
                          goto((info.value as AddressView).layer, (info.value as AddressView).path)
                        }
                      >
                        {say({ language, fr: "→ y aller", en: "→ go there" })}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
            <p className="mt-2 text-[10px] leading-4 text-slate-600">
              {say({
                language,
                fr:
                  "Chaque ligne : la clé, la couche qui fournit la valeur " +
                  "(premier-gagné), la valeur. Un nœud se traverse (« → y aller ») ; " +
                  "une référence résolue se reconnaît à son adresse désignée.",
                en:
                  "Each line: the key, the layer providing the value " +
                  "(first-wins), the value. A node is traversed (« → go there »); " +
                  "a resolved reference is recognized by its designated address.",
              })}
            </p>
          </div>
        </section>

        {/* ③ the reading and its resolution —
            the mechanism comes before the cascade */}
        <section className="space-y-3" role="region" aria-labelledby="panel-mechanism-heading">
          <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-3">
            <h2 id="panel-mechanism-heading" className="mb-1 text-sm font-bold text-slate-800 dark:text-slate-100">
              {say({ language, fr: "③ Le mécanisme", en: "③ The mechanism" })}
              <span className="ml-1 font-normal text-slate-600">
                {say({
                  language,
                  fr:
                    "le dernier cran en détail — fermeture par adresse, sources dans " +
                    "l'ordre de lecture",
                  en:
                    "the last crank in detail — closure by address, sources in " + "reading order",
                })}
              </span>
            </h2>
            <p className="mb-2 text-[10px] leading-4 text-slate-600">
              {say({ language, fr: "Adresse courante :", en: "Current address:" })}{" "}
              <span className="font-mono font-semibold text-slate-600">
                {addressText(currentAddress)}
              </span>
              {selectedKey ? (
                <>
                  {say({ language, fr: " — clé lue : ", en: " — key read: " })}
                  <span className="font-mono font-semibold text-slate-600">{selectedKey}</span>
                </>
              ) : (
                say({
                  language,
                  fr: " — sélectionnez une clé à gauche pour voir le parcours de lecture",
                  en: " — select a key on the left to see the reading path",
                })
              )}
            </p>
            <div className="space-y-1">
              {closureData.closure.map((address, index) => {
                const status = selectedKey
                  ? statusBySource.get(addressText(address)) || "non atteint"
                  : null;
                return (
                  <div
                    key={index}
                    className={
                      "flex items-center gap-2 rounded-md px-1.5 py-1 text-[11px] " +
                      (index === winnerIndex ? "bg-emerald-50 ring-1 ring-emerald-300" : "")
                    }
                  >
                    <span className="w-5 shrink-0 text-right font-mono text-slate-600">
                      {index}
                    </span>
                    <LayerBadge layer={address[0]} small />
                    <span className="font-mono text-slate-700 dark:text-slate-200">
                      {address[1].length ? address[1].join("/") : "()"}
                    </span>
                    {status && (
                      <span className="ml-auto shrink-0">
                        <StatusPill status={status} language={language} />
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
            {selectedKey && (
              <div className="mt-2 flex flex-wrap items-center gap-2 rounded-md bg-slate-50 dark:bg-slate-900 px-2 py-1.5 text-[11px]">
                <span className="text-slate-500">
                  <span className="font-mono font-semibold text-slate-700 dark:text-slate-200">{selectedKey}</span> =
                </span>
                <KernelValue
                  value={selectedKeyDetail ? selectedKeyDetail.value : null}
                  language={language}
                />
                {selectedKeyDetail && selectedKeyDetail.value instanceof AddressView && (
                  <button type="button"
                    className="rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-600 hover:border-slate-600"
                    onClick={() =>
                      goto(
                        (selectedKeyDetail!.value as AddressView).layer,
                        (selectedKeyDetail!.value as AddressView).path,
                      )
                    }
                  >
                    {say({
                      language,
                      fr: "→ aller à l'adresse désignée",
                      en: "→ go to the designated address",
                    })}
                  </button>
                )}
              </div>
            )}
          </div>

          {selectedKeyDetail && selectedKeyDetail.referenceEvents.length > 0 && (
            <div className="rounded-lg border border-sky-200 bg-sky-50/50 p-3">
              <h3 className="mb-1 text-xs font-bold text-sky-800">
                {say({ language, fr: "Résolution de la référence", en: "Reference resolution" })}
              </h3>
              <div className="space-y-2">
                {selectedKeyDetail.referenceEvents.map((event, index) => (
                  <TraceEventRow key={index} event={event} language={language} />
                ))}
              </div>
            </div>
          )}

          {/* The cascade strip — click a line of the formalism
              (②), its step opens on the right; click inside the
              last step, it moves left and the new one opens on
              the right; the second-to-last/last pair is
              highlighted, the story scrolls, older steps fading */}
          <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-3">
            <h2 className="mb-2 text-sm font-bold text-slate-800 dark:text-slate-100">
              {say({ language, fr: "③ La cascade de résolution", en: "③ The resolution cascade" })}
              <span className="ml-1 font-normal text-slate-600">
                {cascade.length +
                  " " +
                  say({ language, fr: "cran", en: "crank" }) +
                  (cascade.length > 1 ? "s" : "") +
                  " — " +
                  say({
                    language,
                    fr: "l'histoire reste visible, le dernier parle",
                    en: "the story stays visible, the last one speaks",
                  })}
              </span>
            </h2>
            {cascade.length > 10 && (
              <p className="mb-1 text-[10px] leading-4 text-slate-600">
                {"… " +
                  say({ language, fr: "et ", en: "and " }) +
                  (cascade.length - 10) +
                  " " +
                  say({ language, fr: "cran", en: "crank" }) +
                  (cascade.length - 10 > 1 ? "s" : "") +
                  " " +
                  say({
                    language,
                    fr: "avant, dans la pile — le bouton retour de ③ les redéfait",
                    en: "before, in the stack — the ③ back button undoes them",
                  })}
              </p>
            )}
            <div className="flex gap-2 overflow-x-auto pb-1">
              {cascade.slice(-10).map((step, index) => (
                <CascadeCard
                  key={cascade.length - Math.min(cascade.length, 10) + index}
                  space={KERNEL.space}
                  target={step}
                  language={language}
                  isLast={index === Math.min(cascade.length, 10) - 1}
                  isSecondToLast={index === Math.min(cascade.length, 10) - 2}
                  onOpen={goto}
                />
              ))}
            </div>
          </div>

          {/* The calculation folds under the mechanism — opened
              automatically by the click on a key */}
          <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-3">
            <button type="button"
              className="flex w-full items-center justify-between gap-2 text-left text-xs font-bold text-slate-800 dark:text-slate-100"
              onClick={() => setShowClosureCalculation(!showClosureCalculation)}
              aria-expanded={showClosureCalculation}
            >
              <span>
                {say({
                  language,
                  fr: "Comment cette fermeture est calculée",
                  en: "How this closure is calculated",
                })}
              </span>
              <span className="text-slate-600">{showClosureCalculation ? "▾" : "▸"}</span>
            </button>
            {showClosureCalculation && (
              <div className="mt-2 space-y-1.5">
                {closureData.events.map((event, index) => (
                  <TraceEventRow key={index} event={event} language={language} />
                ))}
              </div>
            )}
          </div>
        </section>
      </main>

      <section className="mx-4 mt-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4" role="region" aria-labelledby="panel-viewpoint-heading">
        <h2 id="panel-viewpoint-heading" className="text-sm font-bold text-slate-800 dark:text-slate-100">
          {say({ language, fr: "④ Le point de vue", en: "④ The point of view" })}
          <span className="ml-1 font-normal text-slate-600">
            {say({
              language,
              fr: "l'arbre à gauche, le dessin à droite",
              en: "the tree on the left, the drawing on the right",
            })}
          </span>
        </h2>
        <p className="mb-3 mt-1 text-[11px] leading-4 text-slate-500">
          {say({
            language,
            fr:
              "Le regard se choisit dans l'arbre : les lentilles habillent les " +
              "types d'un schéma de gabarits display ; les points de vue " +
              "désignent un modèle et une lentille par champs LRef. Un point " +
              "de vue impose son modèle — une lentille seule s'applique au " +
              "modèle courant de ①. Les positions sont celles du cours quand " +
              "le point de vue les décide, sinon la disposition cercle ; et " +
              "l'inapplicabilité s'affiche honnêtement (la lentille " +
              "n'habille que ce qu'elle sait, le modèle reste entier). Parmi " +
              "les entrées qui habillent un nœud, la plus spécifique gagne — " +
              "mesuré par fermeture, pas par l'ordre de la chaîne. " +
              "Cliquez une forme ou un arc pour voir l'habillage.",
            en:
              "The look is chosen in the tree: lenses dress the types with a " +
              "display templates scheme; viewpoints designate a model and " +
              "a lens through LRef fields. A viewpoint imposes its model — " +
              "a lone lens applies to the current model of ①. The " +
              "positions are those of the course when the viewpoint " +
              "decides them, otherwise the circle layout; and the " +
              "inapplicability displays honestly (the lens dresses only " +
              "what it knows, the model stays whole). Among the entries " +
              "dressing a node, the most specific wins — measured by " +
              "closure, not by the order of the chain. Click a shape or " +
              "an arc to see the dressing.",
          })}
        </p>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          {/* The tree of looks: roots then descendants (refinements
              internal to the group), indentation by depth; a click
              changes the look and deselects the shape */}
          <div className="space-y-3">
            <div>
              <div className="mb-1 text-[11px] font-bold uppercase tracking-wide text-slate-500">
                {say({ language, fr: "Lentilles", en: "Lenses" })}
              </div>
              <div className="space-y-1">
                {groupTree({ space: KERNEL.space, members: LENS_LAYERS }).map(
                  ({ layer: viewLayer, depth }) => (
                    <div key={viewLayer} style={{ marginLeft: depth * 14 }}>
                      <button type="button"
                        className={
                          "flex w-full items-center gap-1.5 rounded px-1.5 py-1 text-left text-[11px] " +
                          (selectedView === viewLayer
                            ? "bg-slate-800 text-white"
                            : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 ring-1 ring-slate-200 hover:bg-slate-100 dark:bg-slate-800")
                        }
                        onClick={() => {
                          setSelectedView(viewLayer);
                          setSelectedGlyph(null);
                        }}
                      >
                        <LayerBadge layer={viewLayer} small />
                        <span className="truncate text-slate-600">
                          {say({
                            language,
                            fr: "lentille — modèle : le courant de ①",
                            en: "lens — model: the current one of ①",
                          })}
                        </span>
                      </button>
                    </div>
                  ),
                )}
              </div>
            </div>
            <div>
              <div className="mb-1 text-[11px] font-bold uppercase tracking-wide text-slate-500">
                {say({ language, fr: "Points de vue", en: "Viewpoints" })}
              </div>
              <div className="space-y-1">
                {groupTree({ space: KERNEL.space, members: VIEWPOINT_LAYERS }).map(
                  ({ layer: viewLayer, depth }) => (
                    <div key={viewLayer} style={{ marginLeft: depth * 14 }}>
                      <button type="button"
                        className={
                          "flex w-full items-center gap-1.5 rounded px-1.5 py-1 text-left text-[11px] " +
                          (selectedView === viewLayer
                            ? "bg-slate-800 text-white"
                            : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 ring-1 ring-slate-200 hover:bg-slate-100 dark:bg-slate-800")
                        }
                        onClick={() => {
                          setSelectedView(viewLayer);
                          setSelectedGlyph(null);
                        }}
                      >
                        <LayerBadge layer={viewLayer} small />
                        <span className="truncate text-slate-600">
                          {bindingOf({ space: KERNEL.space, view: viewLayer, key: "model" })
                            .value instanceof AddressView
                            ? say({ language, fr: "→ modèle désigné", en: "→ designated model" })
                            : say({
                                language,
                                fr: "→ modèle : le courant de ①",
                                en: "→ model: the current one of ①",
                              })}
                        </span>
                      </button>
                    </div>
                  ),
                )}
              </div>
            </div>
          </div>
          {/* The drawing: the model "seen through" the lens, the
              header says what is imposed, decided or fallback */}
          <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 p-2 md:col-span-2">
            <div className="mb-1 flex flex-wrap items-center gap-1.5 text-[11px]">
              <LayerBadge layer={look.model} small />
              <span className="text-slate-500">
                {say({ language, fr: "vu par", en: "seen through" })}
              </span>
              {look.lens !== null ? (
                <LayerBadge layer={look.lens} small />
              ) : (
                <span className="font-mono text-slate-600">
                  {say({ language, fr: "∅ sans lentille", en: "∅ without a lens" })}
                </span>
              )}
              <span className="text-slate-500">·</span>
              <span className="text-slate-500">
                {look.isLens
                  ? say({
                      language,
                      fr: "lentille seule — modèle courant de ①",
                      en: "lone lens — current model of ①",
                    })
                  : look.viewpointDecidesPositions
                    ? say({ language, fr: "positions du cours", en: "course positions" })
                    : look.modelCarriesPositions
                      ? say({
                          language,
                          fr: "positions du modèle — résolues (grille ou pôle, relatives comprises)",
                          en: "model positions — resolved (grid or pole, relative included)",
                        })
                      : say({
                          language,
                          fr: "positions : disposition cercle",
                          en: "positions: circle layout",
                        })}
              </span>
            </div>
            <svg viewBox={look.frame ?? "0 0 270 220"} className="w-full rounded bg-white dark:bg-slate-800">
              {look.lens !== null &&
                look.edges.map((edge) => {
                  const from =
                    edge.from !== null
                      ? (look.vertices.find((vertex) => vertex.name === edge.from)?.position ??
                        null)
                      : null;
                  const to =
                    edge.to !== null
                      ? (look.vertices.find((vertex) => vertex.name === edge.to)?.position ?? null)
                      : null;
                  if (!from || !to) return null;
                  return (
                    <EdgeGlyph
                      key={edge.name}
                      name={edge.name}
                      shape={edge.drawn ? edge.drawn.spec : null}
                      weight={edge.weight}
                      from={from}
                      to={to}
                      selected={
                        selectedGlyph !== null &&
                        selectedGlyph.kind === "edge" &&
                        selectedGlyph.name === edge.name
                      }
                      onPick={() =>
                        setSelectedGlyph(
                          selectedGlyph &&
                            selectedGlyph.kind === "edge" &&
                            selectedGlyph.name === edge.name
                            ? null
                            : { kind: "edge", name: edge.name },
                        )
                      }
                    />
                  );
                })}
              {look.lens !== null &&
                look.vertices.map((vertex) => {
                  if (!vertex.position) return null;
                  return (
                    <NodeGlyph
                      key={vertex.name}
                      name={vertex.name}
                      shape={vertex.drawn ? vertex.drawn.spec : null}
                      position={vertex.position}
                      selected={
                        selectedGlyph !== null &&
                        selectedGlyph.kind === "vertex" &&
                        selectedGlyph.name === vertex.name
                      }
                      onPick={() =>
                        setSelectedGlyph(
                          selectedGlyph &&
                            selectedGlyph.kind === "vertex" &&
                            selectedGlyph.name === vertex.name
                            ? null
                            : { kind: "vertex", name: vertex.name },
                        )
                      }
                    />
                  );
                })}
            </svg>
            {/* The bindings of the viewpoint: the layer that
                  provides each field, the resolved value — a look
                  stays a layer, its slots read like the others */}
            {!look.isLens && (
              <div className="mt-1.5 space-y-0.5 text-[10px] leading-4">
                {["model", "display", "zoom"].map((slotKey) => {
                  const binding = bindingOf({
                    space: KERNEL.space,
                    view: selectedView,
                    key: slotKey,
                  });
                  return (
                    <div key={slotKey} className="flex items-center gap-1">
                      <span className="w-11 shrink-0 font-mono text-slate-600">{slotKey}</span>
                      {binding.winner ? (
                        <LayerBadge layer={binding.winner[0]} small />
                      ) : (
                        <span className="text-slate-600">∅</span>
                      )}
                      <span className="truncate text-slate-500">
                        {binding.value instanceof AddressView
                          ? "→ " + binding.value.layer
                          : binding.value === null
                            ? say({ language, fr: "∅ non défini", en: "∅ undefined" })
                            : String(binding.value)}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
            {/* Honest applicability: nothing hidden — no lens, no
                  graph, blind or partial lens, every case speaks */}
            <div className="mt-1 text-[10px] text-slate-500">
              {look.lens === null
                ? say({
                    language,
                    fr: "point de vue sans lentille — aucun dessin",
                    en: "viewpoint without a lens — no drawing",
                  })
                : look.applicability.total === -1
                  ? say({
                      language,
                      fr: "le modèle n'est pas un graphe — aucune entrée vertices",
                      en: "the model is not a graph — no vertices entry",
                    })
                  : say({ language, fr: "applicabilité : ", en: "applicability: " }) +
                    look.applicability.dressed +
                    "/" +
                    look.applicability.total +
                    say({
                      language,
                      fr: " sommets habillés",
                      en: " vertices dressed",
                    }) +
                    (look.applicability.dressed === look.applicability.total
                      ? say({ language, fr: " — lentille applicable", en: " — applicable lens" })
                      : "") +
                    (look.applicability.dressed === 0
                      ? say({
                          language,
                          fr: " — lentille aveugle : erreur de domaine (check_view_lens)",
                          en: " — blind lens: domain error (check_view_lens)",
                        })
                      : "") +
                    (look.applicability.dressed > 0 &&
                    look.applicability.dressed < look.applicability.total
                      ? say({
                          language,
                          fr: " — partiel : erreur de domaine",
                          en: " — partial: domain error",
                        })
                      : "")}
            </div>
            <p className="mt-1 text-[10px] leading-4 text-slate-600">
              {localized({ language, text: VIEW_NOTES[selectedView] ?? { en: "", fr: "" } })}
            </p>
          </div>
        </div>

        {selectedGlyph &&
          look.lens !== null &&
          (() => {
            const glyphPath =
              selectedGlyph.kind === "vertex"
                ? ["vertices", selectedGlyph.name]
                : ["edges", selectedGlyph.name];
            const matches = dressingEntries({
              space: KERNEL.space,
              lens: asLayerName(look.lens),
              layer: asLayerName(look.model),
              path: asLayerPath(glyphPath),
            });
            let best: {
              path: string[];
              spec: Glyph[];
              hit: ReturnType<typeof dressingEntries>[number]["hit"];
            } | null = null;
            for (const match of matches) {
              if (
                best === null ||
                coversAddresses({ space: KERNEL.space, covering: match.hit, covered: best.hit })
              )
                best = match;
            }
            return (
              <div className="mt-3 rounded-lg border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 p-3">
                <div className="mb-1 flex items-center gap-2">
                  <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[11px] font-bold text-white">
                    {selectedGlyph.name}
                  </span>
                  <span className="text-xs text-slate-500">
                    {look.model} :: {glyphPath.join("/")} —{" "}
                    {say({ language, fr: "habillage par", en: "dressing by" })}{" "}
                    <span className="font-medium">{look.lens}</span>
                  </span>
                  <button type="button"
                    className="ml-auto rounded px-2 text-slate-600 hover:bg-slate-100 dark:bg-slate-800 hover:text-slate-700 dark:text-slate-200"
                    onClick={() => setSelectedGlyph(null)}
                  >
                    ×
                  </button>
                </div>
                {matches.length === 0 && (
                  <p className="text-xs text-slate-500">
                    {say({
                      language,
                      fr:
                        "Aucune entrée de la lentille n'habille ce nœud — il se " +
                        "dessinerait « nu » (pointillé).",
                      en:
                        "No entry of the lens dresses this node — it would be " +
                        "drawn « naked » (dotted).",
                    })}
                  </p>
                )}
                <div className="space-y-1">
                  {matches.map((match, index) => {
                    const isBest = match === best;
                    return (
                      <div
                        key={index}
                        className={
                          "flex flex-wrap items-center gap-1.5 rounded-md px-2 py-1 text-[11px] " +
                          (isBest ? "bg-emerald-50 ring-1 ring-emerald-300" : "bg-white dark:bg-slate-800")
                        }
                      >
                        <span className="font-semibold text-slate-800 dark:text-slate-100">
                          {shapeLabel({ shape: match.spec, language })}
                        </span>
                        <span className="text-slate-600">
                          {say({ language, fr: "← entrée", en: "← entry" })}
                        </span>
                        <span className="font-mono text-slate-600">{match.path.join("/")}</span>
                        <span className="text-slate-600">
                          {say({ language, fr: "habille", en: "dresses" })}
                        </span>
                        {match.hit.map((hitAddress, hitIndex) => (
                          <span key={hitIndex} className="inline-flex items-center gap-0.5">
                            {hitIndex > 0 && <span className="text-slate-600">,</span>}
                            <LayerBadge layer={hitAddress[0]} small />
                            <span className="font-mono text-slate-500">
                              {hitAddress[1].length ? hitAddress[1].join("/") : "()"}
                            </span>
                          </span>
                        ))}
                        {isBest && (
                          <span className="ml-auto rounded bg-emerald-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
                            {say({
                              language,
                              fr: "gagnante — la plus spécifique",
                              en: "winner — the most specific",
                            })}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
                {matches.length > 1 && (
                  <p className="mt-1.5 text-[11px] leading-4 text-slate-500">
                    {language === "fr" ? (
                      <>
                        Deux entrées habillent ce nœud : celle de la famille et le cercle générique.
                        L'entrée la plus spécifique gagne — son type{" "}
                        <span className="font-mono">raffine</span> celui de l'autre, mesuré par
                        fermeture : ce verdict ne dépend pas de l'ordre de la chaîne du nœud (think1
                        porte son type le plus spécifique en fin de chaîne, producer en début).
                      </>
                    ) : (
                      <>
                        Two entries dress this node: the family one and the generic circle. The most
                        specific entry wins — its type <span className="font-mono">refines</span>{" "}
                        the other's, measured by closure: this verdict does not depend on the order
                        of the node's chain (think1 carries its most specific type at the end of the
                        chain, producer at the start).
                      </>
                    )}
                  </p>
                )}
                {matches.length === 1 && (
                  <p className="mt-1.5 text-[11px] text-slate-500">
                    {say({
                      language,
                      fr: "Une seule entrée habille ce nœud : aucun choix à faire.",
                      en: "A single entry dresses this node: no choice to make.",
                    })}
                  </p>
                )}
              </div>
            );
          })()}
      </section>

      {/* The panels are counted on one hand — ① the layers, ② the
          formalism, ③ the reading and its resolution, ④ the point
          of view; the ＋ button of ① covers the flow, from the
          request to the validation */}

      {/* The diagnostics and the validation live in the
          "Diagnostics & validation" fold of the formalism (②), the
          flattened view and the language in its tabs; no
          standalone panel at the end of the page */}

      <footer className="px-5 pb-6 text-[10px] leading-4 text-slate-600">
        {say({
          language,
          fr:
            "Atelier mesuré : non-régression du noyau au bit près — " +
            "chaque lecture observable comparée, octet par octet, à la " +
            "ligne de base gelée — harnais autonome, aucun appel " +
            "externe ; premier rendu une passe pure, sans effet de " +
            "bord. Les chiffres cités dans l'atelier sont mesurés par " +
            "ce même harnais.",
          en:
            "Measured workshop: bit-exact kernel non-regression — " +
            "every observable read compared, byte by byte, to the " +
            "frozen baseline — self-contained harness, no external " +
            "call; first render a pure pass, without side effect. " +
            "The figures quoted in the workshop are measured by " +
            "that same harness.",
        })}
      </footer>
    </div>
  );
}

