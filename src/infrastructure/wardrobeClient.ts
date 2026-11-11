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

/** One call to the proxy API, with the access code attached when
 * present. The code travels in the `x-access-code` header — the URL
 * and the page never carry it. */
export async function apiFetch({ endpoint, options = {} }: { endpoint: string; options?: RequestInit }): Promise<Response> {
  const headers: Record<string, string> = {
    ...((options.headers as Record<string, string>) ?? {}),
  };
  const accessCode = readAccessCode();
  if (accessCode) headers["x-access-code"] = accessCode;
  return fetch(endpoint, { ...options, headers });
}
