// Tutorial page

import React from "react";
import { useRouter } from "../components/Router";
import { Tutorial } from "../presentation/tutorial.tsx";
import { say } from "../presentation/i18n.ts";
import type { Language } from "../domain/messages.ts";

interface TutorialPageProps {
  language: Language;
  onChooseLanguage: (lang: Language) => void;
}

export function TutorialPage({ language, onChooseLanguage }: TutorialPageProps) {
  const { navigate } = useRouter();

  const handleNavigate = (layer: string, path: string[]) => {
    // Navigate to workshop - in a full implementation, we would pass params
    navigate("workshop");
  };

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <header className="border-b border-slate-200 bg-white px-5 py-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate("landing")}
              className="rounded-lg border border-slate-300 px-3 py-1 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              {say({ language, en: "← Back", fr: "← Retour" })}
            </button>
            <h1 className="text-lg font-bold">
              {say({
                language,
                en: "Tutorial",
                fr: "Tutoriel",
              })}
            </h1>
          </div>
          <span className="flex shrink-0 items-center gap-1 text-xs">
            <span className="mr-1 text-slate-400">
              {say({ language, en: "language: ", fr: "langue : " })}
            </span>
            {(["en", "fr"] as Language[]).map((choice) => (
              <button
                key={choice}
                onClick={() => onChooseLanguage(choice)}
                className={
                  "rounded border px-1.5 py-0.5 font-bold uppercase " +
                  (language === choice
                    ? "border-slate-800 bg-slate-800 text-white"
                    : "border-slate-300 bg-white text-slate-500 hover:border-slate-500")
                }
              >
                {choice}
              </button>
            ))}
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-4xl p-8">
        <p className="mb-8 text-lg text-slate-600">
          {say({
            language,
            en: "Eleven steps, one running example: the philosophers' dinner. Every section pairs an idea with the real layer that carries it — the excerpt is the artifact, the prose is the guide.",
            fr: "Onze étapes, un exemple suivi : le dîner des philosophes. Chaque section marie une idée à la couche réelle qui la porte — l'extrait est l'artefact, la prose est le guide.",
          })}
        </p>

        <Tutorial onNavigate={handleNavigate} language={language} />

        <div className="mt-12 flex justify-center gap-4">
          <button
            onClick={() => navigate("landing")}
            className="rounded-lg border-2 border-slate-300 px-6 py-3 text-slate-700 font-semibold hover:bg-slate-50 transition-colors"
          >
            {say({ language, en: "← Landing", fr: "← Accueil" })}
          </button>
          <button
            onClick={() => navigate("filiation")}
            className="rounded-lg border-2 border-slate-400 px-6 py-3 text-slate-700 font-semibold hover:bg-slate-50 transition-colors"
          >
            {say({ language, en: "Filiation & comparison →", fr: "Filiation & comparaison →" })}
          </button>
          <button
            onClick={() => navigate("workshop")}
            className="rounded-lg bg-sky-600 px-6 py-3 text-white font-semibold hover:bg-sky-500 transition-colors"
          >
            {say({ language, en: "Workshop →", fr: "Atelier →" })}
          </button>
        </div>
      </main>
    </div>
  );
}
