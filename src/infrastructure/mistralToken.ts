// The personal Mistral API token (LD-8, ADR-0120 §3): browser-side
// ONLY — localStorage, never in a URL, never logged, never returned in
// a response. It travels solely as the `x-mistral-api-token` header on
// the generation calls (the plume), read by streamGenerate.

export const MISTRAL_TOKEN_STORAGE_KEY = "ld-mistral-api-token";

/** The stored personal token, or null when none is set. */
export function readMistralToken(): string | null {
  const value = localStorage.getItem(MISTRAL_TOKEN_STORAGE_KEY);
  return typeof value === "string" && value !== "" ? value : null;
}

/** Store (or replace) the personal token. An empty value clears it. */
export function writeMistralToken({ token }: { token: string }): void {
  if (token === "") {
    localStorage.removeItem(MISTRAL_TOKEN_STORAGE_KEY);
  } else {
    // Browser-side storage is the accepted design (ADR-0120 §3): the token
    // never leaves the client except as the x-mistral-api-token header.
    // codeql[js/clear-text-storage-of-sensitive-information]
    localStorage.setItem(MISTRAL_TOKEN_STORAGE_KEY, token);
  }
}

/** Remove the personal token. */
export function clearMistralToken(): void {
  localStorage.removeItem(MISTRAL_TOKEN_STORAGE_KEY);
}
