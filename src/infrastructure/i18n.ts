// i18next initialization: loads the translation catalogs extracted by
// i18next-parser (public/locales/<locale>/translation.json). English is
// the only catalog for now (ADR-0113); i18next falls back to English
// for any other language, so a French catalog can return as pure
// content without any code change.
import i18next from "i18next";

import enTranslation from "../../public/locales/en/translation.json" with { type: "json" };
import { DEFAULT_LANGUAGE, type Language } from "../domain/messages.ts";

export const SUPPORTED_LANGUAGES: readonly Language[] = ["en"];

let initialized = false;

export function initI18n({ language = DEFAULT_LANGUAGE }: { language?: Language } = {}): void {
  if (initialized) {
    void i18next.changeLanguage(language);
    return;
  }
  initialized = true;
  void i18next.init({
    lng: language,
    fallbackLng: DEFAULT_LANGUAGE,
    resources: {
      en: { translation: enTranslation },
    },
    interpolation: { escapeValue: false },
    returnEmptyString: false,
  });
}

/** Translate a key with named parameters. The key is the English source
 * string (readable inline in .ld files); missing keys render as the key. */
export function t(key: string, params?: Record<string, string | number>): string {
  return params === undefined ? i18next.t(key) : i18next.t(key, params);
}

/** Switch the active language at runtime (the workshop language picker). */
export function setI18nLanguage({ language }: { language: Language }): void {
  void i18next.changeLanguage(language);
}
