// ErrorBoundary: the last wall before the white screen. A render error
// thrown by any panel is caught here, logged as a window event (console
// is banned in src/), and replaced by a localized fallback with a reload
// button.

import React from "react";

import { t } from "../infrastructure/i18n.ts";

/** The window event the boundary emits when it catches an error — the
 * app's error log channel, observable by tests and host pages. */
export const ERROR_BOUNDARY_EVENT = "layered-data:error-boundary";

type ErrorBoundaryProps = {
  children: React.ReactNode;
};

type ErrorBoundaryState = {
  error: Error | null;
};

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    window.dispatchEvent(
      new CustomEvent(ERROR_BOUNDARY_EVENT, {
        detail: { message: error.message, componentStack: info.componentStack },
      }),
    );
  }

  render() {
    if (this.state.error !== null) {
      return (
        <div role="alert" className="flex min-h-screen flex-col items-center justify-center gap-4 p-8 text-center">
          <p className="text-lg">{t("something went wrong — the atelier hit an unexpected error")}</p>
          <button
            type="button"
            className="rounded border border-slate-400 px-4 py-2 hover:bg-slate-100 dark:bg-slate-800"
            onClick={() => window.location.reload()}
          >
            {t("reload")}
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
