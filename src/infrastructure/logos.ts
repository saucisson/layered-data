// The selectable logo variants (issue #234): persisted in localStorage
// like the theme (per browser; a per-user storage would need a server
// preference, not built yet).

export type LogoId = "classic" | "stack" | "diamond" | "mono" | "wave" | "artwork";

export interface LogoDefinition {
  id: LogoId;
  label: string;
}

export const LOGOS: readonly LogoDefinition[] = [
  { id: "classic", label: "Classic" },
  { id: "stack", label: "Stack" },
  { id: "diamond", label: "Diamond" },
  { id: "mono", label: "Mono" },
  { id: "wave", label: "Wave" },
  { id: "artwork", label: "Artwork" },
];

export const LOGO_STORAGE_KEY = "ld-logo";

/** The stored logo variant, defaulting to the classic one. */
export function readStoredLogo(): LogoId {
  const stored = localStorage.getItem(LOGO_STORAGE_KEY);
  return stored !== null && LOGOS.some((logo) => logo.id === stored)
    ? (stored as LogoId)
    : "classic";
}
