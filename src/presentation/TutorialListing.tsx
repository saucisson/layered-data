// The tutorial's interactive listing: the complete flattened
// formalism of one layer of the tutorial corpus, resolved in place
// by first-winner — one line per key, one indented block per
// structural child, every line carrying its parentage (the badge
// of the layer that provides, or declares, the key). Clicking a
// line opens the workshop's own cascade card: a value line shows
// the winning address of its read (the core sample), a structural
// line shows the chain of refined types. The blocks fold like the
// formalism page's flattened view; the note special key stays out —
// the file's prose belongs to the file, the listing shows the
// formalism.

import React, { useMemo, useState } from "react";
import type { LayerName } from "../domain/identifiers.ts";
import type { Space } from "../domain/space.ts";
import type { Language } from "../domain/messages.ts";
import { countListingLines, listingVisibleLines } from "./tutorialMarkdown.ts";
import {
  writeFlattenedLayerSections,
  type FlattenedSection,
  type FlattenedTarget,
} from "../application/flattenSource.ts";
import { CascadeCard } from "./cascadeMap.tsx";
import { LayerBadge } from "./layerBadge.tsx";
import { highlightSourceLine, SPAN_CLASSES, type SourceLineTarget } from "./layerSourceView.tsx";
import { say } from "./i18n.ts";

/** The honest size of a listing the page leaves open: above it, the
 * listing opens folded (the whole closure stays one click away, it
 * never floods the page and is never truncated either). Measured on
 * the tutorial corpus: the small metamodels stay under it, the two
 * models of the dinner cross it. */
const OPEN_LISTING_LINES = 250;

/** The fold key of every section that has children, in walk order —
 * the fold is a set of keys, never an index in a flat list. */
function collectFoldKeys({
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
      keys.push(...collectFoldKeys({ sections: section.sections, prefix: key + "." }));
    }
  });
  return keys;
}

/** One listing block: the foldable flattened view, its lines
 * clickable, the cascade strip below. */
export function TutorialListing({
  space,
  layer,
  language,
}: {
  space: Space;
  layer: LayerName;
  language: Language;
}) {
  const text = useMemo(() => writeFlattenedLayerSections({ space, layer }), [space, layer]);
  const visible = useMemo(() => listingVisibleLines({ sections: text.sections }), [text]);
  const [folded, setFolded] = useState<Set<string>>(() =>
    visible > OPEN_LISTING_LINES
      ? new Set(collectFoldKeys({ sections: text.sections, prefix: "" }))
      : new Set(),
  );
  const [cascade, setCascade] = useState<SourceLineTarget[]>([]);

  const openTarget = (target: FlattenedTarget) => {
    setCascade([{ layer: target.layer, path: [...target.path], key: target.key }]);
  };

  const renderLine = (source: string): React.ReactNode => (
    <span className="whitespace-pre-wrap">
      {highlightSourceLine(source).map((span, spanIndex) => (
        <span key={spanIndex} className={SPAN_CLASSES[span.kind]}>
          {span.text}
        </span>
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
  }): React.ReactNode[] => {
    // the file's prose stays in the file — the listing shows the
    // formalism, the note special key is the .ld comment, not a
    // part of the layered datum being taught
    if (section.key === "note") return [];
    const hasSections = section.sections.length > 0;
    const isFolded = folded.has(key);
    const display =
      section.value === null ? "abstract " + section.key : section.key + " = " + section.value;
    const hidden = hasSections && isFolded ? countListingLines({ sections: [section] }) - 1 : 0;
    const nodes: React.ReactNode[] = [
      <div key={key} className="flex items-start gap-1" style={{ paddingLeft: depth * 12 }}>
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
            aria-label={say({ language, en: "fold / unfold", fr: "replier / déplier" })}
            className="w-4 shrink-0 text-left font-bold text-slate-600 hover:text-slate-700 dark:text-slate-200"
          >
            {isFolded ? "▸" : "▾"}
          </button>
        ) : (
          <span className="w-4 shrink-0" />
        )}
        <button type="button"
          onClick={() => openTarget(section.target)}
          title={say({
            language,
            en: "read this line's parentage — the cascade opens below",
            fr: "lire la parenté de cette ligne — la cascade s'ouvre en dessous",
          })}
          className="shrink-0 rounded text-left hover:ring-1 hover:ring-slate-500"
        >
          {renderLine(display)}
        </button>
        <button type="button"
          onClick={() => openTarget(section.target)}
          title={say({
            language,
            en: "the layer that provides this value (or declares the slot)",
            fr: "la couche qui fournit cette valeur (ou déclare le slot)",
          })}
          className="shrink-0"
        >
          {section.winner !== null && <LayerBadge layer={section.winner} small />}
        </button>
        {hidden > 0 && (
          <span className="font-sans text-[10px] text-slate-600">
            {"+ " + hidden + " " + say({ language, en: "lines", fr: "lignes" })}
          </span>
        )}
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
    <div className="overflow-hidden rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-1.5">
        <span className="font-mono text-xs font-semibold text-slate-700 dark:text-slate-200">
          {"layer " + layer + "-flat"}
        </span>
        <span className="flex items-center gap-2">
          <button type="button"
            onClick={() => setFolded(new Set())}
            className="rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-1.5 py-0.5 font-sans text-[10px] text-slate-500 hover:border-slate-500"
          >
            {say({ language, en: "unfold all", fr: "tout déplier" })}
          </button>
          <button type="button"
            onClick={() =>
              setFolded(new Set(collectFoldKeys({ sections: text.sections, prefix: "" })))
            }
            className="rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-1.5 py-0.5 font-sans text-[10px] text-slate-500 hover:border-slate-500"
          >
            {say({ language, en: "fold all", fr: "tout replier" })}
          </button>
        </span>
      </div>
      <div className="max-h-[32rem] overflow-auto px-3 py-2 font-mono text-[11px] leading-5">
        <p className="mb-1 text-slate-600">{text.headerLines[1]}</p>
        {text.sections.map((section, index) =>
          renderSection({ section, key: String(index), depth: 0 }),
        )}
      </div>
      {cascade.length > 0 && (
        <div className="border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 p-2">
          <div className="mb-1 flex items-center justify-between gap-2">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-600">
              {say({
                language,
                en: "the line's parentage — click again to walk further",
                fr: "la parenté de la ligne — cliquez encore pour marcher plus loin",
              })}
            </p>
            <button type="button"
              onClick={() => setCascade([])}
              className="rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-1.5 py-0.5 font-sans text-[10px] text-slate-500 hover:border-slate-500"
            >
              {say({ language, en: "close", fr: "fermer" })}
            </button>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {cascade.slice(-10).map((target, index) => (
              <CascadeCard
                key={cascade.length - Math.min(cascade.length, 10) + index}
                space={space}
                target={target}
                language={language}
                isLast={index === Math.min(cascade.length, 10) - 1}
                isSecondToLast={index === Math.min(cascade.length, 10) - 2}
                onOpen={(layerName, path) =>
                  setCascade([...cascade, { layer: layerName, path: [...path], key: null }])
                }
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
