// The shared site header: brand, global navigation menu (plain text
// links, current page highlighted), language picker, dark-mode
// toggle and the site access-code lock (issue #222: the code is asked
// from one click here, not on each page). Rendered once in App.tsx so
// every page has the same chrome.

import { useEffect, useRef, useState } from "react";
import { SUPPORTED_LANGUAGES } from "../infrastructure/i18n.ts";
import { THEMES, type ThemeId } from "../infrastructure/themes.ts";
import { LOGOS, type LogoId } from "../infrastructure/logos.ts";
import { apiFetch, readAccessCode } from "../infrastructure/wardrobeClient.ts";
import { Logo } from "./Logo.tsx";
import type { Language } from "../domain/messages.ts";
import type { Page } from "./Router.tsx";
import { AccessCodeForm } from "../presentation/accessForm.tsx";
import { say } from "../presentation/i18n.ts";

interface NavEntry {
  page: Page;
  label: string;
}

const NAV_ENTRIES: readonly NavEntry[] = [
  { page: "landing", label: "Home" },
  { page: "tutorial", label: "Tutorial" },
  { page: "filiation", label: "Filiation" },
  { page: "hierarchy", label: "Hierarchy" },
  { page: "creation", label: "Creation" },
  { page: "formalisms", label: "Formalisms" },
  { page: "models", label: "Models" },
  { page: "lenses", label: "Lenses" },
  { page: "install", label: "Install" },
];

/** Each top-level page highlights exactly its own entry. */
function isActive(current: Page, entry: Page): boolean {
  if (current === entry) return true;
  // a detail page highlights its parent section (#310)
  if (current === "formalism") return entry === "formalisms";
  return false;
}

interface SiteHeaderProps {
  currentPage: Page;
  language: Language;
  onChooseLanguage: (language: Language) => void;
  theme: ThemeId;
  onChooseTheme: (theme: ThemeId) => void;
  logo: LogoId;
  onChooseLogo: (logo: LogoId) => void;
}

export function SiteHeader({ currentPage, language, onChooseLanguage, theme, onChooseTheme, logo, onChooseLogo }: SiteHeaderProps) {
  // The access-code lock lives here (issue #222): one click opens the
  // form; once verified the form hides itself and the button shows it.
  const [accessOpen, setAccessOpen] = useState(false);
  const [accessVerified, setAccessVerified] = useState(false);
  // A remembered code is re-verified on mount, so the lock shows its
  // verified state right after a reload (#306).
  useEffect(() => {
    if (readAccessCode().trim() === "") return;
    let cancelled = false;
    void apiFetch({ endpoint: "api/whoami" })
      .then((response) => {
        if (!cancelled && response.ok) setAccessVerified(true);
      })
      .catch(() => {
        // unreachable proxy: the form says why when opened
      });
    return () => {
      cancelled = true;
    };
  }, []);
  const accessPopoverRef = useRef<HTMLSpanElement>(null);
  // An open popover closes on outside click or Escape.
  useEffect(() => {
    if (!accessOpen) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!accessPopoverRef.current?.contains(event.target as Node)) setAccessOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setAccessOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [accessOpen]);
  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 shadow-sm backdrop-blur dark:border-slate-700 dark:bg-slate-900/95">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3 sm:px-6">
        <a
          href="#landing"
          className="text-lg font-extrabold tracking-tight text-slate-900 hover:text-emerald-700 dark:text-slate-50 dark:hover:text-emerald-400"
        >
          <Logo variant={logo} />
        </a>
        <nav aria-label="Main navigation" className="flex flex-wrap items-center gap-1 text-sm">
          {NAV_ENTRIES.map((entry) => {
            const active = isActive(currentPage, entry.page);
            return (
              <a
                key={entry.page}
                href={"#" + entry.page}
                aria-current={active ? "page" : undefined}
                className={
                  "rounded-full px-3 py-1 font-medium transition-colors " +
                  (active
                    ? "bg-slate-800 text-white shadow-sm dark:bg-emerald-400 dark:text-slate-900"
                    : "text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white")
                }
              >
                {entry.label}
              </a>
            );
          })}
        </nav>
        <span className="ml-auto flex shrink-0 items-center gap-2 text-xs">
          <span className="relative" ref={accessPopoverRef}>
            <button
              type="button"
              onClick={() => setAccessOpen(!accessOpen)}
              aria-expanded={accessOpen}
              aria-label={say({
                language,
                en: accessVerified ? "site access code — verified" : "site access code",
              })}
              title={say({
                language,
                en: accessVerified ? "site access code — verified" : "site access code",
              })}
              className={
                "rounded border px-2 py-1 font-semibold " +
                (accessVerified
                  ? "border-emerald-600 bg-emerald-600 text-white dark:bg-emerald-700"
                  : "border-slate-300 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700")
              }
            >
              {"🔑"}
            </button>
            {accessOpen && (
              <span className="absolute right-0 top-full z-50 mt-2 block w-80 shadow-lg">
                <AccessCodeForm
                  language={language}
                  onVerified={() => setAccessVerified(true)}
                />
                {accessVerified && (
                  <p className="px-3 pb-2 text-[10px] text-slate-500 dark:text-slate-400">
                    {say({ language, en: "code verified — the quarry and the AI geologist are open" })}
                  </p>
                )}
              </span>
            )}
          </span>
          {SUPPORTED_LANGUAGES.length > 1 ? (
            SUPPORTED_LANGUAGES.map((choice) => (
              <button
                type="button"
                key={choice}
                onClick={() => onChooseLanguage(choice)}
                aria-pressed={language === choice}
                className={
                  "rounded border px-1.5 py-0.5 font-bold uppercase " +
                  (language === choice
                    ? "border-emerald-600 bg-emerald-600 dark:bg-emerald-700 text-white"
                    : "border-slate-300 bg-white text-slate-500 hover:border-slate-500 dark:hover:border-slate-400 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300")
                }
              >
                {choice}
              </button>
            ))
          ) : (
            // one language only: no picker, but a French browser is told
            // the French catalog is on its way (#305)
            language !== SUPPORTED_LANGUAGES[0] && (
              <span className="text-[10px] text-slate-500 dark:text-slate-400">
                {say({ language, en: "French coming back" })}
              </span>
            )
          )}
          {/* The logo picker (issue #234): persisted in localStorage. */}
          <select
            value={logo}
            onChange={(event) => onChooseLogo(event.target.value as LogoId)}
            aria-label={say({ language, en: "logo" })}
            title={say({ language, en: "logo" })}
            className="rounded border border-slate-300 bg-white px-1.5 py-1 text-xs text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
          >
            {LOGOS.map((choice) => (
              <option key={choice.id} value={choice.id}>
                {choice.label}
              </option>
            ))}
          </select>
          {/* The theme picker (issue #233): the choice is persisted in
              localStorage and applied as classes on <html>. */}
          <select
            value={theme}
            onChange={(event) => onChooseTheme(event.target.value as ThemeId)}
            aria-label={say({ language, en: "theme" })}
            title={say({ language, en: "theme" })}
            className="rounded border border-slate-300 bg-white px-1.5 py-1 text-xs text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
          >
            {THEMES.map((choice) => (
              <option key={choice.id} value={choice.id}>
                {choice.label}
              </option>
            ))}
          </select>
        </span>
      </div>
    </header>
  );
}
