// The shared site header: brand, global navigation menu (plain text
// links, current page highlighted), language picker and dark-mode
// toggle. Rendered once in App.tsx so every page has the same chrome.

import { SUPPORTED_LANGUAGES } from "../infrastructure/i18n.ts";
import type { Language } from "../domain/messages.ts";
import type { Page } from "./Router.tsx";

interface NavEntry {
  page: Page;
  label: string;
}

const NAV_ENTRIES: readonly NavEntry[] = [
  { page: "landing", label: "Landing" },
  { page: "tutorial", label: "Tutorial" },
  { page: "filiation", label: "Filiation" },
  { page: "hierarchy", label: "Hierarchy" },
  { page: "creation", label: "Creation" },
  { page: "workshop", label: "Workshop" },
];

/** The workshop and the editor are one page, two tabs: both highlight
 * the Workshop entry. */
function isActive(current: Page, entry: Page): boolean {
  if (entry === "workshop") return current === "workshop" || current === "editor";
  return current === entry;
}

interface SiteHeaderProps {
  currentPage: Page;
  language: Language;
  onChooseLanguage: (language: Language) => void;
  dark: boolean;
  onToggleDark: () => void;
}

export function SiteHeader({ currentPage, language, onChooseLanguage, dark, onToggleDark }: SiteHeaderProps) {
  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 shadow-sm backdrop-blur dark:border-slate-700 dark:bg-slate-900/95">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3 sm:px-6">
        <a
          href="#landing"
          className="text-lg font-extrabold tracking-tight text-slate-900 hover:text-emerald-700 dark:text-slate-50 dark:hover:text-emerald-400"
        >
          Layered<span className="text-emerald-600 dark:text-emerald-400">Data</span>
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
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white")
                }
              >
                {entry.label}
              </a>
            );
          })}
        </nav>
        <span className="ml-auto flex shrink-0 items-center gap-2 text-xs">
          {SUPPORTED_LANGUAGES.map((choice) => (
            <button
              type="button"
              key={choice}
              onClick={() => onChooseLanguage(choice)}
              aria-pressed={language === choice}
              className={
                "rounded border px-1.5 py-0.5 font-bold uppercase " +
                (language === choice
                  ? "border-emerald-600 bg-emerald-600 text-white"
                  : "border-slate-300 bg-white text-slate-500 hover:border-slate-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300")
              }
            >
              {choice}
            </button>
          ))}
          <button
            type="button"
            onClick={onToggleDark}
            aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
            title={dark ? "Light mode" : "Dark mode"}
            className="rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
          >
            {dark ? "☀ Light" : "☾ Dark"}
          </button>
        </span>
      </div>
    </header>
  );
}
