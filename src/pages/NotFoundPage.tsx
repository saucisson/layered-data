// 404 page for unknown hash routes — shown when the hash does not
// match any known page. Offers a way back to the landing page.

import type { Language } from "../domain/messages";
import { say } from "../presentation/i18n";
import { useRouter } from "../components/Router";

export function NotFoundPage({ language }: { language: Language }) {
  const { navigate } = useRouter();
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-4 sm:p-8 text-center">
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
      <button
        type="button"
        onClick={() => navigate("landing")}
        className="rounded bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-500"
      >
        {say({ language, en: "Back to home" })}
      </button>
    </main>
  );
}
