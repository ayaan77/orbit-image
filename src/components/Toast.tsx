"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
} from "react";
import styles from "./Toast.module.css";

type ToastType = "success" | "error" | "info";

interface ToastItem {
  readonly id: string;
  readonly message: string;
  readonly type: ToastType;
  readonly duration: number;
}

interface ToastContextValue {
  readonly showToast: (
    message: string,
    type?: ToastType,
    duration?: number,
  ) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within a ToastProvider");
  return ctx;
}

export function ToastProvider({ children }: { readonly children: React.ReactNode }) {
  const [toasts, setToasts] = useState<readonly ToastItem[]>([]);
  const idCounter = useRef(0);

  const showToast = useCallback(
    (message: string, type: ToastType = "info", duration: number = 3000) => {
      const id = String(++idCounter.current);
      setToasts((prev) => {
        const updated = [...prev, { id, message, type, duration }];
        // Keep max 3 visible
        return updated.length > 3 ? updated.slice(-3) : updated;
      });
    },
    [],
  );

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className={styles.container} role="status">
        {toasts.map((toast) => (
          <ToastItemView key={toast.id} toast={toast} onDismiss={dismiss} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastItemView({
  toast,
  onDismiss,
}: {
  readonly toast: ToastItem;
  readonly onDismiss: (id: string) => void;
}) {
  useEffect(() => {
    const timer = setTimeout(() => onDismiss(toast.id), toast.duration);
    return () => clearTimeout(timer);
  }, [toast.id, toast.duration, onDismiss]);

  const iconMap: Record<ToastType, string> = {
    success: "\u2713",
    error: "\u2717",
    info: "\u2139",
  };

  return (
    <div
      className={`${styles.toast} ${styles[toast.type]}`}
      aria-live={toast.type === "error" ? "assertive" : "polite"}
      role={toast.type === "error" ? "alert" : "status"}
    >
      <span className={styles.icon}>{iconMap[toast.type]}</span>
      <span className={styles.message}>{toast.message}</span>
      <button
        className={styles.close}
        onClick={() => onDismiss(toast.id)}
        aria-label="Dismiss notification"
      >
        {"\u00D7"}
      </button>
      <div
        className={styles.progress}
        style={{ animationDuration: `${toast.duration}ms` }}
      />
    </div>
  );
}
