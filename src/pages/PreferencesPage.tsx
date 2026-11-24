// The Preferences page (LD-8, ADR-0120 §3): the account menu's single
// place for user settings — the personal Mistral API token, the theme,
// the language, the logo. The token field is password-type, pasteable,
// clearable; the value lives in browser localStorage only — never in a
// URL, never logged, never returned in a response.

import { useState } from "react";
import { hashOf } from "../components/Router";
import { PROSE_WIDTH } from "../components/PageShell";
import { say } from "../presentation/i18n.ts";
import type { Language } from "../domain/messages.ts";
import { SUPPORTED_LANGUAGES } from "../infrastructure/i18n.ts";
import { THEMES, type ThemeId } from "../infrastructure/themes.ts";
import { LOGOS, type LogoId } from "../infrastructure/logos.ts";
import {
  clearMistralToken,
  readMistralToken,
  writeMistralToken,
} from "../infrastructure/mistralToken.ts";

interface PreferencesPageProps {
  language: Language;
  theme: ThemeId;
  onChooseTheme: (theme: ThemeId) => void;
  logo: LogoId;
  onChooseLogo: (logo: LogoId) => void;
  onChooseLanguage: (language: Language) => void;
}

export function PreferencesPage({
  language,
  theme,
  onChooseTheme,
  logo,
  onChooseLogo,
  onChooseLanguage,
}: PreferencesPageProps) {
  const [tokenDraft, setTokenDraft] = useState(() => readMistralToken() ?? "");
  const [tokenSaved, setTokenSaved] = useState(false);

  const saveToken = () => {
    writeMistralToken({ token: tokenDraft.trim() });
    setTokenSaved(true);
  };
  const clearToken = () => {
    clearMistralToken();
    setTokenDraft("");
    setTokenSaved(false);
  };

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100">
      <div className={"mx-auto " + PROSE_WIDTH + " p-4 sm:p-8"}>
        <h1 className="mb-6 text-2xl font-bold text-slate-800 dark:text-slate-100">
          {say({ language, en: "Preferences", fr: "Préférences" })}
        </h1>

        <section className="mb-6 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 sm:p-6 shadow-sm">
          <h2 className="mb-2 text-lg font-semibold text-slate-800 dark:text-slate-100">
            {say({ language, en: "Mistral API token", fr: "Token d'API Mistral" })}
          </h2>
          <p className="mb-3 text-sm text-slate-600 dark:text-slate-400">
            {say({
              language,
              en: "Personal token used by the plume (the AI geologist) on generation calls only. Stored in this browser alone — never in a URL, never logged, never sent back by the server. Without it, the plume stays visible but disabled.",
              fr: "Token personnel utilisé par la plume (le géologue IA) sur les seuls appels de génération. Stocké dans ce navigateur uniquement — jamais dans une URL, jamais logué, jamais renvoyé par le serveur. Sans lui, la plume reste visible mais désactivée.",
            })}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="password"
              value={tokenDraft}
              onChange={(event) => {
                setTokenDraft(event.target.value);
                setTokenSaved(false);
              }}
              placeholder={say({ language, en: "paste your Mistral API token", fr: "collez votre token d'API Mistral" })}
              aria-label={say({ language, en: "Mistral API token", fr: "Token d'API Mistral" })}
              autoComplete="off"
              className="min-w-64 flex-1 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-2 py-1 text-xs font-mono"
            />
            <button
              type="button"
              onClick={saveToken}
              className="rounded bg-slate-800 dark:bg-slate-600 px-2 py-1 text-xs font-semibold text-white hover:bg-slate-700 dark:hover:bg-slate-500"
            >
              {say({ language, en: "Save", fr: "Enregistrer" })}
            </button>
            <button
              type="button"
              onClick={clearToken}
              disabled={tokenDraft === ""}
              className="rounded border border-slate-300 dark:border-slate-600 px-2 py-1 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50"
            >
              {say({ language, en: "Clear", fr: "Effacer" })}
            </button>
          </div>
          {tokenSaved && readMistralToken() !== null && (
            <p className="mt-2 text-[11px] text-emerald-700 dark:text-emerald-400">
              {say({ language, en: "token saved in this browser", fr: "token enregistré dans ce navigateur" })}
            </p>
          )}
        </section>

        <section className="mb-6 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 sm:p-6 shadow-sm">
          <h2 className="mb-2 text-lg font-semibold text-slate-800 dark:text-slate-100">
            {say({ language, en: "Appearance", fr: "Apparence" })}
          </h2>
          <div className="flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
              {say({ language, en: "Theme", fr: "Thème" })}
              <select
                value={theme}
                onChange={(event) => onChooseTheme(event.target.value as ThemeId)}
                aria-label={say({ language, en: "theme", fr: "thème" })}
                className="rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-1.5 py-1 text-xs"
              >
                {THEMES.map((choice) => (
                  <option key={choice.id} value={choice.id}>
                    {choice.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
              {say({ language, en: "Logo", fr: "Logo" })}
              <select
                value={logo}
                onChange={(event) => onChooseLogo(event.target.value as LogoId)}
                aria-label={say({ language, en: "logo", fr: "logo" })}
                className="rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-1.5 py-1 text-xs"
              >
                {LOGOS.map((choice) => (
                  <option key={choice.id} value={choice.id}>
                    {choice.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
              {say({ language, en: "Language", fr: "Langue" })}
              <select
                value={language}
                onChange={(event) => onChooseLanguage(event.target.value as Language)}
                aria-label={say({ language, en: "language", fr: "langue" })}
                className="rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-1.5 py-1 text-xs uppercase"
              >
                {SUPPORTED_LANGUAGES.map((choice) => (
                  <option key={choice} value={choice}>
                    {choice}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </section>

        <a
          href={hashOf("landing")}
          className="text-sm font-semibold text-sky-700 hover:underline dark:text-sky-400"
        >
          {say({ language, en: "Back to home", fr: "Retour à l'accueil" })}
        </a>
      </div>
    </div>
  );
}
