// The diagnostics fold of the formalism panel (②): one pass at
// mount, over the memo — the diagnostics channel of the kernel
// gathers the notes of the kernel itself and those of the lints;
// the verdict count cites the assembly validation. The counter
// reads folded, the detail opens on click.

import { useMemo, useState } from "react";
import type { LayerName } from "../domain/identifiers.ts";
import type { Address } from "../domain/addresses.ts";
import type { Space } from "../domain/space.ts";
import type { ValidationOutcome } from "../domain/validation.ts";
import type { CompiledLanguage } from "../domain/language/compiler.ts";
import type { Diagnostic } from "../domain/space.ts";
import { renderMessage, type Language } from "../domain/messages.ts";
import { runAllLints } from "../application/linting.ts";
import { ValidationPanel } from "./validationPanel.tsx";
import { say, type BilingualText } from "./i18n.ts";

/** One diagnostic kind as shown in the fold: label, tone, and the
 * note that says what the silence means. The keys are the kernel's
 * observable kind strings. */
const DIAGNOSTIC_LABELS: Record<string, { label: BilingualText; tone: string; note: BilingualText }> = {
  "refines-inversés": {
    label: { en: "inverted refines", fr: "refines inversés" },
    tone: "border-red-200 bg-red-50 text-red-700",
    note: {
      en: "the generic precedes the specific: structural error, before any behavior",
      fr: "le générique précède le spécifique : erreur structurelle, avant tout comportement",
    },
  },
  "garde-de-cycle": {
    label: { en: "cycle guard", fr: "garde de cycle" },
    tone: "border-red-200 bg-red-50 text-red-700",
    note: {
      en: "truncated closure: order-dependent read",
      fr: "fermeture tronquée : lecture dépendante de l'ordre",
    },
  },
  "check-vacant": {
    label: { en: "vacant check", fr: "check vacant" },
    tone: "border-red-200 bg-red-50 text-red-700",
    note: {
      en: "bounds read, never verified (or unbound check slots)",
      fr: "bornes lues, jamais vérifiées (ou slots de check non liés)",
    },
  },
  "étiquette-inconnue": {
    label: { en: "unknown tag", fr: "étiquette inconnue" },
    tone: "border-amber-200 bg-amber-50 text-amber-700",
    note: {
      en: "a wanted check that does not exist is a vacant check",
      fr: "un check voulu qui n'existe pas est un check vacant",
    },
  },
  "entrée-ignorée": {
    label: { en: "ignored entry", fr: "entrée ignorée" },
    tone: "border-amber-200 bg-amber-50 text-amber-700",
    note: {
      en: "a wanted refinement can disappear without a trace: every silence is listed",
      fr: "un raffinement voulu peut disparaître sans trace : chaque silence est listé",
    },
  },
  "ombre-émergente": {
    label: { en: "emerging shadow", fr: "ombre émergente" },
    tone: "border-slate-200 bg-slate-50 text-slate-600",
    note: {
      en: "language — the diamond decides: nobody declared the shadow, the closure order decides — to inspect",
      fr: "langage — le diamant tranche : personne n'a déclaré l'ombre, l'ordre de fermeture décide — à inspecter",
    },
  },
  ombre: {
    label: { en: "shadow", fr: "ombre" },
    tone: "border-slate-200 bg-slate-50 text-slate-600",
    note: {
      en: "inventory: first-wins decided; to inspect, not a fault",
      fr: "inventaire : le premier-gagné a tranché ; à inspecter, pas une faute",
    },
  },
  "conflit-d'ordre": {
    label: { en: "order conflict", fr: "conflit d'ordre" },
    tone: "border-amber-200 bg-amber-50 text-amber-700",
    note: {
      en: "first-wins decided between incomparable sources: the refines order, a convention — to inspect, or to restructure (ADR-0106)",
      fr: "le premier-gagné a tranché entre sources incomparables : l'ordre des refines, une convention — à inspecter, ou à restructurer (ADR-0106)",
    },
  },
};

/** The diagnostics fold: kernel silences and assembly validation in
 * one place. The lint pass runs once at mount. */
export function DiagnosticsPanel({
  space,
  layerNames,
  compilation,
  validation,
  language,
}: {
  space: Space;
  layerNames: readonly LayerName[];
  compilation: CompiledLanguage;
  validation: ValidationOutcome;
  language: Language;
}) {
  const [open, setOpen] = useState(false);
  const events = useMemo(
    () => runAllLints({ space, layerNames, compilation }),
    // One pass at mount: the fold reads a snapshot of the channel.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  const byKind = useMemo(() => {
    const groups = new Map<string, { kind: string; address: Address; fact: Diagnostic["fact"] }[]>();
    for (const event of events) {
      if (!groups.has(event.kind)) groups.set(event.kind, []);
      groups.get(event.kind)!.push(event);
    }
    return groups;
  }, [events]);
  // Severity is a reading policy, not an accident: structural
  // errors first, then suspicious silences, then inventories.
  const kindOrder = [
    "refines-inversés",
    "garde-de-cycle",
    "check-vacant",
    "étiquette-inconnue",
    "conflit-d'ordre",
    "entrée-ignorée",
    "ombre-émergente",
    "ombre",
  ];
  const verdicts = validation.verdicts;
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <button
        className="flex w-full items-center justify-between gap-2 text-left text-sm font-bold text-slate-800"
        onClick={() => setOpen(!open)}
      >
        <span>
          {say({ language, en: "Diagnostics & validation", fr: "Diagnostics & validation" })}
          <span className="ml-1 font-normal text-slate-400">
            {verdicts.length}{" "}
            {say({
              language,
              en: verdicts.length > 1 ? "blocking verdicts" : "blocking verdict",
              fr: "verdict" + (verdicts.length > 1 ? "s" : "") + " bloquant" + (verdicts.length > 1 ? "s" : ""),
            })}{" "}
            {"· "}
            {events.length}{" "}
            {say({
              language,
              en: events.length > 1 ? "logged silences" : "logged silence",
              fr: "silence" + (events.length > 1 ? "s" : "") + " consigné" + (events.length > 1 ? "s" : ""),
            })}
          </span>
        </span>
        <span className="shrink-0 text-slate-400">{open ? "▾" : "▸"}</span>
      </button>
      {open && (
        <>
          <ValidationPanel validation={validation} language={language} />
          <p className="mb-1 mt-2 text-[11px] leading-4 text-slate-500">
            {say({
              language,
              en: "The kernel stays total — never an exception — but everything it ignores is logged: ignored entries, cycle guards, unknown tags, vacant checks, first-wins shadows, specificity inversions detected by the closure. The generic checks read no hard-coded name: their slots are bound by the layers (bindings). The kernel logs, it does not judge — the severity is yours.",
              fr: "Le noyau reste total — jamais d'exception — mais tout ce qu'il ignore est consigné : entrées ignorées, gardes de cycle, étiquettes inconnues, checks vacants, ombres du premier-gagné, inversions de spécificité détectées par la fermeture. Les checks génériques ne lisent aucun nom en dur : leurs slots sont liés par les couches (bindings). Le noyau consigne, il ne juge pas — la sévérité est à vous.",
            })}
          </p>
      {events.length === 0 && (
        <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
          {say({
            language,
            en: "Space sweep: 0 logged silence — verified, nothing to list.",
            fr: "Balayage de l'espace : 0 silence consigné — vérifié, rien à lister.",
          })}
        </p>
      )}
      <div className="space-y-2">
        {kindOrder
          .filter((kind) => byKind.has(kind))
          .map((kind) => {
            const kindEvents = byKind.get(kind)!;
            const meta = DIAGNOSTIC_LABELS[kind];
            if (meta === undefined) return null;
            return (
              <div key={kind} className="rounded-md border border-slate-200 p-2">
                <div className="flex flex-wrap items-baseline gap-2">
                  <span
                    className={
                      "rounded border px-1.5 py-0.5 text-[11px] font-semibold " + meta.tone
                    }
                  >
                    {say({ language, en: meta.label.en, fr: meta.label.fr })}
                  </span>
                  <span className="text-[11px] text-slate-400">
                    {say({ language, en: meta.note.en, fr: meta.note.fr })}
                  </span>
                  <span className="ml-auto font-mono text-[11px] text-slate-400">
                    {kindEvents.length}
                  </span>
                </div>
                <div className="mt-1 max-h-40 space-y-0.5 overflow-y-auto">
                  {kindEvents.slice(0, 40).map((event, index) => (
                    <div
                      key={index}
                      className="font-mono text-[10px] leading-4 text-slate-600"
                    >
                      <span className="text-slate-400">
                        {event.address[0]}::{event.address[1].join("/") || "."}
                      </span>{" "}
                      {renderMessage({ message: event.fact, language })}
                    </div>
                  ))}
                  {kindEvents.length > 40 && (
                    <div className="text-[10px] text-slate-400">
                      {say({
                        language,
                        en: "… and " + (kindEvents.length - 40) + " more",
                        fr: "… et " + (kindEvents.length - 40) + " autres",
                      })}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        {[...byKind.keys()]
          .filter((kind) => !kindOrder.includes(kind))
          .map((kind) => (
            <div key={kind} className="font-mono text-[10px] text-slate-400">
              {kind} × {byKind.get(kind)!.length}
            </div>
          ))}
        </div>
        </>
      )}
    </div>
  );
}
