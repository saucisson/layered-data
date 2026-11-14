// The stratigraphy of a formalism (issue #154, ADR-0116): the strata
// of its closure — one row per (formalism, pinned major), what each
// refines, its lifecycle status — then the diamond conflicts
// displayed as two paths, then the one-click re-pin suggestions that
// the observational-inertness certification unlocks. Every string
// goes through i18next.

import { useMemo } from "react";
import { asLayerName } from "../domain/identifiers.ts";
import type { Space } from "../domain/space.ts";
import type { FormalismStatus } from "../domain/formalism.ts";
import type { Language } from "../domain/messages.ts";
import {
  conflictsOf,
  repinSuggestions,
  strataOf,
} from "../application/stratigraphy.ts";
import { StatusBadge } from "./statusBadge.tsx";
import { say } from "./i18n.ts";

/** The stratigraphy view: strata, diamond conflicts, re-pin
 * suggestions. `statusOf` maps a layer name to its lifecycle status
 * (the bedrock is published, a session layer is a draft);
 * `canRepin` tells whether the focused layer is re-pinnable (a
 * session layer — the bedrock is read-only). */
export function StratigraphyView({
  space,
  layer,
  language,
  statusOf,
  canRepin,
  onRepin,
}: {
  space: Space;
  layer: string;
  language: Language;
  statusOf: (layerName: string) => FormalismStatus;
  canRepin: boolean;
  onRepin: (args: { formalism: string; targetMajor: number }) => void;
}) {
  const layerName = asLayerName(layer);
  const strata = useMemo(() => strataOf({ space, layer: layerName }), [space, layerName]);
  const conflicts = useMemo(() => conflictsOf({ space, layer: layerName }), [space, layerName]);
  const suggestions = useMemo(
    () => repinSuggestions({ space, layer: layerName }),
    [space, layerName],
  );
  return (
    <div className="space-y-3">
      {/* The strata: one row per (formalism, pinned major) of the
          closure, with what each refines and its status. */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left text-[11px] leading-4">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-700 text-slate-500">
              <th className="py-1 pr-3 font-semibold">
                {say({ language, en: "stratum" })}
              </th>
              <th className="py-1 pr-3 font-semibold">
                {say({ language, en: "pinned major" })}
              </th>
              <th className="py-1 pr-3 font-semibold">
                {say({ language, en: "refines" })}
              </th>
              <th className="py-1 font-semibold">
                {say({ language, en: "status" })}
              </th>
            </tr>
          </thead>
          <tbody>
            {strata.map((stratum) => (
              <tr
                key={stratum.name + "@" + String(stratum.major)}
                className="border-b border-slate-100 dark:border-slate-700/50"
              >
                <td className="py-1 pr-3 font-mono">{stratum.name}</td>
                <td className="py-1 pr-3 font-mono text-slate-600">
                  {stratum.major === null
                    ? say({ language, en: "latest (bare name)" })
                    : "@" + String(stratum.major)}
                </td>
                <td className="py-1 pr-3 font-mono text-slate-600">
                  {stratum.refines.length === 0
                    ? "∅"
                    : stratum.refines
                        .map((refinement) =>
                          refinement.major === null
                            ? "@" + refinement.name
                            : "@" + refinement.name + "@" + String(refinement.major),
                        )
                        .join(", ")}
                </td>
                <td className="py-1">
                  <StatusBadge status={statusOf(stratum.name)} language={language} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* The diamond conflicts, each displayed as its paths. */}
      {conflicts.length > 0 && (
        <div className="rounded-md border border-rose-200 bg-rose-50 p-2 dark:border-rose-900 dark:bg-rose-950/40">
          <p className="mb-1 text-[11px] font-semibold text-rose-700 dark:text-rose-300">
            {say({
              language,
              en:
                "version conflicts — one major per formalism per closure (ADR-0116 rule 3):",
            })}
          </p>
          {conflicts.map((conflict) => (
            <div key={conflict.formalism} className="mb-1 text-[11px] leading-4">
              <span className="font-mono font-semibold">{conflict.formalism}</span>
              {" "}
              <span className="text-slate-600">
                {say({ language, en: "pinned to divergent majors" }) +
                  " " +
                  conflict.majors.map((major) => "@" + String(major)).join(", ")}
              </span>
              <ul className="ml-3 mt-0.5 space-y-0.5 font-mono text-[10px] text-slate-600">
                {conflict.paths.map((path, pathIndex) => (
                  <li key={pathIndex}>{path.join(" → ")}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      {/* The one-click re-pin suggestions, certified observationally
          inert by the measured dump. */}
      {suggestions.length > 0 && (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 p-2 dark:border-emerald-900 dark:bg-emerald-950/40">
          <p className="mb-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">
            {say({
              language,
              en: "re-pin suggestions — certified observationally inert (the measured dump is unchanged):",
            })}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {suggestions.map((suggestion) => (
              <button
                key={suggestion.formalism + "@" + String(suggestion.targetMajor)}
                type="button"
                disabled={!canRepin}
                onClick={() =>
                  onRepin({
                    formalism: suggestion.formalism,
                    targetMajor: suggestion.targetMajor,
                  })
                }
                title={
                  canRepin
                    ? say({
                        language,
                        en: "re-pin every reference to this formalism to the certified major",
                      })
                    : say({
                        language,
                        en: "the bedrock is read-only — fork into a session layer to re-pin",
                      })
                }
                className={
                  "rounded-full border px-2 py-0.5 font-mono text-[10px] " +
                  (canRepin
                    ? "border-emerald-600 bg-white dark:bg-slate-800 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900"
                    : "cursor-not-allowed border-slate-300 dark:border-slate-600 text-slate-400 opacity-60")
                }
              >
                {"re-pin @" +
                  suggestion.formalism +
                  " → @" +
                  String(suggestion.targetMajor)}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
