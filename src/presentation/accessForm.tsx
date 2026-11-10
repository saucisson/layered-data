// The visible lock: one field, one verification, one state that
// speaks — never a silent failure, even without a proxy.

import { useState } from "react";
import { apiFetch, readAccessCode, writeAccessCode } from "../infrastructure/wardrobeClient.ts";
import { say } from "./i18n.ts";
import type { Language } from "../domain/messages.ts";

export function AccessCodeForm({ language }: { language: Language }) {
  const [accessCode, setAccessCode] = useState(readAccessCode());
  const [stateMessage, setStateMessage] = useState<string | null>(null);
  async function verify() {
    writeAccessCode({ accessCode });
    try {
      const response = await apiFetch({ endpoint: "api/whoami" });
      if (response.ok) {
        setStateMessage(
          say({
            language,
            en: "code verified — the quarry and the AI geologist are open",
            fr: "code vérifié — la carrière et le géologue IA sont ouverts",
          }),
        );
      } else if (response.status === 401) {
        setStateMessage(
          say({ language, en: "code refused — the proxy is protected", fr: "code refusé — le proxy est protégé" }),
        );
      } else {
        setStateMessage(
          say({
            language,
            en: "response " + response.status + " from the proxy",
            fr: "réponse " + response.status + " du proxy",
          }),
        );
      }
    } catch {
      setStateMessage(
        say({
          language,
          en: "without proxy — the workshop lives alone, the quarry is empty",
          fr: "sans proxy — l'atelier vit seul, la carrière est vide",
        }),
      );
    }
  }
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
        <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[11px] font-bold text-white">
          {say({ language, en: "key", fr: "clé" })}
        </span>
        <span className="text-xs font-semibold text-slate-700">
          {say({ language, en: "site access code", fr: "code d'accès du site" })}
        </span>
        <span className="text-[11px] leading-4 text-slate-500">
          {say({
            language,
            en: "a shared key, laid in the proxy's .env — it protects the chatbot and the disk quarry; the workshop stays open to all",
            fr: "une clé partagée, posée dans .env du proxy — elle protège le chatbot et la carrière du disque ; l'atelier reste ouvert à tous",
          })}
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <input
          type="password"
          value={accessCode}
          onChange={(event) => setAccessCode(event.target.value)}
          placeholder={say({ language, en: "access code", fr: "code d'accès" })}
          className="min-w-40 flex-1 rounded border border-slate-200 px-2 py-1 text-xs"
        />
        <button
          onClick={() => {
            void verify();
          }}
          className="rounded bg-slate-800 px-2 py-1 text-xs font-semibold text-white hover:bg-slate-700"
        >
          {say({ language, en: "verify", fr: "vérifier" })}
        </button>
      </div>
      {stateMessage !== null && <p className="mt-1.5 text-[10px] text-slate-500">{stateMessage}</p>}
    </div>
  );
}
