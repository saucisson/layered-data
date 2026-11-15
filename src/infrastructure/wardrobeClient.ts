// The infrastructure of the shared formalisms: the disk quarry
// (the server's formalism files) and the access code that protects
// it — never the workshop itself, which lives alone in the browser.
//
// The access code is entered once, sent with every call — never in the
// URL, never in the page. It persists in localStorage ONLY with an
// explicit consent and an expiry (issue #87); without consent it lives
// in sessionStorage and dies with the tab.

/** The localStorage key of the access code. */
const ACCESS_CODE_STORAGE_KEY = "code-acces-atelier";
/** The localStorage key of the consent expiry (ISO date). */
const ACCESS_CODE_CONSENT_KEY = "code-acces-atelier-consent";
/** The sessionStorage key of the code kept for the tab only. */
const SESSION_ACCESS_CODE_KEY = "code-acces-atelier-session";
/** How long an explicit consent keeps the code in localStorage. */
export const ACCESS_CODE_CONSENT_DAYS = 30;

/** Read the stored access code: the localStorage copy only when the
 * consent is present and unexpired (an expired consent forgets the
 * code too), otherwise the session copy. Storage can be unavailable
 * (private browsing, blocked cookies): the code is then empty, never
 * an exception. */
export function readAccessCode(): string {
  try {
    const consent = localStorage.getItem(ACCESS_CODE_CONSENT_KEY);
    if (consent !== null) {
      const expiresAt = Date.parse(consent);
      if (Number.isNaN(expiresAt) || expiresAt <= Date.now()) {
        localStorage.removeItem(ACCESS_CODE_CONSENT_KEY);
        localStorage.removeItem(ACCESS_CODE_STORAGE_KEY);
      } else {
        return localStorage.getItem(ACCESS_CODE_STORAGE_KEY) ?? "";
      }
    }
    return sessionStorage.getItem(SESSION_ACCESS_CODE_KEY) ?? "";
  } catch {
    return "";
  }
}

/** Whether a valid (unexpired) consent is on record — the initial
 * state of the "remember me" checkbox. */
export function hasValidAccessCodeConsent(): boolean {
  try {
    const consent = localStorage.getItem(ACCESS_CODE_CONSENT_KEY);
    if (consent === null) return false;
    const expiresAt = Date.parse(consent);
    return !Number.isNaN(expiresAt) && expiresAt > Date.now();
  } catch {
    return false;
  }
}

/** Remember (or forget, when empty) the access code. With `remember`,
 * the code persists in localStorage until the consent expires
 * (ACCESS_CODE_CONSENT_DAYS); without, it is kept for the tab only. */
export function writeAccessCode({
  accessCode,
  remember,
}: {
  accessCode: string;
  remember: boolean;
}): void {
  try {
    const trimmed = accessCode.trim();
    if (!trimmed) {
      localStorage.removeItem(ACCESS_CODE_STORAGE_KEY);
      localStorage.removeItem(ACCESS_CODE_CONSENT_KEY);
      sessionStorage.removeItem(SESSION_ACCESS_CODE_KEY);
      return;
    }
    if (remember) {
      const expiresAt = new Date(Date.now() + ACCESS_CODE_CONSENT_DAYS * 24 * 60 * 60 * 1000);
      localStorage.setItem(ACCESS_CODE_STORAGE_KEY, trimmed);
      localStorage.setItem(ACCESS_CODE_CONSENT_KEY, expiresAt.toISOString());
      sessionStorage.removeItem(SESSION_ACCESS_CODE_KEY);
    } else {
      localStorage.removeItem(ACCESS_CODE_STORAGE_KEY);
      localStorage.removeItem(ACCESS_CODE_CONSENT_KEY);
      sessionStorage.setItem(SESSION_ACCESS_CODE_KEY, trimmed);
    }
  } catch {
    // the browser refuses: the code simply will not persist
  }
}

/** Default bound on one API call: time-to-response. A hanging server
 * aborts after this delay, the caller's catch shows its error state —
 * no infinite spinner (issue #200). The timer is cleared as soon as
 * the response headers arrive, so a long-lived stream (the editor's
 * SSE session) stays open once connected. */
export const API_TIMEOUT_MS = 10_000;

/** One call to the proxy API, with the access code attached when
 * present. The code travels in the `x-access-code` header — the URL
 * and the page never carry it. The wait is bounded by `timeoutMs`
 * (default API_TIMEOUT_MS, 0 disables): on expiry the fetch aborts
 * and rejects with an AbortError, which callers surface as their
 * error state. */
export async function apiFetch({
  endpoint,
  options = {},
  timeoutMs = API_TIMEOUT_MS,
}: {
  endpoint: string;
  options?: RequestInit;
  timeoutMs?: number;
}): Promise<Response> {
  const headers: Record<string, string> = {
    ...((options.headers as Record<string, string>) ?? {}),
  };
  const accessCode = readAccessCode();
  if (accessCode) headers["x-access-code"] = accessCode;
  if (!timeoutMs) return fetch(endpoint, { ...options, headers });
  const controller = new AbortController();
  const callerSignal = options.signal;
  if (callerSignal !== null && callerSignal !== undefined) {
    if (callerSignal.aborted) controller.abort();
    else callerSignal.addEventListener("abort", () => controller.abort(), { once: true });
  }
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(endpoint, { ...options, headers, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}
