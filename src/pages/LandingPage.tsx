// Landing page for Layered Data

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
    <div className="min-h-screen bg-slate-100 dark:bg-slate-800 text-slate-900">
      <header className="border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-5 py-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h1 className="text-lg font-bold">
            {say({
              language,
              en: "Layered Data — Formalism Design Workshop",
              fr: "Layered Data — Atelier de conception des formalismes",
            })}
          </h1>
          <span className="flex shrink-0 items-center gap-1 text-xs">
            <span className="mr-1 text-slate-600">
              {say({ language, en: "language: ", fr: "langue : " })}
            </span>
            {(["en", "fr"] as Language[]).map((choice) => (
              <button type="button"
                key={choice}
                onClick={() => onChooseLanguage(choice)}
                className={
                  "rounded border px-1.5 py-0.5 font-bold uppercase " +
                  (language === choice
                    ? "border-slate-800 bg-slate-800 text-white"
                    : "border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-500 hover:border-slate-500")
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
          <h2 className="mb-4 text-3xl font-bold text-slate-800 dark:text-slate-100">
            {say({
              language,
              en: "Data in Strata",
              fr: "Les données en strates",
            })}
          </h2>
          <p className="mx-auto max-w-2xl text-lg text-slate-600">
            {say({
              language,
              en: "A demonstrator where formalisms and models are layered data. Refinement, inheritance: the first definition wins, and the system becomes powerful.",
              fr: "Un démonstrateur où formalismes et modèles sont des couches de données. Raffinement, héritage : la première définition l'emporte, le système devient puissant.",
            })}
          </p>
        </section>

        <section className="mt-12 grid gap-6 md:grid-cols-3">
          <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6 shadow-sm">
            <h3 className="mb-3 text-lg font-semibold text-slate-800 dark:text-slate-100">
              {say({ language, en: "Incremental Definitions", fr: "Définitions incrémentales" })}
            </h3>
            <p className="text-sm text-slate-600">
              {say({
                language,
                en: "Definition is incremental: each notion is a small, finely composable layer that refines its parent — 47 layers, from basic records to the philosophers' dinner.",
                fr: "La définition est incrémentale : chaque notion est une petite couche, finement composable, qui raffine sa parente — 47 couches, des enregistrements de base au dîner des philosophes.",
              })}
            </p>
          </div>

          <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6 shadow-sm">
            <h3 className="mb-3 text-lg font-semibold text-slate-800 dark:text-slate-100">
              {say({ language, en: "First-Wins Reading", fr: "La première définition l'emporte" })}
            </h3>
            <p className="text-sm text-slate-600">
              {say({
                language,
                en: "Reading an address walks the refinement chain and returns the first value found.",
                fr: "La lecture d'une adresse parcourt la chaîne de raffinement et retourne la première valeur trouvée.",
              })}
            </p>
          </div>

          <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6 shadow-sm">
            <h3 className="mb-3 text-lg font-semibold text-slate-800 dark:text-slate-100">
              {say({
                language,
                en: "One Model, Several Formalisms",
                fr: "Un modèle, plusieurs formalismes",
              })}
            </h3>
            <p className="text-sm text-slate-600">
              {say({
                language,
                en: "See the same model through different formalisms: the data does not move, the lens changes — the philosophers' dinner draws as a generic graph or as a Petri net.",
                fr: "Visualisez un même modèle à travers plusieurs formalismes : la donnée ne bouge pas, la lentille change — le dîner des philosophes se dessine en graphe générique ou en réseau de Petri.",
              })}
            </p>
          </div>
        </section>

        <section className="mt-12 grid gap-6 md:grid-cols-3">
          <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6 shadow-sm">
            <h3 className="mb-3 text-lg font-semibold text-slate-800 dark:text-slate-100">
              {say({ language, en: "Visualize the Hierarchy", fr: "Visualisez la hiérarchie" })}
            </h3>
            <p className="text-sm text-slate-600">
              {say({
                language,
                en: "The complete refinement graph of the corpus. Click a layer to understand it.",
                fr: "Le graphe de raffinement complet du corpus. Cliquez sur une couche pour la comprendre.",
              })}
            </p>
            <button type="button"
              onClick={() => navigate("hierarchy")}
              className="mt-4 rounded-lg border-2 border-slate-400 px-4 py-2 text-sm text-slate-700 dark:text-slate-200 font-semibold hover:bg-slate-50 dark:bg-slate-900 transition-colors"
            >
              {say({ language, en: "Visualize the hierarchy →", fr: "Visualisez la hiérarchie →" })}
            </button>
          </div>

          <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6 shadow-sm">
            <h3 className="mb-3 text-lg font-semibold text-slate-800 dark:text-slate-100">
              {say({ language, en: "Create a Formalism", fr: "Créez un formalisme" })}
            </h3>
            <p className="text-sm text-slate-600">
              {say({
                language,
                en: "Say the intention; the workshop's AI geologist proposes a draft in the language; the staging judges it; the accepted layer enters the living session.",
                fr: "Dites l'intention ; le géologue IA de l'atelier propose un brouillon en langage ; le staging le juge ; la couche acceptée entre dans la session vivante.",
              })}
            </p>
            <button type="button"
              onClick={() => navigate("creation")}
              className="mt-4 rounded-lg border-2 border-emerald-500 px-4 py-2 text-sm text-emerald-600 font-semibold hover:bg-emerald-50 transition-colors"
            >
              {say({ language, en: "Create a formalism →", fr: "Créez un formalisme →" })}
            </button>
          </div>

          <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6 shadow-sm">
            <h3 className="mb-3 text-lg font-semibold text-slate-800 dark:text-slate-100">
              {say({ language, en: "Study and Understand", fr: "Étudiez et comprenez" })}
            </h3>
            <p className="text-sm text-slate-600">
              {say({
                language,
                en: "One layer at a time: its source as written, its complete closure flattened and resolved in place, and the lenses that draw it.",
                fr: "Une couche à la fois : sa source telle qu'écrite, sa fermeture complète aplatie et résolue en place, et les lentilles qui la dessinent.",
              })}
            </p>
            <button type="button"
              onClick={() => navigate("formalism")}
              className="mt-4 rounded-lg border-2 border-sky-600 px-4 py-2 text-sm text-sky-600 font-semibold hover:bg-sky-50 transition-colors"
            >
              {say({ language, en: "Study and understand →", fr: "Étudiez et comprenez →" })}
            </button>
          </div>
        </section>

        <section className="mt-12 flex flex-wrap justify-center gap-4">
          <button type="button"
            onClick={() => navigate("tutorial")}
            className="rounded-lg bg-sky-600 px-6 py-3 text-white font-semibold hover:bg-sky-500 transition-colors"
          >
            {say({ language, en: "Tutorial →", fr: "Tutoriel →" })}
          </button>
          <button type="button"
            onClick={() => navigate("filiation")}
            className="rounded-lg border-2 border-slate-400 px-6 py-3 text-slate-700 dark:text-slate-200 font-semibold hover:bg-slate-50 dark:bg-slate-900 transition-colors"
          >
            {say({ language, en: "Filiation & comparison →", fr: "Filiation & comparaison →" })}
          </button>
          <button type="button"
            onClick={() => navigate("workshop")}
            className="rounded-lg border-2 border-sky-600 px-6 py-3 text-sky-600 font-semibold hover:bg-sky-50 transition-colors"
          >
            {say({ language, en: "Workshop →", fr: "Atelier →" })}
          </button>
          <button type="button"
            onClick={() => navigate("editor")}
            className="rounded-lg border-2 border-emerald-600 px-6 py-3 text-emerald-600 font-semibold hover:bg-emerald-50 transition-colors"
          >
            {say({ language, en: "Model editor →", fr: "Éditeur de modèles →" })}
          </button>
        </section>

        <footer className="mt-16 pt-6 border-t border-slate-200 dark:border-slate-700 text-center text-xs text-slate-600">
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
