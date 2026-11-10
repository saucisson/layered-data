// The presentation tongue: every panel speaks the workshop language
// through these three helpers. `say` picks between two inline texts,
// `localized` renders a bilingual entry, `labelOf` renders the kernel
// vocabulary — the codes the domain keeps stable. No React context:
// the language travels by props, explicit from App to every leaf.

import { kernelLabel, parseText, type Language } from "../domain/messages.ts";

/** A text written in both workshop languages. */
export type BilingualText = { en: string; fr: string };

/** Pick one of two inline texts. */
export function say({ language, en, fr }: { language: Language; en: string; fr: string }): string {
  return parseText({ language, en, fr });
}

/** Render a bilingual entry. */
export function localized({ language, text }: { language: Language; text: BilingualText }): string {
  return language === "fr" ? text.fr : text.en;
}

/** Render a kernel code — a status, a kind, a step. */
export function labelOf({ code, language }: { code: string; language: Language }): string {
  return kernelLabel({ code, language });
}

/** The edition guards, as the panels announce them: an edition
 * edits, it never renames a layer nor adds one alongside. */
export const EDITION_REFUSAL_LABEL: Record<string, BilingualText> = {
  "couche-renomme": {
    en: "the edition renames the layer — an edition edits, it never renames",
    fr: "l'édition renomme la couche — une édition édite, elle ne renomme jamais",
  },
  "couche-glissée": {
    en: "the edition carries a layer besides — an edition is not an addition",
    fr: "l'édition glisse une couche en plus — une édition n'est pas un ajout",
  },
  "socle-édité": {
    en: "the edition aims at the bedrock — the bedrock is read-only, its layers never re-enter the staging (ADR-0103)",
    fr: "l'édition vise le socle — le socle est en lecture seule, ses couches ne repassent jamais au staging (ADR-0103)",
  },
};

/** Render an edition refusal code — unknown codes render as
 * themselves. */
export function editionRefusalLabel({
  code,
  language,
}: {
  code: string;
  language: Language;
}): string {
  const entry = EDITION_REFUSAL_LABEL[code];
  if (entry === undefined) return code;
  return localized({ language, text: entry });
}

/** Parity check for the harnesses: a bilingual entry carries two
 * non-empty texts, and they differ — a translation nobody wrote is
 * a missing translation. */
export function bilingualParityOf(entry: BilingualText): boolean {
  return (
    typeof entry.en === "string" &&
    typeof entry.fr === "string" &&
    entry.en.length > 0 &&
    entry.fr.length > 0 &&
    entry.en !== entry.fr
  );
}
