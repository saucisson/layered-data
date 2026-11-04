// Layered Data — Main application with routing
// Routes: #landing, #tutorial, #workshop

import React, { useState } from "react";
import { RouterProvider, useRouter } from "./components/Router";
import { LandingPage } from "./pages/LandingPage";
import { TutorialPage } from "./pages/TutorialPage";
import { WorkshopPage } from "./WorkshopContainer";
import { readWorkshopLanguage, writeWorkshopLanguage } from "./infrastructure/browserLanguage";
import type { Language } from "./domain/messages.ts";

function AppContent() {
  const { page } = useRouter();
  const [language, setLanguage] = useState<Language>(() => readWorkshopLanguage());

  const handleChooseLanguage = (next: Language) => {
    setLanguage(next);
    writeWorkshopLanguage({ language: next });
  };

  switch (page) {
    case "tutorial":
      return <TutorialPage language={language} onChooseLanguage={handleChooseLanguage} />;
    case "workshop":
      return <WorkshopPage language={language} onChooseLanguage={handleChooseLanguage} />;
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
