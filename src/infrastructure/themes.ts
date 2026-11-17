// The selectable themes (issue #233): each theme is a set of classes
// applied on <html> — "dark" reuses the existing .dark variant, the
// others add a theme class whose palette overrides live in index.css.
// The choice is persisted in localStorage (per browser; a per-user
// storage would need a server preference, not built yet).

export type ThemeId = "light" | "dark" | "nord" | "dracula" | "solarized" | "forest";

export interface ThemeDefinition {
  id: ThemeId;
  /** Label shown in the header picker. */
  label: string;
  /** Classes applied on <html> for this theme. */
  classes: readonly string[];
  /** Whether the theme is dark-based (native controls, scrollbars). */
  dark: boolean;
}

export const THEMES: readonly ThemeDefinition[] = [
  { id: "light", label: "Light", classes: [], dark: false },
  { id: "dark", label: "Dark", classes: ["dark"], dark: true },
  { id: "nord", label: "Nord", classes: ["dark", "theme-nord"], dark: true },
  { id: "dracula", label: "Dracula", classes: ["dark", "theme-dracula"], dark: true },
  { id: "solarized", label: "Solarized", classes: ["theme-solarized"], dark: false },
  { id: "forest", label: "Forest", classes: ["theme-forest"], dark: false },
];

export const THEME_STORAGE_KEY = "ld-theme";

export function themeDefinition({ id }: { id: ThemeId }): ThemeDefinition {
  const found = THEMES.find((theme) => theme.id === id);
  if (found === undefined) throw new Error("unknown theme: " + id);
  return found;
}

/** The stored theme, or null when never chosen. */
export function readStoredTheme(): ThemeId | null {
  const stored = localStorage.getItem(THEME_STORAGE_KEY);
  return stored !== null && THEMES.some((theme) => theme.id === stored)
    ? (stored as ThemeId)
    : null;
}

/** The default theme: the system preference (dark when the OS is dark). */
export function defaultTheme(): ThemeId {
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

/** Apply a theme on <html>: remove every theme class, add the theme's. */
export function applyTheme({ id }: { id: ThemeId }): void {
  const classes = document.documentElement.classList;
  for (const theme of THEMES) {
    for (const themeClass of theme.classes) classes.remove(themeClass);
  }
  for (const themeClass of themeDefinition({ id }).classes) classes.add(themeClass);
}
