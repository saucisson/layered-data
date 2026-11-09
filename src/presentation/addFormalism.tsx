// The living workshop composer (the ＋ button): the intention is
// said, the geologist writes (or is generated), the staging judges, the
// space extends. Dual mode: the local project (small proxy →
// api.mistral.ai) when it answers, the simulated AI of the canvas
// otherwise — degraded stream, deterministic, honestly labeled;
// never a silent failure.

import React, { useState } from "react";
import type { LayeredDataKernel } from "../application/corpus.ts";
import { renderMessage, type Language } from "../domain/messages.ts";
import {
  simulatedAssistantProposal,
  streamStageLayerAddition,
  applyStagedAddition,
  type StagingOutcome,
} from "../application/staging.ts";
import { apiFetch } from "../infrastructure/wardrobeClient.ts";
import { labelOf, say } from "./i18n.ts";

/** What the composer shows of the last staging: the staging
 * outcome plus the layer names that actually entered the space. */
interface ComposerResult extends StagingOutcome {
  newLayerNames: string[];
}

/** What the composer hands over when the staging accepts a draft:
 * the accepted source, the layers that entered the space, their
 * source blocks (for the language tab) and their declared
 * refinement targets (for the workshop graph). */
export interface AcceptedAddition {
  source: string;
  newLayerNames: string[];
  blocks: Record<string, string>;
  refinementTargets: Record<string, string[]>;
}

export function AddFormalismComposer({
  kernel,
  livingLayerNames,
  previousAdditionSources,
  onAdded,
  language,
}: {
  kernel: LayeredDataKernel;
  livingLayerNames: readonly string[];
  previousAdditionSources: readonly string[];
  onAdded: (addition: AcceptedAddition) => void;
  language: Language;
}) {
  const [intention, setIntention] = useState("");
  const [draftSource, setDraftSource] = useState("");
  const [proposalOrigin, setProposalOrigin] = useState<string | null>(null);
  const [composerResult, setComposerResult] = useState<ComposerResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [stagingProgress, setStagingProgress] = useState<{ done: number; total: number } | null>(null);

  async function requestProposal() {
    setBusy(true);
    // Dual mode: the local proxy first, the degraded stream of the
    // canvas otherwise — a failed network geologist does not exist, the
    // source of the proposal always speaks.
    let origin = say({
      language,
      en: "simulated AI — degraded stream of the canvas (no network, no key)",
      fr: "IA simulée — flux dégradé du canvas (sans réseau ni clé)",
    });
    let text = simulatedAssistantProposal({ intention, language });
    try {
      const response = await apiFetch({
        endpoint: "api/generate",
        options: {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ prompt: intention }),
        },
      });
      if (response.ok) {
        const proposedText = (await response.text()).trim();
        if (proposedText.length > 0) {
          origin = say({
            language,
            en: "api.mistral.ai — via the local project's proxy",
            fr: "api.mistral.ai — via le proxy du projet local",
          });
          text = proposedText;
        }
      } else if (response.status === 401) {
        origin = say({
          language,
          en: "protected proxy — access code required; simulated AI of the canvas",
          fr: "proxy protégé — code d'accès requis ; IA simulée du canvas",
        });
      } else {
        // An upstream refusal speaks — refused key, unknown model,
        // exhausted quota: never a mute "bad gateway", the error
        // surfaces in the origin line.
        const detail = (await response.text()).trim();
        origin =
          say({ language, en: "the proxy answered ", fr: "proxy a répondu " }) +
          response.status +
          " : " +
          detail.slice(0, 180) +
          say({ language, en: " ; simulated AI of the canvas", fr: " ; IA simulée du canvas" });
      }
    } catch {}
    setProposalOrigin(origin);
    setDraftSource(text);
    setComposerResult(null);
    setBusy(false);
  }

  async function validateAndAdd() {
    setBusy(true);
    setStagingProgress(null);
    try {
      // The validation runs chunk by chunk on the event loop
      // (ADR-0026): the button shows the progress, the interface
      // stays responsive, the outcome is the synchronous one's.
      const staging = await streamStageLayerAddition(
        {
          languageSource: kernel.languageSource,
          previousAdditionSources: [...previousAdditionSources],
          draftSource,
          livingLayerNames,
          readonlyLayerNames: kernel.layerNames,
          language,
        },
        { onChunk: (chunk) => setStagingProgress(chunk.progress) },
      );
      const applied = staging.ok
        ? applyStagedAddition({
            space: kernel.space,
            staging,
            knownLayerNames: livingLayerNames,
            readonlyLayerNames: kernel.layerNames,
          })
        : null;
      const newLayerNames = applied ? applied.newLayerNames : [];
      setComposerResult({ ...staging, newLayerNames });
      if (staging.ok && applied && applied.newLayerNames.length > 0) {
        onAdded({
          source: draftSource.trim(),
          newLayerNames: applied.newLayerNames,
          blocks: staging.blocks,
          refinementTargets: applied.refinementTargetsOf,
        });
      }
    } finally {
      setBusy(false);
      setStagingProgress(null);
    }
  }

  return (
    <div className="mb-3 rounded-lg border border-emerald-200 bg-emerald-50/40 p-3">
      <div className="mb-2 flex flex-wrap items-center gap-1.5">
        <span className="rounded bg-emerald-600 px-1.5 py-0.5 text-[11px] font-bold text-white">
          ＋
        </span>
        <span className="text-xs font-semibold text-slate-700">
          {say({ language, en: "one more formalism", fr: "un formalisme de plus" })}
        </span>
        <span className="text-[11px] leading-4 text-slate-500">
          {say({
            language,
            en: "the intention is said, the layer is written by hand or generated, the staging revalidates corpus + supplements and demands 0 assembly verdict — then the space extends, the corpus ranks stay frozen",
            fr: "l'intention se dit, la couche s'écrit à la main ou se génère, le staging revalide corpus + suppléments et exige 0 verdict d'assemblage — puis l'espace s'étend, les rangs du corpus restent gelés",
          })}
        </span>
      </div>
      <div className="mb-2 flex flex-wrap items-center gap-1.5">
        <input
          value={intention}
          onChange={(event) => setIntention(event.target.value)}
          placeholder={say({
            language,
            en: "intention — « a net whose arcs carry a charge »",
            fr: "intention — « un réseau dont les arcs portent une charge »",
          })}
          className="min-w-40 flex-1 rounded border border-slate-200 px-2 py-1 text-xs"
        />
        <button
          onClick={() => {
            void requestProposal();
          }}
          disabled={busy}
          className="rounded bg-slate-800 px-2 py-1 text-xs font-semibold text-white hover:bg-slate-700 disabled:opacity-50"
        >
          {busy ? "…" : say({ language, en: "ask the AI", fr: "demander à l'IA" })}
        </button>
      </div>
      {proposalOrigin !== null && (
        <p className="mb-1 text-[10px] text-slate-500">
          {say({ language, en: "draft proposed by: ", fr: "brouillon proposé par : " })}
          {proposalOrigin}
        </p>
      )}
      <textarea
        value={draftSource}
        onChange={(event) => setDraftSource(event.target.value)}
        spellCheck={false}
        rows={8}
        placeholder={"layer mon-axe refines @graph\n  …"}
        className="mb-2 w-full rounded border border-slate-200 bg-white p-2 font-mono text-[11px] leading-4"
      />
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => {
            void validateAndAdd();
          }}
          disabled={busy || !draftSource.trim()}
          className="rounded bg-emerald-600 px-2 py-1 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
        >
          {busy && stagingProgress !== null
            ? say({
                language,
                en: "staging — " + stagingProgress.done + "/" + stagingProgress.total + " judged…",
                fr: "staging — " + stagingProgress.done + "/" + stagingProgress.total + " jugées…",
              })
            : say({ language, en: "staging — validate & add", fr: "staging — valider & ajouter" })}
        </button>
        <span className="text-[10px] leading-4 text-slate-400">
          {say({
            language,
            en: "the least assembly verdict, anywhere, refuses the entry — the supplement never circumvents the contract",
            fr: "le moindre verdict d'assemblage, où qu'il soit, refuse l'entrée — le supplément ne contourne jamais le contrat",
          })}
        </span>
      </div>
      {composerResult !== null && (
        <div className="mt-2 space-y-1">
          {composerResult.step === "syntaxe" && (
            <div className="rounded-md border border-red-200 bg-red-50 px-2 py-1.5 text-[11px] leading-4 text-red-700">
              <div className="font-semibold">
                {say({
                  language,
                  en: "staging — the syntax refuses the candidate:",
                  fr: "staging — la syntaxe refuse le candidat :",
                })}
              </div>
              {composerResult.errors.map((error, index) => (
                <div key={index} className="font-mono">{error}</div>
              ))}
            </div>
          )}
          {composerResult.step === "validation" && composerResult.verdicts.length > 0 && (
            <div className="rounded-md border border-amber-200 bg-amber-50 px-2 py-1.5 text-[11px] leading-4 text-amber-800">
              <div className="font-semibold">
                {say({
                  language,
                  en:
                    "staging — " +
                    composerResult.verdicts.length +
                    " assembly verdict(s), the entry is refused:",
                  fr:
                    "staging — " +
                    composerResult.verdicts.length +
                    " verdict(s) d'assemblage, l'entrée est refusée :",
                })}
              </div>
              {composerResult.verdicts.map((verdict, index) => (
                <div key={index}>
                  <span className="font-semibold">{labelOf({ code: verdict.kind, language })}</span>
                  {" — " + renderMessage({ message: verdict.fact, language })}
                </div>
              ))}
            </div>
          )}
          {composerResult.ok && (composerResult.newLayerNames ?? []).length > 0 && (
            <div className="rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1.5 text-[11px] leading-4 text-emerald-700">
              {say({
                language,
                en:
                  "staging: 0 verdict — " +
                  composerResult.newLayerNames.length +
                  " layer(s) entered the space: " +
                  composerResult.newLayerNames.join(", "),
                fr:
                  "staging : 0 verdict — " +
                  composerResult.newLayerNames.length +
                  " couche(s) entrée(s) dans l'espace : " +
                  composerResult.newLayerNames.join(", "),
              })}
            </div>
          )}
          {composerResult.ok && (composerResult.newLayerNames ?? []).length === 0 && (
            <div className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-[11px] leading-4 text-slate-600">
              {say({
                language,
                en: "staging: 0 verdict — but these layers are already in the space: nothing to add.",
                fr: "staging : 0 verdict — mais ces couches sont déjà dans l'espace : rien à ajouter.",
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
