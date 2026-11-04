// The workshop language, as the browser remembers it: detected on
// first visit, chosen in the header, kept from one visit to the
// next under a stable localStorage key. Pure infrastructure — no
// React, no globals, total on every failure (a locked-down storage
// or an absent navigator falls back to the default language).

import { DEFAULT_LANGUAGE, type Language } from "../domain/messages.ts";

/** The localStorage key of the workshop language choice. */
const WORKSHOP_LANGUAGE_KEY = "langue-atelier";

/** The language the browser announces, or the workshop default when
 * it says nothing the workshop understands. */
export function detectBrowserLanguage(): Language {
  try {
    const announced = navigator.language?.toLowerCase() ?? "";
    if (announced.startsWith("fr")) return "fr";
    if (announced.startsWith("en")) return "en";
  } catch {
    // a navigatorless host (a test, a worker) keeps the default
  }
  return DEFAULT_LANGUAGE;
}

/** The workshop language, read at mount: the remembered choice if
 * there is one, else the browser's announcement. */
export function readWorkshopLanguage(): Language {
  try {
    const stored = localStorage.getItem(WORKSHOP_LANGUAGE_KEY);
    if (stored === "fr" || stored === "en") return stored;
  } catch {
    // an unreadable storage falls back to detection
  }
  return detectBrowserLanguage();
}

/** Remember the visitor's choice for the next visit. */
export function writeWorkshopLanguage({ language }: { language: Language }): void {
  try {
    localStorage.setItem(WORKSHOP_LANGUAGE_KEY, language);
  } catch {
    // an unwritable storage is ignored — the choice lives on in the
    // running session alone
  }
}
