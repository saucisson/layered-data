// Simple hash-based router for Layered Data

import React, { createContext, useContext, useEffect, useState } from "react";

type Page = "landing" | "tutorial" | "filiation" | "workshop";

interface RouterContextType {
  page: Page;
  navigate: (page: Page) => void;
}

const RouterContext = createContext<RouterContextType | null>(null);

interface RouterProviderProps {
  children: React.ReactNode;
}

export function RouterProvider({ children }: RouterProviderProps) {
  const [page, setPage] = useState<Page>("landing");

  useEffect(() => {
    const parseHash = () => {
      const hash = window.location.hash.slice(1) || "landing";
      if (["landing", "tutorial", "filiation", "workshop"].includes(hash)) {
        setPage(hash as Page);
      } else {
        setPage("landing");
      }
    };

    parseHash();
    window.addEventListener("hashchange", parseHash);
    return () => window.removeEventListener("hashchange", parseHash);
  }, []);

  const navigate = (newPage: Page) => {
    window.location.hash = newPage;
  };

  return (
    <RouterContext.Provider value={{ page, navigate }}>
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
