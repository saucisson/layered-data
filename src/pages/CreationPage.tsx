// The creation page — create a new formalism with the assistance
// of the workshop's AI geologist. The intention is said; the
// geologist proposes a draft (the server proxy to the model when
// it answers, the deterministic simulated proposal otherwise —
// honestly labeled, never a silent failure); the draft is
// corrected freely; the staging judges corpus + supplement and
// demands 0 verdict; the accepted layer enters the living session
// and stays visible from the hierarchy and formalism pages.

import { useMemo, useState } from "react";
import { useRouter } from "../components/Router";
import { assembleLayeredDataKernel } from "../application/corpus.ts";
import {
  materializeSessionAdditions,
  readSessionVersion,
  writeSessionAddition,
} from "../application/session.ts";
import { loadKernelLayerSources } from "../infrastructure/corpusLoader.ts";
import { AccessCodeForm } from "../presentation/accessForm.tsx";
import { AddFormalismComposer, type AcceptedAddition } from "../presentation/addFormalism.tsx";
import { LAYER_COLOR } from "../presentation/workshopInventory.ts";
import { say } from "../presentation/i18n.ts";
import type { Language } from "../domain/messages.ts";

interface CreationPageProps {
  language: Language;
  onChooseLanguage: (lang: Language) => void;
}

// The kernel of the page: assembled once from the corpus files.
// The session additions materialize into it, replayed at each
// change of the session ledger (the version is the memo key).
const KERNEL = assembleLayeredDataKernel({ layerSources: loadKernelLayerSources() });

/** Three example intentions — said, not executed: the visitor
 * copies one, or writes their own. */
const EXAMPLE_INTENTIONS: { en: string; fr?: string | undefined }[] = [
  {
    en: "a net whose arcs carry a charge",
  },
  {
    en: "a graph whose vertices carry a color",
  },
  {
    en: "a directed graph without parallel arcs, bound to a check",
  },
];

export function CreationPage({ language, onChooseLanguage }: CreationPageProps) {
  const { navigate } = useRouter();
  const [sessionVersion, setSessionVersion] = useState(readSessionVersion());
  const session = useMemo(() => materializeSessionAdditions({ kernel: KERNEL }), [sessionVersion]);
  const createdLayerNames = session.layerNames.slice(KERNEL.layerNames.length);

  function handleAdded(addition: AcceptedAddition) {
    writeSessionAddition({
      addition: { source: addition.source, layerNames: [...addition.newLayerNames] },
    });
    setSessionVersion(readSessionVersion());
  }

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-800 text-slate-900">
      <header className="border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-5 py-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h1 className="text-lg font-bold">
            {say({
              language,
              en: "Create a formalism — with the assistance of the geologist",
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
            onClick={() => navigate("workshop")}
            className="rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1 text-slate-600 hover:border-slate-600"
          >
            {say({ language, en: "the workshop →"})}
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-4xl p-4 sm:p-6">
        <section className="mb-4 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 text-sm leading-6 text-slate-600">
          <h2 className="mb-2 text-base font-bold text-slate-800 dark:text-slate-100">
            {say({ language, en: "The protocol"})}
          </h2>
          <p>
            {say({
              language,
              en: "You say the intention; the geologist (the workshop's AI, grounded in the real state of the corpus and verified by the staging loop) proposes a draft in the language; you correct it freely; the staging judges corpus + supplement and demands 0 verdict; the accepted layer enters the living session. Without a server or a key, the deterministic simulated AI of the canvas answers instead — degraded, honestly labeled, never a silent failure.",
            })}
          </p>
          <p className="mt-2 text-[11px] text-slate-600">
            {say({
              language,
              en: "Examples of intentions — copy one, or write your own: ",
            })}
            {EXAMPLE_INTENTIONS.map((example, index) => (
              <span key={index} className="font-mono text-slate-500">
                {"« " + say({ language, en: example.en}) + " »"}
                {index < EXAMPLE_INTENTIONS.length - 1 ? " · " : ""}
              </span>
            ))}
          </p>
        </section>

        {/* The lock of the geologist: the proxy that answers the
            "ask the AI" call is protected — the access code is
            entered here once, kept by the browser; without it the
            call answers 401 and the simulated AI speaks instead,
            honestly labeled. */}
        <section className="mb-4">
          <AccessCodeForm language={language} />
        </section>

        <section className="mb-4">
          <AddFormalismComposer
            kernel={KERNEL}
            livingLayerNames={session.layerNames}
            previousAdditionSources={session.sources}
            onAdded={handleAdded}
            language={language}
          />
        </section>

        <section className="mb-4 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4">
          <h2 className="mb-2 text-sm font-bold text-slate-800 dark:text-slate-100">
            {say({
              language,
              en: "The formalisms of this session",
            })}
          </h2>
          {createdLayerNames.length === 0 ? (
            <p className="text-[11px] text-slate-600">
              {say({
                language,
                en: "Nothing yet — an accepted draft appears here, and stays visible from the hierarchy and formalism pages for as long as the tab lives (the disk quarry, through the workshop, remains the durable path).",
              })}
            </p>
          ) : (
            <div className="space-y-1.5">
              {createdLayerNames.map((layerName) => (
                <div key={layerName} className="flex flex-wrap items-center gap-2 text-xs">
                  <span
                    className={
                      "h-2 w-2 shrink-0 rounded-full " + (LAYER_COLOR[layerName] ?? "bg-slate-300")
                    }
                  />
                  <span className="font-mono font-semibold">{layerName}</span>
                  <button type="button"
                    onClick={() => navigate("formalism", layerName)}
                    className="rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-600 hover:border-slate-600 hover:text-slate-900"
                  >
                    {say({ language, en: "understand it →"})}
                  </button>
                  <button type="button"
                    onClick={() => navigate("hierarchy")}
                    className="rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-600 hover:border-slate-600 hover:text-slate-900"
                  >
                    {say({
                      language,
                      en: "see it in the hierarchy →",
                    })}
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 text-[11px] leading-5 text-slate-500">
          <h2 className="mb-1 text-sm font-bold text-slate-800 dark:text-slate-100">
            {say({ language, en: "The gestures of the language"})}
          </h2>
          <p>
            {say({
              language,
              en: '"layer <name>" opens a layer; "refines @<layer>" declares a parent, "then @<other>" chains them; blocks open by indentation (specification, the collections, tests); a member is written "<key> refines @<absolute-path>"; the acts are extend, override, abstract, bind, check, and a value "slot = <value>". The tutorial of the workshop explains the seven gestures, step by step.',
            })}
          </p>
          <button type="button"
            onClick={() => navigate("tutorial")}
            className="mt-2 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1 text-[11px] text-slate-600 hover:border-slate-600 hover:text-slate-900"
          >
            {say({ language, en: "the tutorial →"})}
          </button>
        </section>
      </main>
    </div>
  );
}
