// The optional personal account (issue #141, ADR-0114): created on
// demand, consent-based, never required. Without an account the
// workshop stays local-first — everything lives in the browser,
// invisible to other users. With an account the user can publish to
// the server quarry; the personal access code travels in the
// x-access-code header exactly like the legacy shared code.

import { useState } from "react";
import { apiFetch, readAccessCode, writeAccessCode } from "../infrastructure/wardrobeClient.ts";
import { say } from "./i18n.ts";
import type { Language } from "../domain/messages.ts";

/** The localStorage key of the connected user profile (JSON). */
const USER_PROFILE_STORAGE_KEY = "atelier-user-profile";

export interface ConnectedUser {
  id: number;
  displayName: string;
  role: "user" | "admin";
}

/** Read the connected user profile from localStorage, if any. */
export function readConnectedUser(): ConnectedUser | null {
  try {
    const raw = localStorage.getItem(USER_PROFILE_STORAGE_KEY);
    if (raw === null) return null;
    const parsed = JSON.parse(raw) as Partial<ConnectedUser>;
    if (
      typeof parsed.id === "number" &&
      typeof parsed.displayName === "string" &&
      (parsed.role === "user" || parsed.role === "admin")
    ) {
      return { id: parsed.id, displayName: parsed.displayName, role: parsed.role };
    }
    return null;
  } catch {
    return null;
  }
}

/** Persist (or clear, when null) the connected user profile. */
export function writeConnectedUser({ user }: { user: ConnectedUser | null }): void {
  try {
    if (user === null) {
      localStorage.removeItem(USER_PROFILE_STORAGE_KEY);
    } else {
      localStorage.setItem(USER_PROFILE_STORAGE_KEY, JSON.stringify(user));
    }
  } catch {
    // storage unavailable: the profile simply will not persist
  }
}

type AccountMode = "idle" | "create" | "login";

export function UserAccountForm({ language }: { language: Language }) {
  const [mode, setMode] = useState<AccountMode>("idle");
  const [displayName, setDisplayName] = useState("");
  const [accessCode, setAccessCode] = useState("");
  const [stateMessage, setStateMessage] = useState<string | null>(null);
  const [connectedUser, setConnectedUser] = useState<ConnectedUser | null>(() => readConnectedUser());

  async function handleCreate() {
    setStateMessage(null);
    try {
      const response = await apiFetch({
        endpoint: "api/users",
        options: {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ displayName: displayName.trim(), accessCode: accessCode.trim() }),
        },
      });
      if (response.status === 201) {
        const body = (await response.json()) as { id: number; displayName: string; role: "user" | "admin" };
        const user: ConnectedUser = { id: body.id, displayName: body.displayName, role: body.role };
        writeAccessCode({ accessCode: accessCode.trim(), remember: true });
        writeConnectedUser({ user });
        setConnectedUser(user);
        setStateMessage(
          say({ language, en: "account created — you are connected as " + user.displayName }),
        );
        setMode("idle");
      } else if (response.status === 409) {
        setStateMessage(say({ language, en: "this access code is already taken — choose another" }));
      } else if (response.status === 400) {
        setStateMessage(
          say({ language, en: "invalid request — the code needs at least 8 characters" }),
        );
      } else {
        setStateMessage(say({ language, en: "the server answered " + response.status }));
      }
    } catch {
      setStateMessage(
        say({ language, en: "no server reachable — the workshop stays local, no account needed" }),
      );
    }
  }

  async function handleLogin() {
    setStateMessage(null);
    try {
      // Verify the code first: a refused or shared code must not be
      // persisted as the active credential.
      const probeHeaders: Record<string, string> = { "x-access-code": accessCode.trim() };
      const response = await fetch("api/whoami", { headers: probeHeaders });
      if (response.ok) {
        const body = (await response.json()) as {
          identity: string;
          user?: { id: number; displayName: string; role: "user" | "admin" };
        };
        if (body.identity === "personal-code" && body.user !== undefined) {
          const user: ConnectedUser = {
            id: body.user.id,
            displayName: body.user.displayName,
            role: body.user.role,
          };
          writeAccessCode({ accessCode: accessCode.trim(), remember: true });
          writeConnectedUser({ user });
          setConnectedUser(user);
          setStateMessage(
            say({ language, en: "connected as " + user.displayName + " — your layers are yours" }),
          );
          setMode("idle");
        } else {
          setStateMessage(
            say({ language, en: "this code is the shared site code, not a personal account" }),
          );
        }
      } else {
        setStateMessage(say({ language, en: "code refused — no account matches it" }));
      }
    } catch {
      setStateMessage(
        say({ language, en: "without proxy — the workshop lives alone, the quarry is empty" }),
      );
    }
  }

  function handleLogout() {
    writeAccessCode({ accessCode: readAccessCode(), remember: false });
    writeConnectedUser({ user: null });
    setConnectedUser(null);
    setAccessCode("");
    setStateMessage(say({ language, en: "disconnected — the workshop stays local-first" }));
    setMode("idle");
  }

  if (connectedUser !== null) {
    return (
      <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="rounded bg-emerald-700 px-1.5 py-0.5 text-[11px] font-bold text-white">
            {say({ language, en: "account" })}
          </span>
          <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
            {connectedUser.displayName}
          </span>
          <span className="text-[11px] text-slate-500">
            {connectedUser.role === "admin"
              ? say({ language, en: "admin" })
              : say({ language, en: "personal account — your layers are scoped to you" })}
          </span>
          <button
            type="button"
            onClick={handleLogout}
            className="ml-auto rounded border border-slate-300 dark:border-slate-600 px-2 py-1 text-xs text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700"
          >
            {say({ language, en: "disconnect" })}
          </button>
        </div>
        {stateMessage !== null && (
          <p className="mt-1.5 text-[10px] text-slate-500">{stateMessage}</p>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-3">
      <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
        <span className="rounded bg-slate-600 px-1.5 py-0.5 text-[11px] font-bold text-white">
          {say({ language, en: "optional" })}
        </span>
        <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
          {say({ language, en: "personal account" })}
        </span>
        <span className="text-[11px] leading-4 text-slate-500">
          {say({
            language,
            en: "without an account everything stays in this browser — invisible to others; with one, your layers publish to the shared quarry",
          })}
        </span>
      </div>
      {mode === "idle" && (
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setMode("create")}
            className="rounded bg-slate-800 px-2 py-1 text-xs font-semibold text-white hover:bg-slate-700"
          >
            {say({ language, en: "create an account" })}
          </button>
          <button
            type="button"
            onClick={() => setMode("login")}
            className="rounded border border-slate-300 dark:border-slate-600 px-2 py-1 text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
          >
            {say({ language, en: "I already have one" })}
          </button>
        </div>
      )}
      {mode === "create" && (
        <div className="space-y-1.5">
          <input
            type="text"
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            placeholder={say({ language, en: "display name" })}
            className="w-full rounded border border-slate-200 dark:border-slate-700 px-2 py-1 text-xs"
          />
          <input
            type="password"
            value={accessCode}
            onChange={(event) => setAccessCode(event.target.value)}
            placeholder={say({ language, en: "choose an access code (8+ characters)" })}
            className="w-full rounded border border-slate-200 dark:border-slate-700 px-2 py-1 text-xs"
          />
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => void handleCreate()}
              className="rounded bg-slate-800 px-2 py-1 text-xs font-semibold text-white hover:bg-slate-700"
            >
              {say({ language, en: "create" })}
            </button>
            <button
              type="button"
              onClick={() => setMode("idle")}
              className="rounded border border-slate-300 dark:border-slate-600 px-2 py-1 text-xs text-slate-500"
            >
              {say({ language, en: "cancel" })}
            </button>
          </div>
        </div>
      )}
      {mode === "login" && (
        <div className="space-y-1.5">
          <input
            type="password"
            value={accessCode}
            onChange={(event) => setAccessCode(event.target.value)}
            placeholder={say({ language, en: "your personal access code" })}
            className="w-full rounded border border-slate-200 dark:border-slate-700 px-2 py-1 text-xs"
          />
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => void handleLogin()}
              className="rounded bg-slate-800 px-2 py-1 text-xs font-semibold text-white hover:bg-slate-700"
            >
              {say({ language, en: "connect" })}
            </button>
            <button
              type="button"
              onClick={() => setMode("idle")}
              className="rounded border border-slate-300 dark:border-slate-600 px-2 py-1 text-xs text-slate-500"
            >
              {say({ language, en: "cancel" })}
            </button>
          </div>
        </div>
      )}
      {stateMessage !== null && (
        <p className="mt-1.5 text-[10px] text-slate-500">{stateMessage}</p>
      )}
    </div>
  );
}
