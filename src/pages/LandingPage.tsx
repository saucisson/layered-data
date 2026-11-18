// Landing page for Layered Data

import { hashOf } from "../components/Router";
import { PROSE_WIDTH } from "../components/PageShell";
import { say } from "../presentation/i18n.ts";
import { KERNEL_LAYER_NAMES } from "../application/corpus.ts";
import type { Language } from "../domain/messages.ts";

interface LandingPageProps {
  language: Language;
}

export function LandingPage({ language }: LandingPageProps) {

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100">
      <div className={"mx-auto " + PROSE_WIDTH + " p-4 sm:p-8"}>
        <section className="text-center">
          <h1 className="mb-4 text-3xl font-bold text-slate-800 dark:text-slate-100">
            {say({
              language,
              en: "Layered Data",
            })}
          </h1>
          <p className="mx-auto max-w-2xl text-lg text-slate-600 dark:text-slate-400">
            {say({
              language,
              en: "Formalisms and models as layered data — refinement, inheritance, the first definition wins.",
            })}
          </p>
        </section>

        <section className="mt-12 grid gap-4 sm:p-6 md:grid-cols-3">
          <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 sm:p-6 shadow-sm">
            <h3 className="mb-3 text-lg font-semibold text-slate-800 dark:text-slate-100">
              {say({ language, en: "Incremental Definitions"})}
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              {say({
                language,
                en: "Definition is incremental: each notion is a small, finely composable layer that refines its parent — " + KERNEL_LAYER_NAMES.length + " layers, from basic records to the philosophers' dinner.",
              })}
            </p>
          </div>

          <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 sm:p-6 shadow-sm">
            <h3 className="mb-3 text-lg font-semibold text-slate-800 dark:text-slate-100">
              {say({ language, en: "First-Wins Reading"})}
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-400">
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
            <p className="text-sm text-slate-600 dark:text-slate-400">
              {say({
                language,
                en: "See the same model through different formalisms: the data does not move, the lens changes — the philosophers' dinner draws as a generic graph or as a Petri net.",
              })}
            </p>
            <a href={hashOf("lenses")}
              className="mt-4 rounded-lg border-2 border-slate-400 px-4 py-2 text-sm text-slate-700 dark:text-slate-200 font-semibold hover:bg-slate-50 dark:hover:bg-slate-700 dark:bg-slate-900 transition-colors"
            >
              {say({ language, en: "See the lenses →"})}
            </a>
          </div>
        </section>

        <section className="mt-12 grid gap-4 sm:p-6 md:grid-cols-3">
          <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 sm:p-6 shadow-sm">
            <h3 className="mb-3 text-lg font-semibold text-slate-800 dark:text-slate-100">
              {say({ language, en: "Visualize the Hierarchy"})}
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              {say({
                language,
                en: "The complete refinement graph of the corpus. Click a layer to understand it.",
              })}
            </p>
            <a href={hashOf("hierarchy")}
              className="mt-4 rounded-lg border-2 border-slate-400 px-4 py-2 text-sm text-slate-700 dark:text-slate-200 font-semibold hover:bg-slate-50 dark:hover:bg-slate-700 dark:bg-slate-900 transition-colors"
            >
              {say({ language, en: "Visualize the hierarchy →"})}
            </a>
          </div>

          <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 sm:p-6 shadow-sm">
            <h3 className="mb-3 text-lg font-semibold text-slate-800 dark:text-slate-100">
              {say({ language, en: "Create a Formalism"})}
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              {say({
                language,
                en: "Say the intention; the workshop's AI geologist proposes a draft in the language; the staging judges it; the accepted layer enters the living session.",
              })}
            </p>
            <a href={hashOf("creation")}
              className="mt-4 rounded-lg border-2 border-emerald-500 px-4 py-2 text-sm text-emerald-600 dark:text-emerald-400 font-semibold hover:bg-emerald-50 dark:hover:bg-emerald-950 transition-colors"
            >
              {say({ language, en: "Create a formalism →"})}
            </a>
          </div>

          <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 sm:p-6 shadow-sm">
            <h3 className="mb-3 text-lg font-semibold text-slate-800 dark:text-slate-100">
              {say({ language, en: "Study and Understand"})}
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              {say({
                language,
                en: "One layer at a time: its source as written, its complete closure flattened and resolved in place, and the lenses that draw it.",
              })}
            </p>
            <a href={hashOf("formalism", "multihypergraph")}
              className="mt-4 rounded-lg border-2 border-sky-600 px-4 py-2 text-sm text-sky-600 dark:text-sky-400 font-semibold hover:bg-sky-50 dark:hover:bg-sky-950 transition-colors"
            >
              {say({ language, en: "Study and understand →"})}
            </a>
          </div>
        </section>

        <section className="mt-12 flex flex-wrap justify-center gap-4">
          <a href={hashOf("tutorial")}
            className="rounded-lg bg-sky-600 dark:bg-sky-700 px-6 py-3 text-white font-semibold hover:bg-sky-500 dark:hover:bg-sky-600 transition-colors"
          >
            {say({ language, en: "Tutorial →"})}
          </a>
          <a href={hashOf("filiation")}
            className="rounded-lg border-2 border-slate-400 px-6 py-3 text-slate-700 dark:text-slate-200 font-semibold hover:bg-slate-50 dark:hover:bg-slate-700 dark:bg-slate-900 transition-colors"
          >
            {say({ language, en: "Filiation & comparison →"})}
          </a>
          <a href={hashOf("formalisms")}
            className="rounded-lg border-2 border-sky-600 px-6 py-3 text-sky-600 dark:text-sky-400 font-semibold hover:bg-sky-50 dark:hover:bg-sky-950 transition-colors"
          >
            {say({ language, en: "Workshop →"})}
          </a>
          <a href={hashOf("models")}
            className="rounded-lg border-2 border-emerald-600 px-6 py-3 text-emerald-600 dark:text-emerald-400 font-semibold hover:bg-emerald-50 dark:hover:bg-emerald-950 transition-colors"
          >
            {say({ language, en: "Model editor →"})}
          </a>
          <a href={hashOf("install")}
            className="rounded-lg border-2 border-slate-400 px-6 py-3 text-slate-700 dark:text-slate-200 font-semibold hover:bg-slate-50 dark:hover:bg-slate-700 dark:bg-slate-900 transition-colors"
          >
            {say({ language, en: "Run it locally →"})}
          </a>
        </section>

        <footer className="mt-16 pt-6 border-t border-slate-200 dark:border-slate-700 text-center text-xs text-slate-600 dark:text-slate-400">
          {say({
            language,
            en: "Layered Data — A formalism design workshop where definitions are data",
          })}
        </footer>
      </div>
    </div>
  );
}
