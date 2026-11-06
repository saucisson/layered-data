// Layered Data — Main application with routing
// Routes: #landing, #tutorial, #filiation, #workshop,
// #hierarchy, #creation, #formalism/<layer>

import React, { useState } from "react";
import { RouterProvider, useRouter } from "./components/Router";
import { LandingPage } from "./pages/LandingPage";
import { TutorialPage } from "./pages/TutorialPage";
import { FiliationPage } from "./pages/FiliationPage";
import { WorkshopPage } from "./WorkshopContainer";
import { HierarchyPage } from "./pages/HierarchyPage";
import { CreationPage } from "./pages/CreationPage";
import { FormalismPage } from "./pages/FormalismPage";
import { readWorkshopLanguage, writeWorkshopLanguage } from "./infrastructure/browserLanguage";
import type { Language } from "./domain/messages";

function AppContent() {
  const { page, parameter } = useRouter();
  const [language, setLanguage] = useState<Language>(() => readWorkshopLanguage());

  const handleChooseLanguage = (next: Language) => {
    setLanguage(next);
    writeWorkshopLanguage({ language: next });
  };

  switch (page) {
    case "tutorial":
      return <TutorialPage language={language} onChooseLanguage={handleChooseLanguage} />;
    case "filiation":
      return <FiliationPage language={language} onChooseLanguage={handleChooseLanguage} />;
    case "workshop":
      return <WorkshopPage language={language} onChooseLanguage={handleChooseLanguage} />;
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
}

export default function App() {
  return (
    <RouterProvider>
      <AppContent />
    </RouterProvider>
  );
}
