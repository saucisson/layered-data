// The assembly-validation fold, rendered inside the "Diagnostics
// & validation" fold of the formalism panel (②): the declared acts
// (refines, extend, override, mask, bind, check) confronted with
// the reality of the closures before any execution. The French
// stats keys (couches, decl, …) are the kernel's observable
// vocabulary — they are shown as-is.

import React from "react";
import type { ValidationOutcome } from "../domain/validation.ts";
import { renderMessage } from "../domain/messages.ts";
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
    <>
      <h3 className="mt-2 text-xs font-bold text-slate-800">
        {say({ language, en: "Assembly validation", fr: "Validation d'assemblage" })}
        <span className="ml-1 font-normal text-slate-400">
          {say({
            language,
            en: "the single source — " + stats.couches + " declared layers, " + stats.decl + " acts",
            fr: "la source unique — " + stats.couches + " couches déclarées, " + stats.decl + " actes",
          })}
        </span>
      </h3>
      <p className="mb-3 mt-1 text-[11px] leading-4 text-slate-500">
        {say({
          language,
          en: "JSON is no longer the pen: the 47 layers are written in the design language, where inheritance (refines), transparency (extend), overloading (override), opacity (mask), bindings (bind) and tags (check) are explicit acts. The assembly validation confronts every declared act with the reality of the closures BEFORE any execution: implicit overload, ghost declaration, unknown tag, binding laid at the wrong level. The first-wins shadows become declared acts; only an undeclared shadow is an error. The silences logged below remain the safety net.",
          fr: "Le JSON n'est plus la plume : les 47 couches sont écrites dans le langage de conception, où héritage (refines), transparence (extend), surcharge (override), opacité (mask), liaisons (bind) et étiquettes (check) sont des actes explicites. La validation d'assemblage confronte chaque acte déclaré à la réalité des fermetures AVANT toute exécution : surcharge implicite, déclaration de fantôme, étiquette inconnue, liaison posée au mauvais niveau. Les ombres du premier-gagné deviennent des actes déclarés ; seule une ombre non déclarée est une erreur. Les silences consignés ci-dessous restent le filet de sécurité.",
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
            fr:
              stats.erreursSyntaxe +
              " erreur" +
              (stats.erreursSyntaxe > 1 ? "s" : "") +
              " de syntaxe — l'analyse s'arrête au premier verdict, l'espace partiel s'affiche.",
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
            fr:
              "Validation d'assemblage : " +
              stats.declOK +
              "/" +
              stats.decl +
              " actes cohérents, " +
              stats.etiquettes +
              " étiquettes au registre, 0 surcharge implicite, 0 liaison morte — l'espace passe.",
          })}
        </p>
      ) : (
        <div className="max-h-40 space-y-0.5 overflow-y-auto">
          {verdicts.slice(0, 40).map((verdict, index) => (
            <div key={index} className="font-mono text-[10px] text-red-700">
              {labelOf({ code: verdict.kind, language })} —{" "}
              {renderMessage({ message: verdict.fact, language })}
            </div>
          ))}
        </div>
      )}
      <div className="mt-2 flex flex-wrap items-baseline gap-x-4 gap-y-1 text-[11px] text-slate-500">
        <span>
          <span className="font-semibold text-slate-700">{stats.nouveau}</span>{" "}
          {say({ language, en: "new", fr: "nouveaux" })}
        </span>
        <span>
          <span className="font-semibold text-slate-700">{stats.extension}</span>{" "}
          {say({
            language,
            en: "extensions (declared transparency)",
            fr: "extensions (transparence déclarée)",
          })}
        </span>
        <span>
          <span className="font-semibold text-slate-700">{stats.surcharge}</span>{" "}
          {say({ language, en: "overrides (declared shadows)", fr: "surcharges (ombres déclarées)" })}
        </span>
        <span>
          <span className="font-semibold text-slate-700">{stats.ombresDeclarées}</span>{" "}
          {say({
            language,
            en: "first-wins overwrites — all declared",
            fr: "premier-gagné qui écrasent — tous déclarés",
          })}
        </span>
        <span>
          <span className="font-semibold text-slate-700">{stats.ombresÉmergentes}</span>{" "}
          {say({
            language,
            en: "emerging from the diamond (to inspect)",
            fr: "émergentes du diamant (à inspecter)",
          })}
        </span>
      </div>
    </>
  );
}
