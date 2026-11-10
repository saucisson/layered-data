// The disk quarry: the server's formalisms, one file per
// formalism in the language format — the bedrock read-only, the
// pens of other visitors beside it. The source opens, gets
// corrected, and enters the workshop only through staging — the
// disk never bypasses the contract; local pens absent from the
// disk can be put there with one button, visible to all.

import { useEffect, useState } from "react";
import type { LayeredDataKernel } from "../application/corpus.ts";
import { renderMessage, type Language } from "../domain/messages.ts";
import {
  stageLayerAddition,
  applyStagedAddition,
  type StagingOutcome,
} from "../application/staging.ts";
import { apiFetch } from "../infrastructure/wardrobeClient.ts";
import { labelOf, say } from "./i18n.ts";

/** One quarry entry as the proxy reports it: a name and whether
 * it belongs to the bedrock (read-only on the disk). */
interface WardrobeEntry {
  name: string;
  builtIn: boolean;
}

/** What the fold shows of the last staging: the staging outcome
 * plus the layer names that actually entered the space. */
interface LoadResult extends StagingOutcome {
  newLayerNames: string[];
}

import type { AcceptedAddition } from "./addFormalism.tsx";

export function DiskWardrobe({
  kernel,
  livingLayerNames,
  previousAdditionSources,
  localLayerSources,
  onAdded,
  language,
}: {
  kernel: LayeredDataKernel;
  livingLayerNames: readonly string[];
  previousAdditionSources: readonly string[];
  localLayerSources: Record<string, string>;
  onAdded: (addition: AcceptedAddition) => void;
  language: Language;
}) {
  const [entries, setEntries] = useState<WardrobeEntry[] | null>(null);
  const [selectedName, setSelectedName] = useState<string | null>(null);
  const [source, setSource] = useState("");
  const [loadResult, setLoadResult] = useState<LoadResult | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function refresh() {
    setMessage(null);
    try {
      const response = await apiFetch({ endpoint: "api/layers" });
      if (response.ok) {
        setEntries((await response.json()).layers);
      } else if (response.status === 401) {
        setEntries([]);
        setMessage(
          say({
            language,
            en: "access code required — the quarry is closed",
            fr: "code d'accès requis — la carrière est fermée",
          }),
        );
      } else {
        setEntries([]);
        setMessage(
          say({
            language,
            en: "response " + response.status + " from the proxy",
            fr: "réponse " + response.status + " du proxy",
          }),
        );
      }
    } catch {
      setEntries([]);
      setMessage(
        say({
          language,
          en: "without proxy — the quarry is empty, the workshop lives alone",
          fr: "sans proxy — la carrière est vide, l'atelier vit seul",
        }),
      );
    }
  }

  useEffect(() => {
    void refresh();
    // One refresh at mount: the manual button reloads.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function openLayer(name: string) {
    setSelectedName(name);
    setLoadResult(null);
    setMessage(null);
    try {
      const response = await apiFetch({ endpoint: "api/layers/" + encodeURIComponent(name) });
      if (response.ok) {
        setSource((await response.json()).source);
      } else {
        setSource("");
        setMessage(
          say({
            language,
            en: "impossible to read — response " + response.status + " from the proxy",
            fr: "lecture impossible — réponse " + response.status + " du proxy",
          }),
        );
      }
    } catch {
      setSource("");
      setMessage(
        say({ language, en: "without proxy — nothing to read", fr: "sans proxy — rien à lire" }),
      );
    }
  }

  function loadIntoWorkshop() {
    const staging = stageLayerAddition({
      languageSource: kernel.languageSource,
      previousAdditionSources: [...previousAdditionSources],
      draftSource: source,
      livingLayerNames,
      readonlyLayerNames: kernel.layerNames,
      language,
    });
    const applied = staging.ok
      ? applyStagedAddition({
          space: kernel.space,
          staging,
          knownLayerNames: livingLayerNames,
          readonlyLayerNames: kernel.layerNames,
        })
      : null;
    const newLayerNames = applied ? applied.newLayerNames : [];
    setLoadResult({ ...staging, newLayerNames });
    if (staging.ok && applied && applied.newLayerNames.length > 0) {
      onAdded({
        source: source.trim(),
        newLayerNames: applied.newLayerNames,
        blocks: staging.blocks,
        refinementTargets: applied.refinementTargetsOf,
      });
    }
  }

  async function putOnDisk(name: string, text: string) {
    try {
      const response = await apiFetch({
        endpoint: "api/layers/" + encodeURIComponent(name),
        options: {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ source: text }),
        },
      });
      if (response.ok) {
        setMessage(
          say({
            language,
            en: "« " + name + " » laid on the disk — visible to the other visitors",
            fr: "« " + name + " » posé sur le disque — visible des autres visiteurs",
          }),
        );
        void refresh();
      } else if (response.status === 401) {
        setMessage(
          say({
            language,
            en: "access code required — the disk is protected",
            fr: "code d'accès requis — le disque est protégé",
          }),
        );
      } else if (response.status === 403) {
        setMessage(
          say({
            language,
            en: "« " + name + " » belongs to the bedrock — read-only",
            fr: "« " + name + " » appartient au socle — lecture seule",
          }),
        );
      } else {
        setMessage(
          say({
            language,
            en: "response " + response.status + " from the proxy",
            fr: "réponse " + response.status + " du proxy",
          }),
        );
      }
    } catch {
      setMessage(
        say({
          language,
          en: "without proxy — nothing gets laid",
          fr: "sans proxy — rien ne se pose",
        }),
      );
    }
  }

  const onDiskNames = new Set((entries ?? []).map((entry) => entry.name));
  return (
    <div className="rounded-lg border border-sky-200 bg-sky-50/40 p-3">
      <div className="mb-2 flex flex-wrap items-center gap-1.5">
        <span className="rounded bg-sky-700 px-1.5 py-0.5 text-[11px] font-bold text-white">
          {say({ language, en: "disk", fr: "disque" })}
        </span>
        <span className="text-xs font-semibold text-slate-700">
          {say({ language, en: "the quarry of formalisms", fr: "la carrière des formalismes" })}
        </span>
        <button
          onClick={() => {
            void refresh();
          }}
          className="rounded border border-slate-300 bg-white px-1.5 text-[10px] text-slate-600 hover:border-sky-500 hover:text-sky-700"
        >
          {say({ language, en: "refresh", fr: "rafraîchir" })}
        </button>
        <span className="text-[11px] leading-4 text-slate-500">
          {say({
            language,
            en: "one file per formalism, in the language format — the bedrock read-only, the visitors' layers visible to all; every entry passes through the staging, the disk never bypasses the contract",
            fr: "un fichier par formalisme, au format langage — le socle en lecture seule, les couches des visiteurs visibles de tous ; toute entrée passe par le staging, le disque ne contourne jamais le contrat",
          })}
        </span>
      </div>
      {entries === null && (
        <p className="text-[11px] text-slate-500">
          {say({ language, en: "quarry opening…", fr: "carrière en cours d'ouverture…" })}
        </p>
      )}
      {entries !== null && entries.length === 0 && (
        <p className="text-[11px] text-slate-500">
          {say({
            language,
            en: "the quarry is empty or closed — without proxy, the workshop lives alone",
            fr: "la carrière est vide ou fermée — sans proxy, l'atelier vit seul",
          })}
        </p>
      )}
      {entries !== null && entries.length > 0 && (
        <div className="mb-2 flex max-h-32 flex-wrap gap-1 overflow-y-auto">
          {entries.map((entry) => (
            <button
              key={entry.name}
              onClick={() => {
                void openLayer(entry.name);
              }}
              className={
                "rounded px-1.5 py-0.5 text-[10px] font-mono leading-4 " +
                (selectedName === entry.name
                  ? "bg-sky-700 text-white"
                  : entry.builtIn
                    ? "border border-slate-300 bg-white text-slate-600 hover:border-sky-500"
                    : "border border-emerald-300 bg-white text-emerald-700 hover:border-emerald-500")
              }
              title={
                entry.builtIn
                  ? say({
                      language,
                      en: "bedrock — read-only on the disk",
                      fr: "socle — en lecture seule sur le disque",
                    })
                  : say({
                      language,
                      en: "a visitor's layer — on the disk",
                      fr: "couche d'un visiteur — sur le disque",
                    })
              }
            >
              {entry.name}
            </button>
          ))}
        </div>
      )}
      {selectedName !== null && (
        <>
          <textarea
            value={source}
            onChange={(event) => setSource(event.target.value)}
            spellCheck={false}
            rows={8}
            placeholder={"layer …"}
            className="mb-2 w-full rounded border border-slate-200 bg-white p-2 font-mono text-[11px] leading-4"
          />
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={loadIntoWorkshop}
              disabled={!source.trim()}
              className="rounded bg-emerald-600 px-2 py-1 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
            >
              {say({
                language,
                en: "staging — load into the workshop",
                fr: "staging — charger dans l'atelier",
              })}
            </button>
            <span className="text-[10px] leading-4 text-slate-400">
              {say({
                language,
                en: "the layer is corrected here like any other — the staging revalidates corpus + supplements + candidate, 0 verdict demanded",
                fr: "la couche se corrige ici comme toute autre — le staging revalide corpus + suppléments + candidat, 0 verdict exigé",
              })}
            </span>
          </div>
        </>
      )}
      {Object.keys(localLayerSources).filter((name) => !onDiskNames.has(name)).length > 0 && (
        <div className="mt-2 border-t border-sky-200 pt-2">
          <p className="mb-1 text-[11px] font-semibold text-slate-600">
            {say({
              language,
              en: "the local layers, not yet on the disk:",
              fr: "les couches locales, pas encore sur le disque :",
            })}
          </p>
          <div className="flex flex-wrap gap-1">
            {Object.keys(localLayerSources)
              .filter((name) => !onDiskNames.has(name))
              .map((name) => (
                <button
                  key={name}
                  onClick={() => {
                    void putOnDisk(name, localLayerSources[name] ?? "");
                  }}
                  className="rounded border border-emerald-300 bg-white px-1.5 py-0.5 text-[10px] font-mono leading-4 text-emerald-700 hover:border-emerald-500"
                  title={say({
                    language,
                    en: "lay this formalism on the disk — visible to the other visitors",
                    fr: "poser ce formalisme sur le disque — visible des autres visiteurs",
                  })}
                >
                  {name} ⤓
                </button>
              ))}
          </div>
        </div>
      )}
      {message !== null && <p className="mt-2 text-[10px] leading-4 text-slate-500">{message}</p>}
      {loadResult !== null && (
        <div className="mt-2 space-y-1">
          {loadResult.step === "syntaxe" && (
            <div className="rounded-md border border-red-200 bg-red-50 px-2 py-1.5 text-[11px] leading-4 text-red-700">
              <div className="font-semibold">
                {say({
                  language,
                  en: "staging — the syntax refuses the candidate:",
                  fr: "staging — la syntaxe refuse le candidat :",
                })}
              </div>
              {loadResult.errors.map((error, index) => (
                <div key={index} className="font-mono">
                  {error}
                </div>
              ))}
            </div>
          )}
          {loadResult.step === "validation" && (loadResult.verdicts ?? []).length > 0 && (
            <div className="rounded-md border border-amber-200 bg-amber-50 px-2 py-1.5 text-[11px] leading-4 text-amber-800">
              <div className="font-semibold">
                {say({
                  language,
                  en:
                    "staging — " +
                    loadResult.verdicts.length +
                    " verdict(s), the entry is refused:",
                  fr:
                    "staging — " +
                    loadResult.verdicts.length +
                    " verdict(s), l'entrée est refusée :",
                })}
              </div>
              {loadResult.verdicts.map((verdict, index) => (
                <div key={index}>
                  <span className="font-semibold">{labelOf({ code: verdict.kind, language })}</span>
                  {" — " + renderMessage({ message: verdict.fact, language })}
                </div>
              ))}
            </div>
          )}
          {loadResult.ok && (loadResult.newLayerNames ?? []).length > 0 && (
            <div className="rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1.5 text-[11px] leading-4 text-emerald-700">
              {say({
                language,
                en:
                  "staging: 0 verdict — " +
                  loadResult.newLayerNames.length +
                  " layer(s) loaded from the disk: " +
                  loadResult.newLayerNames.join(", "),
                fr:
                  "staging : 0 verdict — " +
                  loadResult.newLayerNames.length +
                  " couche(s) chargée(s) du disque : " +
                  loadResult.newLayerNames.join(", "),
              })}
            </div>
          )}
          {loadResult.ok && (loadResult.newLayerNames ?? []).length === 0 && (
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
