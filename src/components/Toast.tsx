// Toast notification system — transient feedback messages that appear
// bottom-right and auto-dismiss. Accessible: role=status + aria-live
// so screen readers announce them (WCAG 4.1.3). Errors stay longer,
// every toast can be dismissed by hand, and the timer pauses while
// the pointer or the focus is on the toast.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

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

// errors deserve to be read: they stay 10 s, the other tones 4 s
const DURATION_MS: Record<ToastTone, number> = { info: 4000, success: 4000, error: 10000 };

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: (id: number) => void }) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const deadlineRef = useRef(0);
  const remainingRef = useRef(0);
  const [, setPaused] = useState(false);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const schedule = useCallback(
    (milliseconds: number) => {
      clearTimer();
      deadlineRef.current = Date.now() + milliseconds;
      timerRef.current = setTimeout(() => onDismiss(toast.id), milliseconds);
    },
    [clearTimer, onDismiss, toast.id],
  );

  useEffect(() => {
    schedule(DURATION_MS[toast.tone]);
    return clearTimer;
  }, [schedule, clearTimer, toast.tone]);

  const pause = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimer();
      remainingRef.current = Math.max(0, deadlineRef.current - Date.now());
      setPaused(true);
    }
  }, [clearTimer]);

  const resume = useCallback(() => {
    setPaused((wasPaused) => {
      if (wasPaused) schedule(remainingRef.current);
      return false;
    });
  }, [schedule]);

  return (
    <div
      className={
        "pointer-events-auto rounded-md border px-3 py-2 text-xs shadow-lg " + TONE_CLASS[toast.tone]
      }
      onMouseEnter={pause}
      onMouseLeave={resume}
      onFocus={pause}
      onBlur={resume}
    >
      <div className="flex items-start gap-2">
        <span className="min-w-0 flex-1">{toast.text}</span>
        <button
          type="button"
          onClick={() => onDismiss(toast.id)}
          aria-label="dismiss notification"
          className="shrink-0 rounded px-1 leading-none opacity-60 hover:opacity-100 focus:opacity-100 focus:outline-none"
        >
          ×
        </button>
      </div>
    </div>
  );
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: number) => {
    setToasts((previous) => previous.filter((toast) => toast.id !== id));
  }, []);

  const notify = useCallback((text: string, tone: ToastTone = "info") => {
    const id = Date.now() + Math.random();
    setToasts((previous) => [...previous, { id, text, tone }]);
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
          <ToastItem key={toast.id} toast={toast} onDismiss={dismiss} />
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
