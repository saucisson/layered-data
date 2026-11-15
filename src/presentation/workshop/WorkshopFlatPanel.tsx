// Panel ③ (left column) of the workshop: the flattened data at the
// current address — the address strip (back, layer, path segments,
// copy) and the visible keys with their first-wins winner. Pure
// presentation — the state lives in the composition root.

import type { Language } from "../../domain/messages.ts";
import { AddressView } from "../../domain/addresses.ts";
import { say } from "../i18n.ts";
import { KernelValue } from "../valueRendering.tsx";
import { LayerBadge } from "../layerBadge.tsx";

/** One visible key of the current address, with its winner. */
export interface AddressKeyInfo {
  key: string;
  value: unknown;
  winner: readonly [string, readonly string[]] | null;
  scan: unknown[];
}

export function WorkshopFlatPanel({
  language,
  layer,
  path,
  onResetPath,
  onSegmentClick,
  historyLength,
  onBack,
  copied,
  onCopyAddress,
  shownKeys,
  addressKeysCount,
  search,
  selectedKey,
  onSelectKey,
  onGotoAddress,
  onShowClosure,
}: {
  language: Language;
  layer: string;
  path: string[];
  onResetPath: () => void;
  onSegmentClick: (index: number) => void;
  historyLength: number;
  onBack: () => void;
  copied: boolean;
  onCopyAddress: () => void;
  shownKeys: AddressKeyInfo[];
  addressKeysCount: number;
  search: string;
  selectedKey: string | null;
  onSelectKey: (key: string | null) => void;
  onGotoAddress: (layerName: string, path: string[]) => void;
  onShowClosure: () => void;
}) {
  return (
    <section className="space-y-3" role="region" aria-labelledby="panel-flat-heading">
      <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-3">
        <h2 id="panel-flat-heading" className="mb-2 text-sm font-bold text-slate-800 dark:text-slate-100">
          {say({ language, en: "③ The flattened data" })}
          <span className="ml-1 font-normal text-slate-600 dark:text-slate-400">
            {say({ language, en: "reading at an address" })}
          </span>
        </h2>
        <div className="flex flex-wrap items-center gap-1 text-xs">
          <button type="button"
            onClick={onBack}
            disabled={historyLength === 0}
            title={
              historyLength
                ? say({
                    language,
                    en: "back to the previous address (" + historyLength + " in the stack)",
                  })
                : say({
                    language,
                    en: "nothing to undo — no address visited",
                  })
            }
            aria-label={say({ language, en: "previous address" })}
            className={
              "rounded px-1.5 py-0.5 font-bold " +
              (historyLength
                ? "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-600"
                : "text-slate-500 dark:text-slate-400")
            }
          >
            ←
          </button>
          <LayerBadge layer={layer} />
          <span className="text-slate-600 dark:text-slate-400">::</span>
          <button type="button" className="text-slate-600 dark:text-slate-400 hover:text-slate-600 dark:hover:text-slate-300" onClick={onResetPath} aria-label={say({ language, en: "reset path" })}>
            ()
          </button>
          {path.map((segment, index) => (
            <span key={index} className="flex items-center gap-1">
              <span className="text-slate-500 dark:text-slate-400">/</span>
              <button type="button"
                className="font-mono font-medium text-slate-700 dark:text-slate-200 hover:underline"
                onClick={() => onSegmentClick(index)}
              >
                {segment}
              </button>
            </span>
          ))}
          <button type="button"
            onClick={onCopyAddress}
            title={say({
              language,
              en:
                "copy the address (layer :: path :: key) — " +
                "the workshop's shareable artifact",
            })}
            aria-label={say({ language, en: "copy the address" })}
            className={
              "ml-auto rounded px-1.5 py-0.5 text-[10px] " +
              (copied
                ? "bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300"
                : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-600")
            }
          >
            {copied
              ? say({ language, en: "address copied ✓" })
              : say({ language, en: "copy ⧉" })}
          </button>
        </div>

        <div className="mt-3 divide-y divide-slate-100 dark:divide-slate-700">
          {shownKeys.length === 0 && (
            <div className="py-2 text-xs text-slate-600 dark:text-slate-400">
              {addressKeysCount === 0
                ? say({
                    language,
                    en: "No visible key at this address (declaration node).",
                  })
                : say({
                    language,
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
                  (active ? "rounded-md bg-sky-50 dark:bg-sky-950 px-1 ring-1 ring-sky-200 dark:ring-sky-800" : "")
                }
              >
                <button type="button"
                  className="min-w-24 text-left font-mono font-semibold text-slate-800 dark:text-slate-100 hover:underline"
                  onClick={() => {
                    onSelectKey(active ? null : info.key);
                    if (!active) onShowClosure();
                  }}
                >
                  {info.key}
                </button>
                {info.winner ? (
                  <LayerBadge layer={info.winner[0]} small />
                ) : (
                  <span className="text-[10px] text-slate-600 dark:text-slate-400">
                    {say({ language, en: "no value" })}
                  </span>
                )}
                <span className="truncate">
                  <KernelValue value={info.value} language={language} />
                </span>
                {isNode && (
                  <button type="button"
                    className="ml-auto shrink-0 rounded border border-slate-300 dark:border-slate-600 px-1.5 py-0.5 text-[10px] text-slate-500 hover:border-slate-600 dark:hover:border-slate-500 hover:text-slate-800 dark:hover:text-slate-200 dark:text-slate-100"
                    onClick={() =>
                      onGotoAddress(
                        (info.value as unknown as AddressView).layer,
                        (info.value as unknown as AddressView).path,
                      )
                    }
                  >
                    {say({ language, en: "→ go there" })}
                  </button>
                )}
              </div>
            );
          })}
        </div>
        <p className="mt-2 text-[10px] leading-4 text-slate-600 dark:text-slate-400">
          {say({
            language,
            en:
              "Each line: the key, the layer providing the value " +
              "(first-wins), the value. A node is traversed (« → go there »); " +
              "a resolved reference is recognized by its designated address.",
          })}
        </p>
      </div>
    </section>
  );
}
