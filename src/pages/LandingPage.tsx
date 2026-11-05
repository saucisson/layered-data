// Landing page for Layered Data

import React from "react";
import { useRouter } from "../components/Router";
import { say } from "../presentation/i18n.ts";
import type { Language } from "../domain/messages.ts";

interface LandingPageProps {
  language: Language;
  onChooseLanguage: (lang: Language) => void;
}

export function LandingPage({ language, onChooseLanguage }: LandingPageProps) {
  const { navigate } = useRouter();

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <header className="border-b border-slate-200 bg-white px-5 py-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h1 className="text-lg font-bold">
            {say({
              language,
              en: "Layered Data — Formalism Design Workshop",
              fr: "Layered Data — Atelier de conception des formalismes",
            })}
          </h1>
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
        <section className="text-center">
          <h2 className="mb-4 text-3xl font-bold text-slate-800">
            {say({
              language,
              en: "Data in Strata",
              fr: "Les données en strates",
            })}
          </h2>
          <p className="mx-auto max-w-2xl text-lg text-slate-600">
            {say({
              language,
              en: "A demonstrator where formalisms and models are layered data. Refinement, inheritance, and first-winner reading create a powerful system.",
              fr: "Un démonstrateur où formalismes et modèles sont des couches de données. Raffinement, héritage et lecture premier-gagné créent un système puissant.",
            })}
          </p>
        </section>

        <section className="mt-12 grid gap-6 md:grid-cols-3">
          <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="mb-3 text-lg font-semibold text-slate-800">
              {say({ language, en: "Layered Definitions", fr: "Définitions en couches" })}
            </h3>
            <p className="text-sm text-slate-600">
              {say({
                language,
                en: "Each layer refines its parent. The kernel contains 47 layers from basic records to the philosophers' dinner.",
                fr: "Chaque couche raffine sa parente. Le noyau contient 47 couches, des enregistrements de base au dîner des philosophes.",
              })}
            </p>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="mb-3 text-lg font-semibold text-slate-800">
              {say({ language, en: "First-Winner Reading", fr: "Lecture premier-gagné" })}
            </h3>
            <p className="text-sm text-slate-600">
              {say({
                language,
                en: "Reading an address walks the refinement chain and returns the first value found.",
                fr: "La lecture d'une adresse parcourt la chaîne de raffinement et retourne la première valeur trouvée.",
              })}
            </p>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="mb-3 text-lg font-semibold text-slate-800">
              {say({ language, en: "Measured Workspace", fr: "Atelier mesuré" })}
            </h3>
            <p className="text-sm text-slate-600">
              {say({
                language,
                en: "Every action is measured. The kernel is proven byte-by-byte identical to its Python reference.",
                fr: "Chaque action est mesurée. Le noyau est prouvé identique octet par octet à sa référence Python.",
              })}
            </p>
          </div>
        </section>

        <section className="mt-12 flex justify-center gap-4">
          <button
            onClick={() => navigate("tutorial")}
            className="rounded-lg bg-sky-600 px-6 py-3 text-white font-semibold hover:bg-sky-500 transition-colors"
          >
            {say({ language, en: "Tutorial →", fr: "Tutoriel →" })}
          </button>
          <button
            onClick={() => navigate("workshop")}
            className="rounded-lg border-2 border-sky-600 px-6 py-3 text-sky-600 font-semibold hover:bg-sky-50 transition-colors"
          >
            {say({ language, en: "Workshop →", fr: "Atelier →" })}
          </button>
        </section>

        <footer className="mt-16 pt-6 border-t border-slate-200 text-center text-xs text-slate-400">
          {say({
            language,
            en: "Layered Data — A formalism design workshop where definitions are data",
            fr: "Layered Data — Un atelier de conception des formalismes où les définitions sont des données",
          })}
        </footer>
      </main>
    </div>
  );
}
