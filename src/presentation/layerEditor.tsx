// The living layer editor: a layer added at runtime is reopened,
// rewritten in place, and re-judged — the same tribunal as an
// addition. The staged tree replaces the layer's tree, the touch
// protocol declares the write, every memo entry that depends on the
// layer is invalidated, the panels re-read the space. The corpus
// stays read-only: its layers never open here.

import { useState } from "react";
import type { LayeredDataKernel } from "../application/corpus.ts";
import { renderMessage, type Language } from "../domain/messages.ts";
import {
  streamStageLayerEdition,
  applyStagedEdition,
  type AppliedEdition,
  type EditionOutcome,
  type LivingAddition,
} from "../application/edition.ts";
import type { StagingOutcome } from "../application/staging.ts";
import { asLayerName } from "../domain/identifiers.ts";
import { editionRefusalLabel, labelOf, say } from "./i18n.ts";

/** What the editor shows of the last judgement: the staged edition
 * plus the layer names that were re-judged. */
interface EditorResult {
  outcome: EditionOutcome;
  applied: boolean;
}

export function LayerEditor({
  kernel,
  layerName,
  initialSource,
  livingAdditions,
  livingLayerNames,
  onApplied,
  onClose,
  language,
}: {
  kernel: LayeredDataKernel;
  layerName: string;
  initialSource: string;
  livingAdditions: readonly LivingAddition[];
  livingLayerNames: readonly string[];
  onApplied: (edition: AppliedEdition) => void;
  onClose: () => void;
  language: Language;
}) {
  const [source, setSource] = useState(initialSource);
  const [result, setResult] = useState<EditorResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [stagingProgress, setStagingProgress] = useState<{ done: number; total: number } | null>(
    null,
  );

  async function judgeAndApply() {
    setBusy(true);
    setStagingProgress(null);
    try {
      // The revalidation runs chunk by chunk on the event loop
      // (ADR-0108): the button shows the progress, the interface
      // stays responsive, the outcome is the synchronous one's.
      const outcome = await streamStageLayerEdition(
        {
          languageSource: kernel.languageSource,
          livingAdditions,
          livingLayerNames,
          readonlyLayerNames: kernel.layerNames,
          layerName: asLayerName(layerName),
          editedSource: source,
          language,
        },
        { onChunk: (chunk) => setStagingProgress(chunk.progress) },
      );
      if (!outcome.ok) {
        setResult({ outcome, applied: false });
        return;
      }
      const edition = applyStagedEdition({
        space: kernel.space,
        layerName: asLayerName(layerName),
        staging: outcome.staging,
        readonlyLayerNames: kernel.layerNames,
      });
      setResult({ outcome, applied: true });
      onApplied(edition);
    } finally {
      setBusy(false);
      setStagingProgress(null);
    }
  }

  const staging: StagingOutcome | null = result ? result.outcome.staging : null;

  return (
    <div className="mb-3 rounded-lg border border-sky-200 bg-sky-50/40 p-3">
      <div className="mb-2 flex flex-wrap items-center gap-1.5">
        <span className="rounded bg-sky-600 px-1.5 py-0.5 text-[11px] font-bold text-white">✎</span>
        <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
          {say({
            language,
            en: "edit the living layer « " + layerName + " »",
            fr: "éditer la couche vivante « " + layerName + " »",
          })}
        </span>
        <button type="button"
          onClick={onClose}
          title={say({
            language,
            en: "close the editor — nothing is written into the space",
            fr: "fermer l'éditeur — rien n'est écrit dans l'espace",
          })}
          className="ml-auto rounded px-1.5 py-0.5 text-[11px] text-slate-600 hover:text-slate-700 dark:text-slate-200"
        >
          ✕
        </button>
      </div>
      <p className="mb-2 text-[11px] leading-4 text-slate-500">
        {say({
          language,
          en: "the layer leaves the living context for the time of the judgement: the staging revalidates the whole corpus + supplements, replays the expectations of the other living layers and demands 0 verdict; renaming the layer or sliding another one in is not editing; and the bedrock is read-only by protocol — an edition never aims at it (ADR-0103)",
          fr: "la couche quitte le contexte vivant le temps du jugement : le staging revalide corpus + suppléments entiers, rejoue les attendus des autres couches vivantes et exige 0 verdict ; renommer la couche ou en glisser une autre n'est pas l'éditer ; et le socle est immuable par protocole — une édition ne vise jamais le socle (ADR-0103)",
        })}
      </p>
      <textarea
        value={source}
        onChange={(event) => setSource(event.target.value)}
        spellCheck={false}
        rows={10}
        className="mb-2 w-full rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-2 font-mono text-[11px] leading-4"
      />
      <div className="flex flex-wrap items-center gap-2">
        <button type="button"
          onClick={() => {
            void judgeAndApply();
          }}
          disabled={busy || !source.trim()}
          className="rounded bg-sky-600 px-2 py-1 text-xs font-semibold text-white hover:bg-sky-500 disabled:opacity-50"
        >
          {busy && stagingProgress !== null
            ? say({
                language,
                en: "staging — " + stagingProgress.done + "/" + stagingProgress.total + " judged…",
                fr: "staging — " + stagingProgress.done + "/" + stagingProgress.total + " jugées…",
              })
            : say({
                language,
                en: "staging — re-judge & rewrite the layer",
                fr: "staging — rejuger & réécrire la couche",
              })}
        </button>
        <span className="text-[10px] leading-4 text-slate-600">
          {say({
            language,
            en: "the accepted tree replaces the old one in place, the invalidation protocol re-reads the workshop — the corpus ranks stay frozen",
            fr: "l'arbre accepté remplace l'ancien en place, le protocole d'invalidation relit l'atelier — les rangs du corpus restent gelés",
          })}
        </span>
      </div>
      {result !== null && staging !== null && staging.step === "syntaxe" && !result.applied && (
        <div className="mt-2 rounded-md border border-red-200 bg-red-50 px-2 py-1.5 text-[11px] leading-4 text-red-700">
          <div className="font-semibold">
            {say({
              language,
              en: "staging — the syntax refuses the edition:",
              fr: "staging — la syntaxe refuse l'édition :",
            })}
          </div>
          {staging.errors.map((error, index) => (
            <div key={index} className="font-mono">
              {error}
            </div>
          ))}
        </div>
      )}
      {result !== null &&
        staging !== null &&
        staging.step === "validation" &&
        staging.verdicts.length > 0 &&
        !result.applied && (
          <div className="mt-2 rounded-md border border-amber-200 bg-amber-50 px-2 py-1.5 text-[11px] leading-4 text-amber-800">
            <div className="font-semibold">
              {say({
                language,
                en:
                  "staging — " +
                  staging.verdicts.length +
                  " assembly verdict(s), the edition is refused:",
                fr:
                  "staging — " +
                  staging.verdicts.length +
                  " verdict(s) d'assemblage, l'édition est refusée :",
              })}
            </div>
            {staging.verdicts.map((verdict, index) => (
              <div key={index}>
                <span className="font-semibold">{labelOf({ code: verdict.kind, language })}</span>
                {" — " + renderMessage({ message: verdict.fact, language })}
              </div>
            ))}
          </div>
        )}
      {result !== null && result.outcome.refusals.length > 0 && !result.applied && (
        <div className="mt-2 rounded-md border border-amber-200 bg-amber-50 px-2 py-1.5 text-[11px] leading-4 text-amber-800">
          <div className="font-semibold">
            {say({ language, en: "the edition is refused:", fr: "l'édition est refusée :" })}
          </div>
          {result.outcome.refusals.map((refusal, index) => (
            <div key={index}>{editionRefusalLabel({ code: refusal, language })}</div>
          ))}
        </div>
      )}
      {result !== null && result.applied && (
        <div className="mt-2 rounded-md border border-sky-200 bg-white dark:bg-slate-800 px-2 py-1.5 text-[11px] leading-4 text-sky-700">
          {say({
            language,
            en:
              "staging: 0 verdict — the layer « " +
              layerName +
              " » is rewritten, the write is declared, the workshop re-reads the space",
            fr:
              "staging : 0 verdict — la couche « " +
              layerName +
              " » est réécrite, l'écriture est déclarée, l'atelier relit l'espace",
          })}
        </div>
      )}
    </div>
  );
}
