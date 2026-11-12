// The formalism page — understand ONE layer of the workshop. The
// DSL of the formalism as it is written (its .ld source), the DSL
// of the complete flattened formalism (the closure resolved in
// place, first-wins, each indented part foldable) — and the
// lenses: which display layer dresses the formalism, what it
// draws, what it degrades honestly. The layer travels in the hash
// (#formalism/wb1): the address is the artifact, the URL is the
// state.

import React, { useMemo, useState } from "react";
import { useRouter } from "../components/Router";
import { assembleLayeredDataKernel } from "../application/corpus.ts";
import { extractLayerBlock } from "../application/staging.ts";
import {
  countFlattenedSectionLines,
  writeFlattenedLayerSections,
  type FlattenedLayerText,
  type FlattenedSection,
} from "../application/flattenSource.ts";
import { materializeSessionAdditions } from "../application/session.ts";
import { loadKernelLayerSources } from "../infrastructure/corpusLoader.ts";
import { asLayerName } from "../domain/identifiers.ts";
import { highlightSourceLine, SPAN_CLASSES } from "../presentation/layerSourceView.tsx";
import { buildWorkshopLook, type WorkshopLook } from "../presentation/lensDrawing.ts";
import { LAYER_COLOR, LAYER_ROLE, RefinementDag } from "../presentation/workshopInventory.ts";
import { LENS_LAYERS, VIEW_NOTES } from "../presentation/viewTree.ts";
import { NodeGlyph, EdgeGlyph } from "../presentation/glyphs.tsx";
import { localized, say } from "../presentation/i18n.ts";
import type { BilingualText } from "../presentation/i18n.ts";
import type { Language } from "../domain/messages.ts";

interface FormalismPageProps {
  layer: string;
  language: Language;
  onChooseLanguage: (lang: Language) => void;
}

// The kernel of the page: assembled once from the corpus files —
// the single source, never an embedded copy. The session
// additions materialize into it at each mount, idempotently.
const KERNEL = assembleLayeredDataKernel({ layerSources: loadKernelLayerSources() });
const DEFAULT_FORMALISM_LAYER = "multihypergraph";

/** One DSL text, rendered with the workshop's own highlighter —
 * same colors as the language tab of the workshop: violet for the
 * acts, green for the @paths, amber for the strings. */
function SourceText({ source, maxHeightClass }: { source: string; maxHeightClass: string }) {
  return (
    <div
      className={
        "overflow-auto rounded-md border border-slate-100 bg-slate-50 dark:bg-slate-900/50 p-2 font-mono text-[11px] leading-4 " +
        maxHeightClass
      }
    >
      {source.split("\n").map((line, index) => (
        <div key={index} className="flex">
          <span className="mr-3 w-8 shrink-0 select-none text-right text-slate-500">
            {index + 1}
          </span>
          <span className="whitespace-pre">
            {highlightSourceLine(line).map((span, spanIndex) => (
              <span key={spanIndex} className={SPAN_CLASSES[span.kind]}>
                {span.text}
              </span>
            ))}
          </span>
        </div>
      ))}
    </div>
  );
}

/** One key of a section in the fold state: the path of indices from
 * the root — the fold is a set of keys, never an index in a flat
 * list (a sibling never renames its brothers). */
function collectSectionKeys({
  sections,
  prefix,
}: {
  sections: FlattenedSection[];
  prefix: string;
}): string[] {
  const keys: string[] = [];
  sections.forEach((section, index) => {
    const key = prefix + index;
    if (section.sections.length > 0) {
      keys.push(key);
      keys.push(...collectSectionKeys({ sections: section.sections, prefix: key + "." }));
    }
  });
  return keys;
}

/** The flattened formalism, foldable: each structural child is a
 * section one opens or closes — the whole closure stays one click
 * away, the artifact never floods the page and is never truncated
 * either. The line numbers are those of the complete text: what
 * folds hides lines, it never renumbers them. */
function FlattenedText({ text, language }: { text: FlattenedLayerText; language: Language }) {
  const [folded, setFolded] = useState<Set<string>>(
    () => new Set(collectSectionKeys({ sections: text.sections, prefix: "" })),
  );
  const lineNumbers = useMemo(() => {
    const numbers = new Map<string, number>();
    let next = text.headerLines.length;
    const walk = (sections: FlattenedSection[], prefix: string) => {
      sections.forEach((section, index) => {
        const key = prefix + index;
        next += 1;
        numbers.set(key, next);
        next += section.line.split("\n").length - 1;
        walk(section.sections, key + ".");
      });
    };
    walk(text.sections, "");
    return numbers;
  }, [text]);
  const lineOf = ({ line }: { line: string }): React.ReactNode => (
    <span className="whitespace-pre">
      {line.split("\n").map((physical, physicalIndex) => (
        <React.Fragment key={physicalIndex}>
          {physicalIndex > 0 ? "\n" : null}
          {highlightSourceLine(physical).map((span, spanIndex) => (
            <span key={spanIndex} className={SPAN_CLASSES[span.kind]}>
              {span.text}
            </span>
          ))}
        </React.Fragment>
      ))}
    </span>
  );
  const renderSection = ({
    section,
    key,
    depth,
  }: {
    section: FlattenedSection;
    key: string;
    depth: number;
  }): React.ReactNode => {
    const hasSections = section.sections.length > 0;
    const isFolded = folded.has(key);
    const nodes: React.ReactNode[] = [
      <div key={key} className="flex">
        <span className="mr-3 w-8 shrink-0 select-none text-right text-slate-500">
          {lineNumbers.get(key)}
        </span>
        {hasSections ? (
          <button type="button"
            onClick={() => {
              setFolded((previous) => {
                const next = new Set(previous);
                if (next.has(key)) next.delete(key);
                else next.add(key);
                return next;
              });
            }}
            aria-label={say({ language, en: "fold / unfold"})}
            className="mr-1 w-4 shrink-0 text-left font-bold text-slate-600 hover:text-slate-700 dark:text-slate-200"
          >
            {isFolded ? "▸" : "▾"}
          </button>
        ) : (
          <span className="mr-1 w-4 shrink-0" />
        )}
        <span className="flex-1" style={{ paddingLeft: (depth - 1) * 12 }}>
          <span className={hasSections ? "font-semibold" : undefined}>
            {lineOf({ line: section.line })}
          </span>
          {isFolded && (
            <span className="ml-2 font-sans text-[10px] text-slate-600">
              {"+ " +
                (countFlattenedSectionLines({ section }) - section.line.split("\n").length) +
                " " +
                say({ language, en: "lines"})}
            </span>
          )}
        </span>
      </div>,
    ];
    if (hasSections && !isFolded) {
      section.sections.forEach((child, index) => {
        nodes.push(renderSection({ section: child, key: key + "." + index, depth: depth + 1 }));
      });
    }
    return nodes;
  };
  return (
    <div className="overflow-auto rounded-md border border-slate-100 bg-slate-50 dark:bg-slate-900/50 p-2 font-mono text-[11px] leading-4 max-h-[32rem]">
      <div className="mb-1 flex flex-wrap gap-2">
        <button type="button"
          onClick={() => setFolded(new Set())}
          className="rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-1.5 py-0.5 font-sans text-[10px] text-slate-500 hover:border-slate-500"
        >
          {say({ language, en: "unfold all"})}
        </button>
        <button type="button"
          onClick={() =>
            setFolded(new Set(collectSectionKeys({ sections: text.sections, prefix: "" })))
          }
          className="rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-1.5 py-0.5 font-sans text-[10px] text-slate-500 hover:border-slate-500"
        >
          {say({ language, en: "fold all"})}
        </button>
      </div>
      {text.headerLines.map((line, index) => (
        <div key={"head" + index} className="flex">
          <span className="mr-3 w-8 shrink-0 select-none text-right text-slate-500">
            {index + 1}
          </span>
          <span className="whitespace-pre text-slate-600">{line}</span>
        </div>
      ))}
      {text.sections.map((section, index) =>
        renderSection({ section, key: String(index), depth: 1 }),
      )}
    </div>
  );
}

/** The drawing of the formalism seen through one lens — the same
 * discipline as panel ④ of the workshop: the glyphs, the frame the
 * resolved positions demand, the circle layout otherwise. */
function LensDrawing({ look, language }: { look: WorkshopLook; language: Language }) {
  const [selectedGlyph, setSelectedGlyph] = useState<string | null>(null);
  return (
    <svg viewBox={look.frame ?? "0 0 270 220"} className="w-full rounded bg-white dark:bg-slate-800">
      {look.edges.map((edge) => {
        const from =
          edge.from !== null
            ? (look.vertices.find((vertex) => vertex.name === edge.from)?.position ?? null)
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
            selected={selectedGlyph === edge.name}
            onPick={() => setSelectedGlyph(selectedGlyph === edge.name ? null : edge.name)}
          />
        );
      })}
      {look.vertices.map((vertex) => {
        if (!vertex.position) return null;
        return (
          <NodeGlyph
            key={vertex.name}
            name={vertex.name}
            shape={vertex.drawn ? vertex.drawn.spec : null}
            position={vertex.position}
            selected={selectedGlyph === vertex.name}
            onPick={() => setSelectedGlyph(selectedGlyph === vertex.name ? null : vertex.name)}
          />
        );
      })}
      {selectedGlyph === null && look.vertices.length === 0 && (
        <text x={135} y={110} textAnchor="middle" fontSize={9} fill="#94a3b8">
          {say({ language, en: "nothing to draw"})}
        </text>
      )}
    </svg>
  );
}

export function FormalismPage({ layer, language, onChooseLanguage }: FormalismPageProps) {
  const { navigate } = useRouter();
  const session = useMemo(() => materializeSessionAdditions({ kernel: KERNEL }), []);
  const livingLayerNames = session.layerNames;
  const [search, setSearch] = useState("");
  const [lensChoice, setLensChoice] = useState<string | null>(null);
  const dag = useMemo(
    () => new RefinementDag({ space: KERNEL.space, layerNames: livingLayerNames }),
    [livingLayerNames],
  );
  const selectedLayer = livingLayerNames.includes(asLayerName(layer))
    ? layer
    : DEFAULT_FORMALISM_LAYER;
  const inCorpus = KERNEL.layerNames.includes(asLayerName(selectedLayer));
  const needle = search.trim().toLowerCase();
  const matchedLayerNames = livingLayerNames.filter(
    (layerName) => !needle || layerName.toLowerCase().includes(needle),
  );

  // The two DSL readings: the source as written, the closure
  // flattened in place.
  const sourceBlock =
    session.blocks[selectedLayer] ??
    extractLayerBlock({ name: selectedLayer, source: KERNEL.languageSource });
  const flattenedText = useMemo(
    () => writeFlattenedLayerSections({ space: KERNEL.space, layer: asLayerName(selectedLayer) }),
    [selectedLayer],
  );

  // The identity of the layer: its role sentence, its parents, its
  // closure towards the bases.
  const role = LAYER_ROLE[selectedLayer] ?? { en: selectedLayer};
  const parentNames = dag.targetsOf(selectedLayer);
  const closureNames = [...dag.ancestorsOf(selectedLayer)].filter(
    (layerName) => layerName !== selectedLayer,
  );

  // The lenses over the formalism: the look of each corpus lens,
  // its applicability; the chosen lens, or the first that dresses
  // something.
  const looks = useMemo(
    () =>
      LENS_LAYERS.map((lens) => ({
        lens,
        look: buildWorkshopLook({
          space: KERNEL.space,
          selectedView: lens,
          currentLayer: selectedLayer,
        }),
      })),
    [selectedLayer],
  );
  const selectedLookEntry =
    looks.find((entry) => entry.lens === lensChoice) ??
    looks.find((entry) => entry.look.applicability.dressed > 0) ??
    looks[0] ??
    null;

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-800 text-slate-900">
      <header className="border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-5 py-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h1 className="text-lg font-bold">
            {say({
              language,
              en: "The formalism — understand one layer",
            })}
          </h1>
          <span className="flex shrink-0 items-center gap-1 text-xs">
            <span className="mr-1 text-slate-600">
              {say({ language, en: "language: "})}
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
        <div className="mt-2 flex flex-wrap gap-2 text-xs">
          <button type="button"
            onClick={() => navigate("landing")}
            className="rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1 text-slate-600 hover:border-slate-600"
          >
            {say({ language, en: "← home"})}
          </button>
          <button type="button"
            onClick={() => navigate("hierarchy")}
            className="rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1 text-slate-600 hover:border-slate-600"
          >
            {say({ language, en: "the hierarchy →"})}
          </button>
          <button type="button"
            onClick={() => navigate("creation")}
            className="rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1 text-slate-600 hover:border-slate-600"
          >
            {say({ language, en: "create a formalism →"})}
          </button>
          <button type="button"
            onClick={() => navigate("workshop")}
            className="rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1 text-slate-600 hover:border-slate-600"
          >
            {say({ language, en: "the workshop →"})}
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl p-4 sm:p-6">
        {/* The choice of the layer: the search fades, the click
            navigates — the hash carries the address. */}
        <section className="mb-4 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-3">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100">
              {say({ language, en: "One layer"})}
            </h2>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={say({ language, en: "search a layer…"})}
              className="min-w-40 flex-1 rounded border border-slate-200 dark:border-slate-700 px-2 py-1 text-xs"
            />
            <span className="text-[10px] text-slate-600">
              {livingLayerNames.length + " "}
              {say({
                language,
                en: livingLayerNames.length > 1 ? "living layers" : "living layer",
              })}
            </span>
          </div>
          <div className="flex max-h-24 flex-wrap gap-1.5 overflow-y-auto">
            {matchedLayerNames.map((layerName) => (
              <button type="button"
                key={layerName}
                onClick={() => navigate("formalism", layerName)}
                className={
                  "flex items-center gap-1.5 rounded-full border px-2 py-0.5 font-mono text-[10px] transition-colors " +
                  (layerName === selectedLayer
                    ? "border-slate-900 bg-slate-50 dark:bg-slate-900 ring-1 ring-slate-900"
                    : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-slate-500")
                }
              >
                <span
                  className={
                    "h-2 w-2 shrink-0 rounded-full " + (LAYER_COLOR[layerName] ?? "bg-slate-300")
                  }
                />
                {layerName}
              </button>
            ))}
          </div>
        </section>

        {/* The identity: role, parents, closure. */}
        <section className="mb-4 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-3">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="text-lg font-bold font-mono">{selectedLayer}</span>
            {!inCorpus && (
              <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700">
                {say({ language, en: "created in this session"})}
              </span>
            )}
          </div>
          <p className="mt-1 text-xs leading-5 text-slate-600">
            {localized({ language, text: role })}
          </p>
          <div className="mt-2 space-y-1 text-[11px]">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="font-semibold text-slate-500">
                {say({ language, en: "refines:"})}
              </span>
              {parentNames.length === 0 ? (
                <span className="font-mono text-slate-600">∅</span>
              ) : (
                parentNames.map((parentName) => (
                  <button type="button"
                    key={parentName}
                    onClick={() => navigate("formalism", parentName)}
                    className="underline decoration-slate-300 hover:text-slate-900"
                  >
                    <span
                      className={
                        "mr-1 inline-block h-2 w-2 rounded-full " +
                        (LAYER_COLOR[parentName] ?? "bg-slate-300")
                      }
                    />
                    {parentName}
                  </button>
                ))
              )}
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="font-semibold text-slate-500">
                {say({
                  language,
                  en: "closure (" + closureNames.length + "):",
                })}
              </span>
              {closureNames.map((closureName) => (
                <button type="button"
                  key={closureName}
                  onClick={() => navigate("formalism", closureName)}
                  className="underline decoration-slate-300 hover:text-slate-900"
                >
                  <span
                    className={
                      "mr-1 inline-block h-2 w-2 rounded-full " +
                      (LAYER_COLOR[closureName] ?? "bg-slate-300")
                    }
                  />
                  {closureName}
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* The two DSL readings, side by side on wide screens. */}
        <section className="mb-4 grid gap-4 md:grid-cols-2">
          <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-3">
            <h2 className="mb-1 text-sm font-bold text-slate-800 dark:text-slate-100">
              {say({
                language,
                en: "① The DSL of the formalism — as written",
              })}
            </h2>
            <p className="mb-2 text-[10px] leading-4 text-slate-600">
              {say({
                language,
                en: "The .ld source of the layer: the acts that write it, its declared refinements, its blocks. What shines in violet is an act, in green an @path, in amber a string.",
              })}
            </p>
            {sourceBlock === null ? (
              <p className="text-xs text-slate-600">
                {say({
                  language,
                  en: "layer unknown to the geologist",
                })}
              </p>
            ) : (
              <SourceText source={sourceBlock} maxHeightClass="max-h-[32rem]" />
            )}
          </div>
          <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-3">
            <h2 className="mb-1 text-sm font-bold text-slate-800 dark:text-slate-100">
              {say({
                language,
                en: "② The DSL of the complete flattened formalism",
              })}
            </h2>
            <p className="mb-2 text-[10px] leading-4 text-slate-600">
              {say({
                language,
                en: "The whole closure, resolved in place — first-wins decides: every key carries its effective value and, as a comment, the layer that provides it (or declares the slot nobody provides — abstract). refines is absent: the hierarchy is what the flattening removes. Each indented part folds: one click hides it, one click opens it.",
              })}
            </p>
            <FlattenedText text={flattenedText} language={language} />
          </div>
        </section>

        {/* The lenses: which display layer dresses the formalism,
            what it draws, what it degrades honestly. */}
        <section className="mb-4 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-3">
          <h2 className="mb-1 text-sm font-bold text-slate-800 dark:text-slate-100">
            {say({ language, en: "③ The lenses"})}
          </h2>
          <p className="mb-2 text-[10px] leading-4 text-slate-600">
            {say({
              language,
              en: "A lens is a display layer that refines the formalism and draws everything descending from it — it displays only what it knows, the unknown types fall back to the generic circle, without an error. Choose a lens: the drawing shows the formalism seen through it.",
            })}
          </p>
          <div className="mb-2 flex flex-wrap gap-1.5">
            {looks.map(({ lens, look }) => (
              <button type="button"
                key={lens}
                onClick={() => setLensChoice(lens)}
                className={
                  "rounded-full border px-2 py-0.5 font-mono text-[10px] transition-colors " +
                  (selectedLookEntry !== null && selectedLookEntry.lens === lens
                    ? "border-slate-900 bg-slate-50 dark:bg-slate-900 ring-1 ring-slate-900"
                    : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-slate-500")
                }
              >
                <span
                  className={
                    "mr-1 inline-block h-2 w-2 rounded-full " +
                    (LAYER_COLOR[lens] ?? "bg-slate-300")
                  }
                />
                {lens}
                {" — "}
                {look.applicability.total === -1
                  ? say({ language, en: "no vertices"})
                  : look.applicability.dressed + "/" + look.applicability.total}
              </button>
            ))}
          </div>
          {selectedLookEntry !== null && (
            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-md border border-slate-100 bg-slate-50 dark:bg-slate-900 p-2">
                <LensDrawing look={selectedLookEntry.look} language={language} />
              </div>
              <div className="space-y-2 text-[11px] leading-4">
                <p className="text-slate-600">
                  {localized({
                    language,
                    text:
                      VIEW_NOTES[selectedLookEntry.lens] ??
                      ({ en: selectedLookEntry.lens} as BilingualText),
                  })}
                </p>
                <p className="text-slate-500">
                  {selectedLookEntry.look.applicability.total === -1
                    ? say({
                        language,
                        en: "This layer carries no vertices collection — the lens has nothing to dress here, the reading stays honest.",
                      })
                    : selectedLookEntry.look.applicability.dressed === 0
                      ? say({
                          language,
                          en: "The lens knows none of the types of this layer: everything falls back to the dashed generic circle — a legal degradation, not an error.",
                        })
                      : say({
                          language,
                          en:
                            "The lens dresses " +
                            selectedLookEntry.look.applicability.dressed +
                            " of the " +
                            selectedLookEntry.look.applicability.total +
                            " vertices; the undressed ones fall back to the generic circle.",
                        })}
                </p>
              </div>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
