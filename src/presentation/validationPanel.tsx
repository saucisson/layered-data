// The assembly-validation fold, rendered inside the "Diagnostics
// & validation" fold of the formalism panel (②): the declared acts
// (refines, extend, override, bind, check) confronted with
// the reality of the closures before any execution. The French
// stats keys (couches, decl, …) are the kernel's observable
// vocabulary — they are shown as-is.

import type { ValidationOutcome } from "../domain/validation.ts";
import { renderMessage } from "../domain/messages.ts";
import { VirtualList } from "./virtualList.tsx";
import { labelOf, say } from "./i18n.ts";
import type { Language } from "../domain/messages.ts";

/** The assembly-validation summary: verdicts block the assembly,
 * stats explain what was declared. */
export function ValidationPanel({
  validation,
  language,
}: {
  validation: ValidationOutcome;
  language: Language;
}) {
  const stats = validation.stats;
  const verdicts = validation.verdicts;
  return (
    <div aria-live="polite" aria-atomic="false" role="status">
      <h3 className="mt-2 text-xs font-bold text-slate-800 dark:text-slate-100">
        {say({ language, en: "Assembly validation"})}
        <span className="ml-1 font-normal text-slate-600">
          {say({
            language,
            en:
              "the single source — " + stats.couches + " declared layers, " + stats.decl + " acts",
          })}
        </span>
      </h3>
      <p className="mb-3 mt-1 text-[11px] leading-4 text-slate-500">
        {say({
          language,
          en: "JSON is no longer the writing tool: the 85 layers are written in the design language, where inheritance (refines), transparency (extend), overloading (override), bindings (bind) and tags (check) are explicit acts. The assembly validation confronts every declared act with the reality of the closures BEFORE any execution: implicit overload, ghost declaration, unknown tag, binding laid at the wrong level. The first-wins shadows become declared acts; only an undeclared shadow is an error. The silences logged below remain the safety net.",
        })}
      </p>
      {stats.erreursSyntaxe > 0 && (
        <p className="mb-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {say({
            language,
            en:
              stats.erreursSyntaxe +
              (stats.erreursSyntaxe > 1 ? " syntax errors" : " syntax error") +
              " — the analysis stops at the first verdict, the partial space displays.",
          })}
        </p>
      )}
      {verdicts.length === 0 ? (
        <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
          {say({
            language,
            en:
              "Assembly validation: " +
              stats.declOK +
              "/" +
              stats.decl +
              " consistent acts, " +
              stats.etiquettes +
              " tags at the registry, 0 implicit overload, 0 dead binding — the space passes.",
          })}
        </p>
      ) : (
        <VirtualList
          items={verdicts}
          estimateSize={16}
          maxHeightClass="max-h-40"
          keyOf={(_verdict, index) => index}
          renderItem={(verdict) => (
            <div className="font-mono text-[10px] text-red-700">
              {labelOf({ code: verdict.kind, language })} —{" "}
              {renderMessage({ message: verdict.fact, language })}
            </div>
          )}
        />
      )}
      <div className="mt-2 flex flex-wrap items-baseline gap-x-4 gap-y-1 text-[11px] text-slate-500">
        <span>
          <span className="font-semibold text-slate-700 dark:text-slate-200">{stats.nouveau}</span>{" "}
          {say({ language, en: "new"})}
        </span>
        <span>
          <span className="font-semibold text-slate-700 dark:text-slate-200">{stats.extension}</span>{" "}
          {say({
            language,
            en: "extensions (declared transparency)",
          })}
        </span>
        <span>
          <span className="font-semibold text-slate-700 dark:text-slate-200">{stats.surcharge}</span>{" "}
          {say({
            language,
            en: "overrides (declared shadows)",
          })}
        </span>
        <span>
          <span className="font-semibold text-slate-700 dark:text-slate-200">{stats.ombresDeclarées}</span>{" "}
          {say({
            language,
            en: "first-wins overwrites — all declared",
          })}
        </span>
        <span>
          <span className="font-semibold text-slate-700 dark:text-slate-200">{stats.ombresÉmergentes}</span>{" "}
          {say({
            language,
            en: "emerging from the diamond (to inspect)",
          })}
        </span>
      </div>
    </div>
  );
}
