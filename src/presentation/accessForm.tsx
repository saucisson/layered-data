// The visible lock: one field, one verification, one state that
// speaks — never a silent failure, even without a proxy.

import { useEffect, useState } from "react";
import {
  apiFetch,
  hasValidAccessCodeConsent,
  readAccessCode,
  writeAccessCode,
} from "../infrastructure/wardrobeClient.ts";
import { notifyAccessCodeVerified } from "../infrastructure/accessCodeEvents.ts";
import { say } from "./i18n.ts";
import type { Language } from "../domain/messages.ts";

export function AccessCodeForm({ language, onVerified }: { language: Language; onVerified?: () => void }) {
  const [accessCode, setAccessCode] = useState(readAccessCode());
  const [remember, setRemember] = useState(hasValidAccessCodeConsent());
  const [stateMessage, setStateMessage] = useState<string | null>(null);
  // Once a stored code is verified against the proxy, the dialog hides
  // itself (issue #244): the code is kept by the browser, no need to
  // ask again.
  const [verified, setVerified] = useState(false);
  useEffect(() => {
    if (verified || readAccessCode().trim() === "") return;
    let cancelled = false;
    void apiFetch({ endpoint: "api/whoami" })
      .then((response) => {
        if (cancelled) return;
        if (response.ok) {
          setVerified(true);
          onVerified?.();
          notifyAccessCodeVerified();
        }
      })
      .catch(() => {
        // A silent re-verify that cannot reach the proxy keeps the form
        // visible and says why — nothing is swallowed.
        if (!cancelled) {
          setStateMessage(
            say({
              language,
              en: "the proxy did not answer — the code could not be re-verified",
            }),
          );
        }
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [verified]);
  async function verify() {
    writeAccessCode({ accessCode, remember });
    try {
      const response = await apiFetch({ endpoint: "api/whoami" });
      if (response.ok) {
        setVerified(true);
        setStateMessage(
          say({
            language,
            en: "code verified — the quarry and the AI geologist are open",
          }),
        );
        onVerified?.();
        notifyAccessCodeVerified();
      } else if (response.status === 401) {
        // Refused, said client-side in one language: the site access
        // code is the one the server administrator gave you — never
        // the AI key, and no server internals are shown (#326).
        setStateMessage(
          say({
            language,
            en: "code refused — the site access code is the one the server administrator gave you, not the AI key.",
          }),
        );
      } else {
        setStateMessage(
          say({
            language,
            en: "response " + response.status + " from the proxy",
          }),
        );
      }
    } catch {
      setStateMessage(
        say({
          language,
          en: "without proxy — the workshop lives alone, the quarry is empty",
        }),
      );
    }
  }
  if (verified) return null;
  return (
    <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-3">
      <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
        <span className="rounded bg-slate-800 dark:bg-slate-600 px-1.5 py-0.5 text-[11px] font-bold text-white">
          {say({ language, en: "key"})}
        </span>
        <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
          {say({ language, en: "site access code"})}
        </span>
      </div>
      <form
        className="flex flex-wrap items-center gap-1.5"
        onSubmit={(event) => {
          event.preventDefault();
          void verify();
        }}
      >
        <input
          type="password"
          value={accessCode}
          onChange={(event) => setAccessCode(event.target.value)}
          placeholder={say({ language, en: "access code"})}
          autoComplete="off"
          className="min-w-40 flex-1 rounded border border-slate-200 dark:border-slate-700 px-2 py-1 text-xs"
        />
        <button type="submit"
          className="rounded bg-slate-800 dark:bg-slate-600 px-2 py-1 text-xs font-semibold text-white hover:bg-slate-700 dark:hover:bg-slate-500"
        >
          {say({ language, en: "verify"})}
        </button>
      </form>
      <label className="mt-1.5 flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
        <input
          type="checkbox"
          checked={remember}
          onChange={(event) => setRemember(event.target.checked)}
        />
        {say({
          language,
          en: "remember this code on this browser for 30 days (stored locally, expires automatically) — otherwise it is kept for this tab only",
        })}
      </label>
      {stateMessage !== null && <p className="mt-1.5 text-[10px] text-slate-500 dark:text-slate-400">{stateMessage}</p>}
    </div>
  );
}
