// Landing page for Layered Data — the public Home zone (LD-7, ADR-0120
// §2): a presentation of the site and two doors, one toward the public
// Discover zone, one toward the Workshop zone (which asks for a
// session). This page emits no authenticated request: the corpus it
// counts is read locally at build time, never from the API.

import { hashOf } from "../components/Router";
import { PROSE_WIDTH } from "../components/PageShell";
import { say } from "../presentation/i18n.ts";
import { KERNEL_LAYER_NAMES } from "../application/corpus.ts";
import type { Language } from "../domain/messages.ts";

interface LandingPageProps {
  language: Language;
}

/** The public discovery pages, listed under the Discover door. */
const DISCOVERY_LINKS: readonly { page: "tutorial" | "filiation" | "lenses" | "install"; label: { en: string; fr: string } }[] = [
  { page: "tutorial", label: { en: "Tutorial", fr: "Tutoriel" } },
  { page: "filiation", label: { en: "Filiation", fr: "Filiation" } },
  { page: "lenses", label: { en: "Lenses", fr: "Lentilles" } },
  { page: "install", label: { en: "Install", fr: "Installation" } },
];

export function LandingPage({ language }: LandingPageProps) {
  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100">
      <div className={"mx-auto " + PROSE_WIDTH + " p-4 sm:p-8"}>
        <section className="text-center">
          <h1 className="mb-4 text-3xl font-bold text-slate-800 dark:text-slate-100">
            {say({
              language,
              en: "Layered Data",
              fr: "Layered Data",
            })}
          </h1>
          <p className="mx-auto max-w-2xl text-lg text-slate-600 dark:text-slate-400">
            {say({
              language,
              en: "Formalisms and models as layered data — refinement, inheritance, the first definition wins.",
              fr: "Formalismes et modèles en données en couches — le raffinement, l'héritage, la première définition l'emporte.",
            })}
          </p>
        </section>

        <section className="mt-12 grid gap-4 sm:p-6 md:grid-cols-3">
          <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 sm:p-6 shadow-sm">
            <h3 className="mb-3 text-lg font-semibold text-slate-800 dark:text-slate-100">
              {say({ language, en: "Incremental Definitions", fr: "Définitions incrémentales" })}
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              {say({
                language,
                en: "Definition is incremental: each notion is a small, finely composable layer that refines its parent — " + KERNEL_LAYER_NAMES.length + " layers, from basic records to the philosophers' dinner.",
                fr: "La définition est incrémentale : chaque notion est une petite couche finement composable qui raffine son parent — " + KERNEL_LAYER_NAMES.length + " couches, des enregistrements de base au dîner des philosophes.",
              })}
            </p>
          </div>

          <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 sm:p-6 shadow-sm">
            <h3 className="mb-3 text-lg font-semibold text-slate-800 dark:text-slate-100">
              {say({ language, en: "First-Wins Reading", fr: "Lecture « premier gagne »" })}
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              {say({
                language,
                en: "Reading an address walks the refinement chain and returns the first value found.",
                fr: "Lire une adresse parcourt la chaîne de raffinement et renvoie la première valeur trouvée.",
              })}
            </p>
          </div>

          <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 sm:p-6 shadow-sm">
            <h3 className="mb-3 text-lg font-semibold text-slate-800 dark:text-slate-100">
              {say({
                language,
                en: "One Model, Several Formalisms",
                fr: "Un modèle, plusieurs formalismes",
              })}
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              {say({
                language,
                en: "See the same model through different formalisms: the data does not move, the lens changes — the philosophers' dinner draws as a generic graph or as a Petri net.",
                fr: "Voir le même modèle à travers différents formalismes : la donnée ne bouge pas, c'est la lentille qui change — le dîner des philosophes se dessine en graphe générique ou en réseau de Petri.",
              })}
            </p>
          </div>
        </section>

        <section className="mt-12 grid gap-4 sm:p-6 md:grid-cols-2">
          <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 sm:p-6 shadow-sm">
            <h3 className="mb-3 text-lg font-semibold text-slate-800 dark:text-slate-100">
              {say({ language, en: "Discover", fr: "Découvrir" })}
            </h3>
            <p className="mb-4 text-sm text-slate-600 dark:text-slate-400">
              {say({
                language,
                en: "Public, read-only: the tutorial, the filiation of the layers, the lenses, the installation.",
                fr: "Public, en lecture seule : le tutoriel, la filiation des couches, les lentilles, l'installation.",
              })}
            </p>
            <ul className="flex flex-wrap gap-2">
              {DISCOVERY_LINKS.map((entry) => (
                <li key={entry.page}>
                  <a
                    href={hashOf(entry.page)}
                    className="rounded-lg border-2 border-slate-400 px-4 py-2 text-sm text-slate-700 dark:text-slate-200 font-semibold hover:bg-slate-50 dark:hover:bg-slate-700 dark:bg-slate-900 transition-colors"
                  >
                    {say({ language, en: entry.label.en, fr: entry.label.fr })}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 sm:p-6 shadow-sm">
            <h3 className="mb-3 text-lg font-semibold text-slate-800 dark:text-slate-100">
              {say({ language, en: "Workshop", fr: "Atelier" })}
            </h3>
            <p className="mb-4 text-sm text-slate-600 dark:text-slate-400">
              {say({
                language,
                en: "The formalisms, the model editor, the creation with the AI geologist, the hierarchy — an account is required.",
                fr: "Les formalismes, l'éditeur de modèles, la création avec le géologue IA, la hiérarchie — un compte est requis.",
              })}
            </p>
            <a
              href={hashOf("formalisms")}
              className="rounded-lg border-2 border-emerald-500 px-4 py-2 text-sm text-emerald-600 dark:text-emerald-400 font-semibold hover:bg-emerald-50 dark:hover:bg-emerald-950 transition-colors"
            >
              {say({ language, en: "Open the workshop →", fr: "Ouvrir l'atelier →" })}
            </a>
          </div>
        </section>

        <footer className="mt-16 pt-6 border-t border-slate-200 dark:border-slate-700 text-center text-xs text-slate-600 dark:text-slate-400">
          {say({
            language,
            en: "Layered Data — A formalism design workshop where definitions are data",
            fr: "Layered Data — Un atelier de conception de formalismes où les définitions sont des données",
          })}
        </footer>
      </div>
    </div>
  );
}
