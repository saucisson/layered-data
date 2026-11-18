// 404 page for unknown hash routes — shown when the hash does not
// match any known page. Offers a way back to the landing page.

import type { Language } from "../domain/messages";
import { say } from "../presentation/i18n";
import { hashOf } from "../components/Router";

export function NotFoundPage({ language }: { language: Language }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-100 p-4 text-center text-slate-900 sm:p-8 dark:bg-slate-800 dark:text-slate-100">
      <p className="text-6xl font-bold text-slate-300 dark:text-slate-600">404</p>
      <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100">
        {say({ language, en: "Page not found" })}
      </h1>
      <p className="max-w-md text-sm text-slate-600 dark:text-slate-300">
        {say({
          language,
          en: "This address does not exist in the workshop. The URL may be incomplete or the page has moved.",
        })}
      </p>
      <a href={hashOf("landing")}
        className="rounded bg-sky-600 dark:bg-sky-700 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-500 dark:hover:bg-sky-600"
      >
        {say({ language, en: "Back to home" })}
      </a>
    </div>
  );
}
