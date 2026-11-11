// Tutorial page — the markdown-driven walkthrough. The prose lives
// in two hand-editable files (tutorial.en.md, tutorial.fr.md), read
// at build time and parsed by the measured dialect: headings,
// paragraphs, lists, code fences — and the `ldflat:<layer>` fence,
// which this page resolves at run time against the tutorial corpus
// (formalisms/tutorial, ten layers, simpler than the kernel) into
// the interactive flattened listing: every line carries its
// parentage and opens the workshop's cascade card. The old
// eleven-step component tutorial is retired: the code is the
// artifact, the markdown is the narration, and both are editable
// by hand.

import React, { useMemo } from "react";
import { useRouter } from "../components/Router";
import { say } from "../presentation/i18n.ts";
import { NotionText, GLOSSARY, NotionTip } from "../presentation/notions.tsx";
import { parseTutorialMarkdown, type TutorialBlock } from "../presentation/tutorialMarkdown.ts";
import { TutorialListing } from "../presentation/TutorialListing.tsx";
import { highlightSourceLine, SPAN_CLASSES } from "../presentation/layerSourceView.tsx";
import { assembleTutorialKernel } from "../application/corpus.ts";
import { loadTutorialLayerSources } from "../infrastructure/corpusLoader.ts";
import { asLayerName } from "../domain/identifiers.ts";
import type { Language } from "../domain/messages.ts";
import RAW_TUTORIAL_EN from "../presentation/tutorial.en.md?raw";
import RAW_TUTORIAL_FR from "../presentation/tutorial.fr.md?raw";

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
            <strong key={index} className="font-semibold text-slate-900">
              <NotionText text={chunk.slice(2, -2)} language={language} />
            </strong>
          );
        }
        if (chunk.startsWith("`") && chunk.endsWith("`") && chunk.length > 2) {
          return (
            <code
              key={index}
              className="rounded bg-slate-100 px-1 py-0.5 font-mono text-[12px] text-slate-800"
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
    <pre className="overflow-x-auto rounded-md border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-xs leading-5">
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
  onChooseLanguage: (lang: Language) => void;
}

export function TutorialPage({ language, onChooseLanguage }: TutorialPageProps) {
  const { navigate } = useRouter();
  const source = language === "fr" ? RAW_TUTORIAL_FR : RAW_TUTORIAL_EN;
  const blocks = useMemo(() => parseTutorialMarkdown({ source }), [source]);

  const renderBlock = (block: TutorialBlock, index: number): React.ReactNode => {
    switch (block.kind) {
      case "heading":
        if (block.level === 1) {
          return (
            <h1 key={index} className="text-2xl font-bold text-slate-800">
              <NotionText text={block.text} language={language} />
            </h1>
          );
        }
        if (block.level === 2) {
          return (
            <h2
              key={index}
              className="mt-10 border-t border-slate-200 pt-6 text-lg font-bold text-slate-800"
            >
              <NotionText text={block.text} language={language} />
            </h2>
          );
        }
        return (
          <h3 key={index} className="mt-6 text-base font-bold text-slate-700">
            <NotionText text={block.text} language={language} />
          </h3>
        );
      case "paragraph":
        return (
          <p key={index} className="text-sm leading-6 text-slate-700">
            <TutorialInline text={block.text} language={language} />
          </p>
        );
      case "list":
        return (
          <ul key={index} className="list-disc space-y-1 pl-6 text-sm leading-6 text-slate-700">
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
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <header className="border-b border-slate-200 bg-white px-5 py-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div className="flex items-center gap-4">
            <button type="button"
              onClick={() => navigate("landing")}
              className="rounded-lg border border-slate-300 px-3 py-1 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              {say({ language, en: "← Back", fr: "← Retour" })}
            </button>
            <h1 className="text-lg font-bold">
              {say({ language, en: "Tutorial", fr: "Tutoriel" })}
            </h1>
          </div>
          <span className="flex shrink-0 items-center gap-1 text-xs">
            <span className="mr-1 text-slate-400">
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
                    : "border-slate-300 bg-white text-slate-500 hover:border-slate-500")
                }
              >
                {choice}
              </button>
            ))}
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-4xl space-y-4 p-8">
        {blocks.map(renderBlock)}

        <section className="mt-10 rounded-lg border border-slate-200 bg-white p-6">
          <h2 className="text-base font-bold text-slate-800">
            {say({ language, en: "Glossary", fr: "Glossaire" })}
          </h2>
          <p className="mt-1 text-xs leading-5 text-slate-500">
            {say({
              language,
              en: "every notion this page cites — hover a term for its one-line definition.",
              fr: "chaque notion citée dans cette page — survolez un terme pour sa définition en une ligne.",
            })}
          </p>
          <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1">
            {Object.keys(GLOSSARY).map((term) => (
              <NotionTip key={term} term={term} language={language} />
            ))}
          </div>
        </section>

        <div className="mt-12 flex justify-center gap-4">
          <button type="button"
            onClick={() => navigate("landing")}
            className="rounded-lg border-2 border-slate-300 px-6 py-3 text-slate-700 font-semibold hover:bg-slate-50 transition-colors"
          >
            {say({ language, en: "← Landing", fr: "← Accueil" })}
          </button>
          <button type="button"
            onClick={() => navigate("filiation")}
            className="rounded-lg border-2 border-slate-400 px-6 py-3 text-slate-700 font-semibold hover:bg-slate-50 transition-colors"
          >
            {say({ language, en: "Filiation & comparison →", fr: "Filiation & comparaison →" })}
          </button>
          <button type="button"
            onClick={() => navigate("workshop")}
            className="rounded-lg bg-sky-600 px-6 py-3 text-white font-semibold hover:bg-sky-500 transition-colors"
          >
            {say({ language, en: "Workshop →", fr: "Atelier →" })}
          </button>
        </div>
      </main>
    </div>
  );
}
