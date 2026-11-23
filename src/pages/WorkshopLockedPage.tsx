// The workshop-without-session error page (LD-9, common web contract
// ADR-0120 §2): the Atelier zone requires an account. An anonymous
// visitor gets one explicit message and a single sign-in form — never
// a raw error. Same charter as the 404 page, FR/EN.

import { useState } from "react";
import type { Language } from "../domain/messages";
import { say } from "../presentation/i18n";
import { AccessCodeForm } from "../presentation/accessForm";

export function WorkshopLockedPage({ language }: { language: Language }) {
  const [signedIn, setSignedIn] = useState(false);
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-100 p-4 text-center text-slate-900 sm:p-8 dark:bg-slate-800 dark:text-slate-100">
      <p className="text-6xl font-bold text-slate-300 dark:text-slate-600" aria-hidden="true">
        <svg viewBox="0 0 24 24" className="mx-auto h-16 w-16" fill="currentColor">
          <path d="M12 2a5 5 0 0 0-5 5v3H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8a2 2 0 0 0-2-2h-1V7a5 5 0 0 0-5-5Zm-3 8V7a3 3 0 1 1 6 0v3H9Z" />
        </svg>
      </p>
      <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100">
        {say({ language, en: "The workshop requires a session", fr: "L'atelier requiert une session" })}
      </h1>
      <p className="max-w-md text-sm text-slate-600 dark:text-slate-300">
        {say({
          language,
          en: "Sign in to open the formalisms, the model editor, the creation and the hierarchy. The landing and discovery pages stay public.",
          fr: "Connectez-vous pour ouvrir les formalismes, l'éditeur de modèles, la création et la hiérarchie. Les pages d'accueil et de découverte restent publiques.",
        })}
      </p>
      {signedIn ? (
        <a
          href="#formalisms"
          className="rounded bg-sky-600 dark:bg-sky-700 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-500 dark:hover:bg-sky-600"
        >
          {say({ language, en: "Open the workshop", fr: "Ouvrir l'atelier" })}
        </a>
      ) : (
        <span className="w-80 text-left">
          <AccessCodeForm
            language={language}
            onVerified={() => {
              setSignedIn(true);
              window.dispatchEvent(new CustomEvent("ld:access-verified"));
            }}
          />
        </span>
      )}
      <a
        href="#landing"
        className="text-sm font-semibold text-sky-700 hover:underline dark:text-sky-400"
      >
        {say({ language, en: "Back to home", fr: "Retour à l'accueil" })}
      </a>
    </div>
  );
}
