// The infrastructure of the shared formalisms: the disk quarry
// (the server's formalism files) and the access code that protects
// it — never the workshop itself, which lives alone in the browser.
//
// The access code is entered once, kept by the browser (localStorage),
// sent with every call — never in the URL, never in the page.

/** The localStorage key of the access code. */
const ACCESS_CODE_STORAGE_KEY = "code-acces-atelier";

/** Read the stored access code. Storage can be unavailable (private
 * browsing, blocked cookies): the code is then empty, never an
 * exception. */
export function readAccessCode(): string {
  try {
    return localStorage.getItem(ACCESS_CODE_STORAGE_KEY) ?? "";
  } catch {
    return "";
  }
}

/** Remember (or forget, when empty) the access code for the next
 * visits. */
export function writeAccessCode({ accessCode }: { accessCode: string }): void {
  try {
    const trimmed = accessCode.trim();
    if (trimmed) {
      localStorage.setItem(ACCESS_CODE_STORAGE_KEY, trimmed);
    } else {
      localStorage.removeItem(ACCESS_CODE_STORAGE_KEY);
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
