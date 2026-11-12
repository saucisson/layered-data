// The presentation tongue: every panel speaks the workshop language
// through these three helpers. `say` picks between two inline texts,
// `localized` renders a bilingual entry, `labelOf` renders the kernel
// vocabulary — the codes the domain keeps stable. No React context:
// the language travels by props, explicit from App to every leaf.

import { kernelLabel, parseText, type Language } from "../domain/messages.ts";

/** A text in the workshop's tongue: English always, French as
 * optional content (ADR-0113). */
export type BilingualText = { en: string; fr?: string | undefined };

/** Pick one of two inline texts — English falls back when no French
 * text is present. */
export function say({
  language,
  en,
  fr,
}: {
  language: Language;
  en: string;
  fr?: string | undefined;
}): string {
  return parseText({ language, en, fr });
}

/** Render a bilingual entry — English falls back when no French text
 * is present. */
export function localized({ language, text }: { language: Language; text: BilingualText }): string {
  return language === "fr" && text.fr !== undefined ? text.fr : text.en;
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
  },
  "couche-glissée": {
    en: "the edition carries a layer besides — an edition is not an addition",
  },
  "socle-édité": {
    en: "the edition aims at the bedrock — the bedrock is read-only, its layers never re-enter the staging (ADR-0103)",
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

/** Parity check for the harnesses: a bilingual entry carries a
 * non-empty English text, and — when a French text is present — a
 * non-empty one that differs. English-only entries are accepted
 * (ADR-0113); an empty English text is not. */
export function bilingualParityOf(entry: BilingualText): boolean {
  if (typeof entry.en !== "string" || entry.en.length === 0) return false;
  if (entry.fr === undefined) return true;
  return typeof entry.fr === "string" && entry.fr.length > 0 && entry.en !== entry.fr;
}
