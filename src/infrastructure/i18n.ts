// i18next initialization: loads the translation catalogs extracted by
// i18next-parser (public/locales/<locale>/translation.json). English is
// the default; the browser language or the stored workshop language
// picks French when available.
import i18next from "i18next";

import enTranslation from "../../public/locales/en/translation.json";
import frTranslation from "../../public/locales/fr/translation.json";
import { DEFAULT_LANGUAGE, type Language } from "../domain/messages.ts";

export const SUPPORTED_LANGUAGES: readonly Language[] = ["en", "fr"];

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
      fr: { translation: frTranslation },
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
