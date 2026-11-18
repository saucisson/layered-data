// Simple hash-based router for Layered Data
//
// The hash carries the page and, when a page names one thing, its
// parameter: #formalism/wb1 opens the formalism page on wb1 — the
// address is the artifact, the URL stays the state.

import React, { createContext, useContext, useEffect, useState } from "react";

export type Page =
  | "landing"
  | "tutorial"
  | "filiation"
  | "formalisms"
  | "hierarchy"
  | "creation"
  | "formalism"
  | "models"
  | "lenses"
  | "install"
  | "notfound";

/** The pages the router serves — the landing page is the home. */
const PAGES: readonly Page[] = [
  "landing",
  "tutorial",
  "filiation",
  "formalisms",
  "hierarchy",
  "creation",
  "formalism",
  "models",
  "lenses",
  "install",
];

interface RouterContextType {
  page: Page;
  parameter: string;
  navigate: (page: Page, parameter?: string) => void;
}

const RouterContext = createContext<RouterContextType | null>(null);

interface RouterProviderProps {
  children: React.ReactNode;
}

/** The hash a page navigation points to — plain anchors use it, so
 *  page changes are real links (middle-click, copy link, hover URL). */
export function hashOf(page: Page, parameter?: string): string {
  return parameter !== undefined && parameter !== "" ? "#" + page + "/" + parameter : "#" + page;
}

export function RouterProvider({ children }: RouterProviderProps) {
  const [page, setPage] = useState<Page>("landing");
  const [parameter, setParameter] = useState("");

  useEffect(() => {
    const parseHash = () => {
      const hash = window.location.hash.slice(1) || "landing";
      const [hashPage = "", ...hashSegments] = hash.split("/");
      if ((PAGES as readonly string[]).includes(hashPage)) {
        setPage(hashPage as Page);
        setParameter(hashSegments.join("/"));
      } else {
        setPage("notfound");
        setParameter(hash);
      }
    };

    parseHash();
    window.addEventListener("hashchange", parseHash);
    return () => window.removeEventListener("hashchange", parseHash);
  }, []);

  const navigate = (newPage: Page, newParameter?: string) => {
    window.location.hash = hashOf(newPage, newParameter).slice(1);
  };

  return (
    <RouterContext.Provider value={{ page, parameter, navigate }}>
      {children}
    </RouterContext.Provider>
  );
}

export function useRouter() {
  const context = useContext(RouterContext);
  if (!context) {
    throw new Error("useRouter must be used within a RouterProvider");
  }
  return context;
}
