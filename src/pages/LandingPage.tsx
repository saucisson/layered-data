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
            })}
          </h1>
          <span className="flex shrink-0 items-center gap-1 text-xs">
            <span className="mr-1 text-slate-600">
              {say({ language, en: "language: "})}
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

      <main className="mx-auto max-w-4xl p-4 sm:p-8">
        <section className="text-center">
          <h2 className="mb-4 text-3xl font-bold text-slate-800 dark:text-slate-100">
            {say({
              language,
              en: "Data in Strata",
            })}
          </h2>
          <p className="mx-auto max-w-2xl text-lg text-slate-600">
            {say({
              language,
              en: "A demonstrator where formalisms and models are layered data. Refinement, inheritance: the first definition wins, and the system becomes powerful.",
            })}
          </p>
        </section>

        <section className="mt-12 grid gap-4 sm:p-6 md:grid-cols-3">
          <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 sm:p-6 shadow-sm">
            <h3 className="mb-3 text-lg font-semibold text-slate-800 dark:text-slate-100">
              {say({ language, en: "Incremental Definitions"})}
            </h3>
            <p className="text-sm text-slate-600">
              {say({
                language,
                en: "Definition is incremental: each notion is a small, finely composable layer that refines its parent — 47 layers, from basic records to the philosophers' dinner.",
              })}
            </p>
          </div>

          <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 sm:p-6 shadow-sm">
            <h3 className="mb-3 text-lg font-semibold text-slate-800 dark:text-slate-100">
              {say({ language, en: "First-Wins Reading"})}
            </h3>
            <p className="text-sm text-slate-600">
              {say({
                language,
                en: "Reading an address walks the refinement chain and returns the first value found.",
              })}
            </p>
          </div>

          <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 sm:p-6 shadow-sm">
            <h3 className="mb-3 text-lg font-semibold text-slate-800 dark:text-slate-100">
              {say({
                language,
                en: "One Model, Several Formalisms",
              })}
            </h3>
            <p className="text-sm text-slate-600">
              {say({
                language,
                en: "See the same model through different formalisms: the data does not move, the lens changes — the philosophers' dinner draws as a generic graph or as a Petri net.",
              })}
            </p>
          </div>
        </section>

        <section className="mt-12 grid gap-4 sm:p-6 md:grid-cols-3">
          <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 sm:p-6 shadow-sm">
            <h3 className="mb-3 text-lg font-semibold text-slate-800 dark:text-slate-100">
              {say({ language, en: "Visualize the Hierarchy"})}
            </h3>
            <p className="text-sm text-slate-600">
              {say({
                language,
                en: "The complete refinement graph of the corpus. Click a layer to understand it.",
              })}
            </p>
            <button type="button"
              onClick={() => navigate("hierarchy")}
              className="mt-4 rounded-lg border-2 border-slate-400 px-4 py-2 text-sm text-slate-700 dark:text-slate-200 font-semibold hover:bg-slate-50 dark:bg-slate-900 transition-colors"
            >
              {say({ language, en: "Visualize the hierarchy →"})}
            </button>
          </div>

          <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 sm:p-6 shadow-sm">
            <h3 className="mb-3 text-lg font-semibold text-slate-800 dark:text-slate-100">
              {say({ language, en: "Create a Formalism"})}
            </h3>
            <p className="text-sm text-slate-600">
              {say({
                language,
                en: "Say the intention; the workshop's AI geologist proposes a draft in the language; the staging judges it; the accepted layer enters the living session.",
              })}
            </p>
            <button type="button"
              onClick={() => navigate("creation")}
              className="mt-4 rounded-lg border-2 border-emerald-500 px-4 py-2 text-sm text-emerald-600 font-semibold hover:bg-emerald-50 transition-colors"
            >
              {say({ language, en: "Create a formalism →"})}
            </button>
          </div>

          <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 sm:p-6 shadow-sm">
            <h3 className="mb-3 text-lg font-semibold text-slate-800 dark:text-slate-100">
              {say({ language, en: "Study and Understand"})}
            </h3>
            <p className="text-sm text-slate-600">
              {say({
                language,
                en: "One layer at a time: its source as written, its complete closure flattened and resolved in place, and the lenses that draw it.",
              })}
            </p>
            <button type="button"
              onClick={() => navigate("formalism")}
              className="mt-4 rounded-lg border-2 border-sky-600 px-4 py-2 text-sm text-sky-600 font-semibold hover:bg-sky-50 transition-colors"
            >
              {say({ language, en: "Study and understand →"})}
            </button>
          </div>
        </section>

        <section className="mt-12 flex flex-wrap justify-center gap-4">
          <button type="button"
            onClick={() => navigate("tutorial")}
            className="rounded-lg bg-sky-600 px-6 py-3 text-white font-semibold hover:bg-sky-500 transition-colors"
          >
            {say({ language, en: "Tutorial →"})}
          </button>
          <button type="button"
            onClick={() => navigate("filiation")}
            className="rounded-lg border-2 border-slate-400 px-6 py-3 text-slate-700 dark:text-slate-200 font-semibold hover:bg-slate-50 dark:bg-slate-900 transition-colors"
          >
            {say({ language, en: "Filiation & comparison →"})}
          </button>
          <button type="button"
            onClick={() => navigate("workshop")}
            className="rounded-lg border-2 border-sky-600 px-6 py-3 text-sky-600 font-semibold hover:bg-sky-50 transition-colors"
          >
            {say({ language, en: "Workshop →"})}
          </button>
          <button type="button"
            onClick={() => navigate("editor")}
            className="rounded-lg border-2 border-emerald-600 px-6 py-3 text-emerald-600 font-semibold hover:bg-emerald-50 transition-colors"
          >
            {say({ language, en: "Model editor →"})}
          </button>
        </section>

        <footer className="mt-16 pt-6 border-t border-slate-200 dark:border-slate-700 text-center text-xs text-slate-600">
          {say({
            language,
            en: "Layered Data — A formalism design workshop where definitions are data",
          })}
        </footer>
      </main>
    </div>
  );
}
