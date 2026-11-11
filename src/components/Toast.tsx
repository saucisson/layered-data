// Toast notification system — transient feedback messages that appear
// bottom-right and auto-dismiss. Accessible: role=status + aria-live
// so screen readers announce them (WCAG 4.1.3).

import { createContext, useCallback, useContext, useState, type ReactNode } from "react";

type ToastTone = "info" | "success" | "error";

interface Toast {
  id: number;
  text: string;
  tone: ToastTone;
}

interface ToastContextType {
  notify: (text: string, tone?: ToastTone) => void;
}

const ToastContext = createContext<ToastContextType | null>(null);

const TONE_CLASS: Record<ToastTone, string> = {
  info: "border-sky-300 bg-sky-50 text-sky-800 dark:border-sky-700 dark:bg-sky-900 dark:text-sky-200",
  success: "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-700 dark:bg-emerald-900 dark:text-emerald-200",
  error: "border-red-300 bg-red-50 text-red-800 dark:border-red-700 dark:bg-red-900 dark:text-red-200",
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const notify = useCallback((text: string, tone: ToastTone = "info") => {
    const id = Date.now() + Math.random();
    setToasts((previous) => [...previous, { id, text, tone }]);
    setTimeout(() => {
      setToasts((previous) => previous.filter((toast) => toast.id !== id));
    }, 4000);
  }, []);

  return (
    <ToastContext.Provider value={{ notify }}>
      {children}
      <div
        className="pointer-events-none fixed bottom-4 right-4 z-[100] flex w-72 flex-col gap-2"
        role="status"
        aria-live="polite"
        aria-atomic="false"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={
              "pointer-events-auto rounded-md border px-3 py-2 text-xs shadow-lg " + TONE_CLASS[toast.tone]
            }
          >
            {toast.text}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast must be used within a ToastProvider");
  return context;
}
