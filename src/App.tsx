// Layered Data — Main application with routing
// Routes: #landing, #tutorial, #filiation, #workshop, #editor
// (the workshop and the editor are ONE page, two tabs — the hash
// picks the tab), #hierarchy, #creation, #formalism/<layer>

import { lazy, Suspense, useState } from "react";
import { RouterProvider, useRouter } from "./components/Router";
import { readWorkshopLanguage, writeWorkshopLanguage } from "./infrastructure/browserLanguage";
import { setI18nLanguage } from "./infrastructure/i18n";
import type { Language } from "./domain/messages";

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
const HierarchyPage = lazy(() =>
  import("./pages/HierarchyPage").then((module) => ({ default: module.HierarchyPage })),
);
const CreationPage = lazy(() =>
  import("./pages/CreationPage").then((module) => ({ default: module.CreationPage })),
);
const FormalismPage = lazy(() =>
  import("./pages/FormalismPage").then((module) => ({ default: module.FormalismPage })),
);
const WorkshopHomePage = lazy(() =>
  import("./pages/WorkshopHomePage").then((module) => ({ default: module.WorkshopHomePage })),
);

// No text on purpose: the fallback must not depend on the i18n catalog
// being loaded yet.
function PageFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center" aria-busy="true">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-300 border-t-gray-700" />
    </div>
  );
}

function AppContent() {
  const { page, parameter } = useRouter();
  const [language, setLanguage] = useState<Language>(() => readWorkshopLanguage());

  const handleChooseLanguage = (next: Language) => {
    setLanguage(next);
    writeWorkshopLanguage({ language: next });
    setI18nLanguage({ language: next });
  };

  return (
    <Suspense fallback={<PageFallback />}>
      {(() => {
        switch (page) {
          case "tutorial":
            return <TutorialPage language={language} onChooseLanguage={handleChooseLanguage} />;
          case "filiation":
            return <FiliationPage language={language} onChooseLanguage={handleChooseLanguage} />;
          case "workshop":
          case "editor":
            return (
              <WorkshopHomePage
                tab={page}
                language={language}
                onChooseLanguage={handleChooseLanguage}
              />
            );
          case "hierarchy":
            return <HierarchyPage language={language} onChooseLanguage={handleChooseLanguage} />;
          case "creation":
            return <CreationPage language={language} onChooseLanguage={handleChooseLanguage} />;
          case "formalism":
            return (
              <FormalismPage
                layer={parameter}
                language={language}
                onChooseLanguage={handleChooseLanguage}
              />
            );
          case "landing":
          default:
            return <LandingPage language={language} onChooseLanguage={handleChooseLanguage} />;
        }
      })()}
    </Suspense>
  );
}

export function App() {
  return (
    <RouterProvider>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded focus:bg-slate-800 focus:px-3 focus:py-2 focus:text-sm focus:text-white"
      >
        Aller au contenu principal / Skip to main content
      </a>
      {/* Live region for screen reader announcements (WCAG 4.1.3) */}
      <div aria-live="polite" aria-atomic="true" className="sr-only" id="sr-announcer" />
      <AppContent />
    </RouterProvider>
  );
}
