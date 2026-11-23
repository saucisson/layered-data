// Layered Data — Main application with routing
// Routes: #landing, #tutorial, #filiation, #formalisms, #lenses,
// #models, #hierarchy, #creation, #formalism/<layer> — the formalisms
// and the graphical editor are two top-level pages (issue #216).

import { lazy, Suspense, useEffect, useState } from "react";
import { RouterProvider, useRouter, type Page } from "./components/Router";
import { SiteHeader } from "./components/SiteHeader";
import { ToastProvider } from "./components/Toast";
import { readWorkshopLanguage, writeWorkshopLanguage } from "./infrastructure/browserLanguage";
import {
  THEME_STORAGE_KEY,
  applyTheme,
  defaultTheme,
  readStoredTheme,
  type ThemeId,
} from "./infrastructure/themes";
import { LOGO_STORAGE_KEY, readStoredLogo, type LogoId } from "./infrastructure/logos";
import { setI18nLanguage } from "./infrastructure/i18n";
import type { Language } from "./domain/messages";

/** The theme (issue #233): follows the system preference by default,
 *  can be changed from the header picker. The choice is persisted in
 *  localStorage and applied as classes on <html>. */
function useTheme() {
  const [theme, setTheme] = useState<ThemeId>(() => readStoredTheme() ?? defaultTheme());

  useEffect(() => {
    applyTheme({ id: theme });
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme]);

  return { theme, chooseTheme: setTheme };
}

/** The logo variant (issue #234): persisted in localStorage. */
function useLogo() {
  const [logo, setLogo] = useState<LogoId>(() => readStoredLogo());

  useEffect(() => {
    localStorage.setItem(LOGO_STORAGE_KEY, logo);
  }, [logo]);

  return { logo, chooseLogo: setLogo };
}

// Every page is lazy: the initial bundle carries only the router and
// the shell, each route loads its own chunk on demand (issue #90).
const LandingPage = lazy(() =>
  import("./pages/LandingPage").then((module) => ({ default: module.LandingPage })),
);
const TutorialPage = lazy(() =>
  import("./pages/TutorialPage").then((module) => ({ default: module.TutorialPage })),
);
const FiliationPage = lazy(() =>
  import("./pages/FiliationPage").then((module) => ({ default: module.FiliationPage })),
);
const LensesPage = lazy(() =>
  import("./pages/LensesPage").then((module) => ({ default: module.LensesPage })),
);
const InstallPage = lazy(() =>
  import("./pages/InstallPage").then((module) => ({ default: module.InstallPage })),
);
const HierarchyPage = lazy(() =>
  import("./pages/HierarchyPage").then((module) => ({ default: module.HierarchyPage })),
);
const CreationPage = lazy(() =>
  import("./pages/CreationPage").then((module) => ({ default: module.CreationPage })),
);
const FormalismPage = lazy(() =>
  import("./pages/FormalismPage").then((module) => ({ default: module.FormalismPage })),
);
const WorkshopPage = lazy(() =>
  import("./WorkshopContainer").then((module) => ({ default: module.WorkshopPage })),
);
const ModelEditorPage = lazy(() =>
  import("./presentation/modelEditorPage").then((module) => ({ default: module.ModelEditorPage })),
);
const NotFoundPage = lazy(() =>
  import("./pages/NotFoundPage").then((module) => ({ default: module.NotFoundPage })),
);
const WorkshopLockedPage = lazy(() =>
  import("./pages/WorkshopLockedPage").then((module) => ({ default: module.WorkshopLockedPage })),
);

/** The Atelier-zone pages (ADR-0120 §2): they require a session. */
const WORKSHOP_PAGES: readonly Page[] = ["formalisms", "models", "hierarchy", "creation", "formalism"];

// No text on purpose: the fallback must not depend on the i18n catalog
// being loaded yet.
function PageFallback() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-8" aria-busy="true" aria-label="Loading">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-300 border-t-gray-700 dark:border-slate-600 dark:border-t-slate-300" />
      <div className="w-64 space-y-2" aria-hidden="true">
        <div className="h-3 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
        <div className="h-3 w-2/3 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
      </div>
    </div>
  );
}

function AppContent() {
  const { page, parameter } = useRouter();
  const [language, setLanguage] = useState<Language>(() => readWorkshopLanguage());
  const { theme, chooseTheme } = useTheme();
  const { logo, chooseLogo } = useLogo();

  const handleChooseLanguage = (next: Language) => {
    setLanguage(next);
    writeWorkshopLanguage({ language: next });
    setI18nLanguage({ language: next });
  };
  // the document language follows the active one (#305)
  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  // A workshop API call answered 401 problem+json session_required
  // (ADR-0120 §2): the Atelier zone shows its sign-in page (LD-9).
  const [sessionRequired, setSessionRequired] = useState(false);
  useEffect(() => {
    const onSessionRequired = () => setSessionRequired(true);
    // signing in (header menu or locked page) unlocks the workshop at once
    const onAccessVerified = () => setSessionRequired(false);
    window.addEventListener("ld:session-required", onSessionRequired);
    window.addEventListener("ld:access-verified", onAccessVerified);
    return () => {
      window.removeEventListener("ld:session-required", onSessionRequired);
      window.removeEventListener("ld:access-verified", onAccessVerified);
    };
  }, []);
  useEffect(() => {
    if (!WORKSHOP_PAGES.includes(page)) setSessionRequired(false);
  }, [page]);
  const workshopLocked = sessionRequired && WORKSHOP_PAGES.includes(page);

  return (
    <Suspense fallback={<PageFallback />}>
      <SiteHeader
        currentPage={page}
        language={language}
        onChooseLanguage={handleChooseLanguage}
        theme={theme}
        onChooseTheme={chooseTheme}
        logo={logo}
        onChooseLogo={chooseLogo}
      />
      <main id="main-content">
      {workshopLocked ? (
        <WorkshopLockedPage language={language} />
      ) : (() => {
        switch (page) {
          case "tutorial":
            return <TutorialPage language={language} />;
          case "filiation":
            return <FiliationPage language={language} />;
          case "formalisms":
            return <WorkshopPage language={language} />;
          case "lenses":
            return <LensesPage language={language} />;
          case "install":
            return <InstallPage language={language} />;
          case "models":
            return <ModelEditorPage language={language} />;
          case "hierarchy":
            return <HierarchyPage language={language} />;
          case "creation":
            return <CreationPage language={language} />;
          case "formalism":
            return (
              <FormalismPage
                layer={parameter}
                language={language}
              />
            );
          case "landing":
            return <LandingPage language={language} />;
          case "notfound":
            return <NotFoundPage language={language} />;
          default:
            return <LandingPage language={language} />;
        }
      })()}
      </main>
    </Suspense>
  );
}

export function App() {
  return (
    <RouterProvider>
      <ToastProvider>
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded focus:bg-slate-800 focus:px-3 focus:py-2 focus:text-sm focus:text-white"
        >
          Aller au contenu principal / Skip to main content
        </a>
        {/* Live region for screen reader announcements (WCAG 4.1.3) */}
        <div aria-live="polite" aria-atomic="true" className="sr-only" id="sr-announcer" />
        <AppContent />
      </ToastProvider>
    </RouterProvider>
  );
}
