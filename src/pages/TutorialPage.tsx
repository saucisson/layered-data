// Tutorial page — the markdown-driven walkthrough. The prose lives
// in a hand-editable file (tutorial.en.md), read
// at build time and parsed by the measured dialect: headings,
// paragraphs, lists, code fences — and the `ldflat:<layer>` fence,
// which this page resolves at run time against the tutorial corpus
// (formalisms/tutorial, nine layers, simpler than the kernel) into
// the interactive flattened listing: every line carries its
// parentage and opens the workshop's cascade card. The old
// eleven-step component tutorial is retired: the code is the
// artifact, the markdown is the narration, and both are editable
// by hand.

import React, { useMemo } from "react";
import { hashOf } from "../components/Router";
import { say } from "../presentation/i18n.ts";
import { NotionText } from "../presentation/notions.tsx";
import { parseTutorialMarkdown, type TutorialBlock } from "../presentation/tutorialMarkdown.ts";
import { TutorialListing } from "../presentation/TutorialListing.tsx";
import { highlightSourceLine, SPAN_CLASSES } from "../presentation/layerSourceView.tsx";
import { assembleTutorialKernel } from "../application/corpus.ts";
import { loadTutorialLayerSources } from "../infrastructure/corpusLoader.ts";
import { asLayerName } from "../domain/identifiers.ts";
import type { Language } from "../domain/messages.ts";
import RAW_TUTORIAL_EN from "../presentation/tutorial.en.md?raw";

const TUTORIAL_KERNEL = assembleTutorialKernel({ layerSources: loadTutorialLayerSources() });

/** One inline fragment of markdown prose: **bold**, `code`, and the
 * ⟪…⟫ notion marks, resolved to the glossary's tooltips. */
function TutorialInline({ text, language }: { text: string; language: Language }) {
  const chunks = text.split(/(\*\*[^*]+\*\*|\x60[^\x60]+\x60)/g);
  return (
    <>
      {chunks.map((chunk, index) => {
        if (chunk.startsWith("**") && chunk.endsWith("**") && chunk.length > 4) {
          return (
            <strong key={index} className="font-semibold text-slate-900 dark:text-slate-100">
              <NotionText text={chunk.slice(2, -2)} language={language} />
            </strong>
          );
        }
        if (chunk.startsWith("`") && chunk.endsWith("`") && chunk.length > 2) {
          return (
            <code
              key={index}
              className="rounded bg-slate-100 dark:bg-slate-800 px-1 py-0.5 font-mono text-[12px] text-slate-800 dark:text-slate-100"
            >
              {chunk.slice(1, -1)}
            </code>
          );
        }
        return <NotionText key={index} text={chunk} language={language} />;
      })}
    </>
  );
}

/** One plain code fence: the artifact feeds both tongues unchanged,
 * colored by the same rules as the « Language » tab. */
function TutorialCode({ source, language }: { source: string; language: string }) {
  return (
    <pre className="overflow-x-auto rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2 font-mono text-xs leading-5">
      {source.split("\n").map((line, lineIndex) => (
        <div key={lineIndex}>
          {language === "ld"
            ? highlightSourceLine(line).map((span, spanIndex) => (
                <span key={spanIndex} className={SPAN_CLASSES[span.kind]}>
                  {span.text}
                </span>
              ))
            : line}
        </div>
      ))}
    </pre>
  );
}

interface TutorialPageProps {
  language: Language;
}

export function TutorialPage({ language }: TutorialPageProps) {
  const source = RAW_TUTORIAL_EN;
  const blocks = useMemo(() => parseTutorialMarkdown({ source }), [source]);

  const renderBlock = (block: TutorialBlock, index: number): React.ReactNode => {
    switch (block.kind) {
      case "heading":
        if (block.level === 1) {
          return (
            <h1 key={index} className="text-2xl font-bold text-slate-800 dark:text-slate-100">
              <NotionText text={block.text} language={language} />
            </h1>
          );
        }
        if (block.level === 2) {
          return (
            <h2
              key={index}
              className="mt-10 border-t border-slate-200 dark:border-slate-700 pt-6 text-lg font-bold text-slate-800 dark:text-slate-100"
            >
              <NotionText text={block.text} language={language} />
            </h2>
          );
        }
        return (
          <h3 key={index} className="mt-6 text-base font-bold text-slate-700 dark:text-slate-200">
            <NotionText text={block.text} language={language} />
          </h3>
        );
      case "paragraph":
        return (
          <p key={index} className="text-sm leading-6 text-slate-700 dark:text-slate-200">
            <TutorialInline text={block.text} language={language} />
          </p>
        );
      case "list":
        return (
          <ul key={index} className="list-disc space-y-1 pl-6 text-sm leading-6 text-slate-700 dark:text-slate-200">
            {block.items.map((item, itemIndex) => (
              <li key={itemIndex}>
                <TutorialInline text={item} language={language} />
              </li>
            ))}
          </ul>
        );
      case "code":
        return <TutorialCode key={index} source={block.source} language={block.language} />;
      case "listing":
        return (
          <TutorialListing
            key={index}
            space={TUTORIAL_KERNEL.space}
            layer={asLayerName(block.layer)}
            language={language}
          />
        );
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100">
      <div className="mx-auto max-w-4xl space-y-4 p-4 sm:p-8">
        {blocks.map(renderBlock)}

        {/* No glossary section (#229): the definitions stay available
            as tooltips on the ⟪terms⟫ cited in the prose (#230). */}

        <div className="mt-12 flex justify-center gap-4">
          <a href={hashOf("landing")}
            className="rounded-lg border-2 border-slate-300 dark:border-slate-600 px-6 py-3 text-slate-700 dark:text-slate-200 font-semibold hover:bg-slate-50 dark:hover:bg-slate-700 dark:bg-slate-900 transition-colors"
          >
            {say({ language, en: "← Home"})}
          </a>
          <a href={hashOf("filiation")}
            className="rounded-lg border-2 border-slate-400 px-6 py-3 text-slate-700 dark:text-slate-200 font-semibold hover:bg-slate-50 dark:hover:bg-slate-700 dark:bg-slate-900 transition-colors"
          >
            {say({ language, en: "Filiation & comparison →"})}
          </a>
          <a href={hashOf("formalisms")}
            className="rounded-lg bg-sky-600 dark:bg-sky-700 px-6 py-3 text-white font-semibold hover:bg-sky-500 dark:hover:bg-sky-600 transition-colors"
          >
            {say({ language, en: "Workshop →"})}
          </a>
        </div>
      </div>
    </div>
  );
}
