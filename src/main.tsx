import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { initI18n } from "./infrastructure/i18n";
import { readWorkshopLanguage } from "./infrastructure/browserLanguage";
import "./index.css";

initI18n({ language: readWorkshopLanguage() });

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
);
