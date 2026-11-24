// The shared site header — common web contract (LD-9, ADR-0120 §4).
// From left to right: (1) logo + site name (the logo picker stays in
// Preferences), (2) the three zones Accueil / Découvrir / Atelier,
// (3) the FR/EN language picker, (4) the persistent light/dark theme
// toggle (classes on <html>, default = system preference),
// (5) the account menu (« Se connecter », or « Préférences » +
// « Se déconnecter » once signed in). Rendered once in App.tsx so every
// page has the same chrome. Monochrome SVG pictograms only, no emoji.

import { useEffect, useRef, useState } from "react";
import { SUPPORTED_LANGUAGES } from "../infrastructure/i18n.ts";
import { themeDefinition, type ThemeId } from "../infrastructure/themes.ts";
import type { LogoId } from "../infrastructure/logos.ts";
import { apiFetch } from "../infrastructure/wardrobeClient.ts";
import { Logo } from "./Logo.tsx";
import type { Language } from "../domain/messages.ts";
import { hashOf, type Page } from "./Router.tsx";
import { AuthPanel } from "../presentation/authPanel.tsx";
import { say } from "../presentation/i18n.ts";

type ZoneId = "home" | "discover" | "workshop";

interface ZoneEntry {
  id: ZoneId;
  pages: readonly Page[];
  label: { en: string; fr: string };
}

/** The three zones of the common contract. Discover is public
 *  read-only, the workshop requires a session (LD-7 routes the pages,
 *  the header only presents the zones). */
const ZONES: readonly ZoneEntry[] = [
  { id: "home", pages: ["landing"], label: { en: "Home", fr: "Accueil" } },
  {
    id: "discover",
    pages: ["tutorial", "filiation", "lenses", "install"],
    label: { en: "Discover", fr: "Découvrir" },
  },
  {
    id: "workshop",
    pages: ["formalisms", "models", "hierarchy", "creation", "formalism"],
    label: { en: "Workshop", fr: "Atelier" },
  },
];

const ZONE_PAGES: readonly { page: Page; label: { en: string; fr: string } }[] = [
  { page: "tutorial", label: { en: "Tutorial", fr: "Tutoriel" } },
  { page: "filiation", label: { en: "Filiation", fr: "Filiation" } },
  { page: "lenses", label: { en: "Lenses", fr: "Lentilles" } },
  { page: "install", label: { en: "Install", fr: "Installation" } },
  { page: "formalisms", label: { en: "Formalisms", fr: "Formalismes" } },
  { page: "models", label: { en: "Models", fr: "Modèles" } },
  { page: "hierarchy", label: { en: "Hierarchy", fr: "Hiérarchie" } },
  { page: "creation", label: { en: "Creation", fr: "Création" } },
];

function zoneOf({ page }: { page: Page }): ZoneId | null {
  for (const zone of ZONES) {
    if (zone.pages.includes(page)) return zone.id;
  }
  // an unknown route (notfound) highlights no zone
  return null;
}

interface SiteHeaderProps {
  currentPage: Page;
  language: Language;
  onChooseLanguage: (language: Language) => void;
  theme: ThemeId;
  onChooseTheme: (theme: ThemeId) => void;
  logo: LogoId;
}

/** Monochrome sun pictogram (shown in dark mode: click for light). */
function SunIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    >
      <circle cx="12" cy="12" r="4" fill="currentColor" stroke="none" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </svg>
  );
}

/** Monochrome moon pictogram (shown in light mode: click for dark). */
function MoonIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true" fill="currentColor">
      <path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8Z" />
    </svg>
  );
}

export function SiteHeader({
  currentPage,
  language,
  onChooseLanguage,
  theme,
  onChooseTheme,
  logo,
}: SiteHeaderProps) {
  // one popover at a time: a zone menu or the account menu — the
  // settings themselves live on the #preferences page (LD-8)
  const [openPopover, setOpenPopover] = useState<ZoneId | "account" | null>(null);
  const [signedIn, setSignedIn] = useState(false);
  // The session is probed on mount, so the account menu shows its
  // signed-in state right after a reload.
  useEffect(() => {
    let cancelled = false;
    void apiFetch({ endpoint: "auth/me" })
      .then((response) => {
        if (!cancelled && response.ok) setSignedIn(true);
      })
      .catch(() => {
        // unreachable proxy: the sign-in form says why when opened
      });
    return () => {
      cancelled = true;
    };
  }, []);
  const popoverRef = useRef<HTMLDivElement>(null);
  // An open popover closes on outside click or Escape.
  useEffect(() => {
    if (openPopover === null) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!popoverRef.current?.contains(event.target as Node)) setOpenPopover(null);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpenPopover(null);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [openPopover]);

  const currentZone = zoneOf({ page: currentPage });
  const darkBased = themeDefinition({ id: theme }).dark;

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 shadow-sm backdrop-blur dark:border-slate-700 dark:bg-slate-900/95">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3 sm:px-6" ref={popoverRef}>
        <a
          href="#landing"
          className="text-lg font-extrabold tracking-tight text-slate-900 hover:text-emerald-700 dark:text-slate-50 dark:hover:text-emerald-400"
        >
          <Logo variant={logo} />
        </a>
        <nav aria-label="Main navigation" className="flex flex-wrap items-center gap-1 text-sm">
          {ZONES.map((zone) => {
            const active = currentZone === zone.id;
            const label = say({ language, en: zone.label.en, fr: zone.label.fr });
            const zonePages = ZONE_PAGES.filter((entry) => zone.pages.includes(entry.page));
            // Home is a plain link; the other zones open their page list.
            if (zone.pages.length === 1) {
              return (
                <a
                  key={zone.id}
                  href="#landing"
                  aria-current={active ? "page" : undefined}
                  className={
                    "rounded-full px-3 py-1 font-medium transition-colors " +
                    (active
                      ? "bg-slate-800 text-white shadow-sm dark:bg-emerald-400 dark:text-slate-900"
                      : "text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white")
                  }
                >
                  {label}
                </a>
              );
            }
            return (
              <span key={zone.id} className="relative">
                <button
                  type="button"
                  onClick={() => setOpenPopover(openPopover === zone.id ? null : zone.id)}
                  aria-expanded={openPopover === zone.id}
                  aria-current={active ? "page" : undefined}
                  className={
                    "rounded-full px-3 py-1 font-medium transition-colors " +
                    (active
                      ? "bg-slate-800 text-white shadow-sm dark:bg-emerald-400 dark:text-slate-900"
                      : "text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white")
                  }
                >
                  {label}
                </button>
                {openPopover === zone.id && (
                  <span className="absolute left-0 top-full z-50 mt-2 flex w-44 flex-col gap-1 rounded-md border border-slate-200 bg-white p-2 shadow-lg dark:border-slate-700 dark:bg-slate-800">
                    {zonePages.map((entry) => (
                      <a
                        key={entry.page}
                        href={"#" + entry.page}
                        onClick={() => setOpenPopover(null)}
                        aria-current={
                          currentPage === entry.page || (currentPage === "formalism" && entry.page === "formalisms")
                            ? "page"
                            : undefined
                        }
                        className="rounded px-2 py-1 text-left text-sm text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700"
                      >
                        {say({ language, en: entry.label.en, fr: entry.label.fr })}
                      </a>
                    ))}
                  </span>
                )}
              </span>
            );
          })}
        </nav>
        <span className="ml-auto flex shrink-0 items-center gap-2 text-xs">
          {SUPPORTED_LANGUAGES.length > 1
            ? SUPPORTED_LANGUAGES.map((choice) => (
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
            : // one language only: no picker, but a French browser is told
              // the French catalog is on its way (#305)
              language !== SUPPORTED_LANGUAGES[0] && (
                <span className="text-[10px] text-slate-500 dark:text-slate-400">
                  {say({ language, en: "French coming back" })}
                </span>
              )}
          {/* The light/dark theme toggle (issue #233): persisted in
              localStorage and applied as classes on <html>; the full
              theme picker stays in Preferences. */}
          <button
            type="button"
            onClick={() => onChooseTheme(darkBased ? "light" : "dark")}
            aria-label={say({
              language,
              en: darkBased ? "switch to light theme" : "switch to dark theme",
              fr: darkBased ? "passer en thème clair" : "passer en thème sombre",
            })}
            title={say({
              language,
              en: darkBased ? "switch to light theme" : "switch to dark theme",
              fr: darkBased ? "passer en thème clair" : "passer en thème sombre",
            })}
            className="rounded border border-slate-300 bg-white px-2 py-1 text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
          >
            {darkBased ? <SunIcon /> : <MoonIcon />}
          </button>
          {/* The account menu: sign in when anonymous, preferences and
              sign out once the session is verified. */}
          <span className="relative">
            <button
              type="button"
              onClick={() => setOpenPopover(openPopover === "account" ? null : "account")}
              aria-expanded={openPopover === "account"}
              aria-label={say({ language, en: "account menu", fr: "menu compte" })}
              title={say({ language, en: "account menu", fr: "menu compte" })}
              className="rounded border border-slate-300 bg-white px-2 py-1 font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
            >
              {say({ language, en: signedIn ? "account" : "sign in", fr: signedIn ? "compte" : "se connecter" })}
            </button>
            {openPopover === "account" && (
              <span className="absolute right-0 top-full z-50 mt-2 block w-80 shadow-lg">
                <span className="flex flex-col gap-2 rounded-md border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-800">
                  <AuthPanel
                    language={language}
                    onChanged={() => {
                      setSignedIn(true);
                      window.dispatchEvent(new CustomEvent("ld:access-verified"));
                    }}
                  />
                  <a
                    href={hashOf("preferences")}
                    onClick={() => setOpenPopover(null)}
                    className="rounded border border-slate-300 bg-white px-2 py-1 text-left text-sm font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600"
                  >
                    {say({ language, en: "Preferences", fr: "Préférences" })}
                  </a>
                </span>
              </span>
            )}
          </span>
        </span>
      </div>
    </header>
  );
}
