// The auth panel (milestone Auth v1): opened from the key button of
// the site header. It reads /auth/me — the httpOnly `sid` session
// cookie travels with the call automatically — and shows either the
// connected user with a logout link, or a single sign-in button that
// starts the OIDC round trip at /auth/login (the IdP does the rest).
// No token, no access code ever lives in the browser: nothing is
// persisted client-side, nothing is sent in a hand-built header.

import { useEffect, useState } from "react";
import { apiFetch } from "../infrastructure/wardrobeClient.ts";
import { notifyAuthChanged } from "../infrastructure/authEvents.ts";
import { say } from "./i18n.ts";
import type { Language } from "../domain/messages.ts";

interface MeResponse {
  utilisateur: string;
  email?: string;
  sub?: string;
  identity: string;
}

type PanelState = "loading" | "anonymous" | "connected" | "unreachable";

export function AuthPanel({ language, onChanged }: { language: Language; onChanged?: () => void }) {
  const [me, setMe] = useState<MeResponse | null>(null);
  const [state, setState] = useState<PanelState>("loading");
  const [stateMessage, setStateMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void apiFetch({ endpoint: "auth/me" })
      .then(async (response) => {
        if (cancelled) return;
        if (response.ok) {
          const body = (await response.json()) as MeResponse;
          if (cancelled) return;
          setMe(body);
          setState("connected");
          onChanged?.();
          notifyAuthChanged();
        } else if (response.status === 401) {
          setState("anonymous");
        } else {
          setState("unreachable");
          setStateMessage(say({ language, en: "response " + response.status + " from the server" }));
        }
      })
      .catch(() => {
        if (cancelled) return;
        setState("unreachable");
        setStateMessage(say({ language, en: "the server did not answer — the workshop lives alone for now" }));
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function login(): void {
    const here = window.location.pathname + window.location.hash;
    window.location.assign("/auth/login?returnTo=" + encodeURIComponent(here === "" ? "/" : here));
  }

  function logout(): void {
    window.location.assign("/auth/logout");
  }

  return (
    <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-3">
      <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
        <span className="rounded bg-slate-800 dark:bg-slate-600 px-1.5 py-0.5 text-[11px] font-bold text-white">
          {say({ language, en: "account" })}
        </span>
        <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
          {state === "connected" && me !== null ? say({ language, en: "connected" }) : say({ language, en: "sign in" })}
        </span>
      </div>
      {state === "loading" && (
        <p className="text-[11px] text-slate-500 dark:text-slate-400">
          {say({ language, en: "checking the session…" })}
        </p>
      )}
      {state === "anonymous" && (
        <div className="space-y-1.5">
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            {say({
              language,
              en: "sign in with your Zitadel account — the quarry and the AI geologist open after the round trip",
            })}
          </p>
          <button
            type="button"
            onClick={login}
            className="rounded bg-slate-800 dark:bg-slate-600 px-2 py-1 text-xs font-semibold text-white hover:bg-slate-700 dark:hover:bg-slate-500"
          >
            {say({ language, en: "sign in with Zitadel" })}
          </button>
        </div>
      )}
      {state === "connected" && me !== null && (
        <div className="space-y-1.5">
          <p className="text-xs text-slate-700 dark:text-slate-200">
            {me.utilisateur}
            {me.email !== undefined && me.email !== "" && (
              <span className="block text-[10px] text-slate-500 dark:text-slate-400">{me.email}</span>
            )}
          </p>
          <button
            type="button"
            onClick={logout}
            className="rounded border border-slate-300 dark:border-slate-600 px-2 py-1 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
          >
            {say({ language, en: "sign out" })}
          </button>
        </div>
      )}
      {state === "unreachable" && stateMessage !== null && (
        <p className="text-[10px] text-slate-500 dark:text-slate-400">{stateMessage}</p>
      )}
    </div>
  );
}
