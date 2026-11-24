// Panel ③ (right column) of the workshop: the mechanism — the closure
// by address with the reading statuses, the detail of the selected
// key, its reference resolution, the resolution cascade strip, and
// the fold of the closure calculation. Pure presentation — the state
// lives in the composition root.

import type { Language } from "../../domain/messages.ts";
import { AddressView, type Address } from "../../domain/addresses.ts";
import { say } from "../i18n.ts";
import { KernelValue, StatusPill, TraceEventRow, addressText } from "../valueRendering.tsx";
import { LayerBadge } from "../layerBadge.tsx";
import { CascadeCard } from "../cascadeMap.tsx";
import type { HistoryEntry } from "./workshopKernel.ts";
import type { LayeredDataKernel } from "../../application/corpus.ts";

/** The closure of the current address plus its depth-1 trace events. */
export interface ClosureData {
  closure: Address[];
  events: unknown[];
}

/** The detail of the selected key: value, scan, winner, reference events. */
export interface SelectedKeyDetail {
  value: unknown;
  scan: { source: Address; status: string; raw: unknown }[];
  winner: Address | null;
  referenceEvents: unknown[];
}

export function WorkshopMechanismPanel({
  language,
  kernel,
  currentAddress,
  selectedKey,
  closureData,
  statusBySource,
  winnerIndex,
  selectedKeyDetail,
  onGoto,
  cascade,
  showClosureCalculation,
  onToggleClosure,
}: {
  language: Language;
  kernel: LayeredDataKernel;
  currentAddress: [string, string[]];
  selectedKey: string | null;
  closureData: ClosureData;
  statusBySource: Map<string, string>;
  winnerIndex: number;
  selectedKeyDetail: SelectedKeyDetail | null;
  onGoto: (layerName: string, path: string[], key?: string | null) => void;
  cascade: HistoryEntry[];
  showClosureCalculation: boolean;
  onToggleClosure: () => void;
}) {
  return (
    <section className="space-y-3" role="region" aria-labelledby="panel-mechanism-heading">
      <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-3">
        <h2 id="panel-mechanism-heading" className="mb-1 text-sm font-bold text-slate-800 dark:text-slate-100">
          {say({ language, en: "④ The mechanism" })}
          <span className="ml-1 font-normal text-slate-600 dark:text-slate-400">
            {say({
              language,
              en:
                "the last crank in detail — closure by address, sources in " + "reading order",
            })}
          </span>
        </h2>
        <p className="mb-2 text-[10px] leading-4 text-slate-600 dark:text-slate-400">
          {say({ language, en: "Current address:" })}{" "}
          <span className="font-mono font-semibold text-slate-600 dark:text-slate-400">
            {addressText(currentAddress)}
          </span>
          {selectedKey ? (
            <>
              {say({ language, en: " — key read: " })}
              <span className="font-mono font-semibold text-slate-600 dark:text-slate-400">{selectedKey}</span>
            </>
          ) : (
            say({
              language,
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
                  (index === winnerIndex ? "bg-emerald-50 dark:bg-emerald-950 ring-1 ring-emerald-300 dark:ring-emerald-700" : "")
                }
              >
                <span className="w-5 shrink-0 text-right font-mono text-slate-600 dark:text-slate-400">
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
            <span className="text-slate-500 dark:text-slate-400">
              <span className="font-mono font-semibold text-slate-700 dark:text-slate-200">{selectedKey}</span> =
            </span>
            <KernelValue
              value={selectedKeyDetail ? selectedKeyDetail.value : null}
              language={language}
            />
            {selectedKeyDetail && selectedKeyDetail.value instanceof AddressView && (
              <button type="button"
                className="rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-600 dark:text-slate-400 hover:border-slate-600 dark:hover:border-slate-500"
                onClick={() =>
                  onGoto(
                    (selectedKeyDetail.value as unknown as AddressView).layer,
                    (selectedKeyDetail.value as unknown as AddressView).path,
                  )
                }
              >
                {say({
                  language,
                  en: "→ go to the designated address",
                })}
              </button>
            )}
          </div>
        )}
      </div>

      {selectedKeyDetail && selectedKeyDetail.referenceEvents.length > 0 && (
        <div className="rounded-lg border border-sky-200 dark:border-sky-800 bg-sky-50/50 dark:bg-sky-950/50 p-3">
          <h3 className="mb-1 text-xs font-bold text-sky-800 dark:text-sky-300">
            {say({ language, en: "Reference resolution" })}
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
          {say({ language, en: "⑤ The resolution cascade" })}
          <span className="ml-1 font-normal text-slate-600 dark:text-slate-400">
            {cascade.length +
              " " +
              say({ language, en: "crank" }) +
              (cascade.length > 1 ? "s" : "") +
              " — " +
              say({
                language,
                en: "the story stays visible, the last one speaks",
              })}
          </span>
        </h2>
        {cascade.length > 10 && (
          <p className="mb-1 text-[10px] leading-4 text-slate-600 dark:text-slate-400">
            {"… " +
              say({ language, en: "and " }) +
              (cascade.length - 10) +
              " " +
              say({ language, en: "crank" }) +
              (cascade.length - 10 > 1 ? "s" : "") +
              " " +
              say({
                language,
                en: "before, in the stack — the ④ back button undoes them",
              })}
          </p>
        )}
        <div className="flex gap-2 overflow-x-auto pb-1">
          {cascade.slice(-10).map((step, index) => (
            <CascadeCard
              key={cascade.length - Math.min(cascade.length, 10) + index}
              space={kernel.space}
              target={step}
              language={language}
              isLast={index === Math.min(cascade.length, 10) - 1}
              isSecondToLast={index === Math.min(cascade.length, 10) - 2}
              onOpen={onGoto}
            />
          ))}
        </div>
      </div>

      {/* The calculation folds under the mechanism — opened
          automatically by the click on a key */}
      <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-3">
        <button type="button"
          className="flex w-full items-center justify-between gap-2 text-left text-xs font-bold text-slate-800 dark:text-slate-100"
          onClick={onToggleClosure}
          aria-expanded={showClosureCalculation}
        >
          <span>
            {say({
              language,
              en: "How this closure is calculated",
            })}
          </span>
          <span className="text-slate-600 dark:text-slate-400">{showClosureCalculation ? "▾" : "▸"}</span>
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
  );
}
