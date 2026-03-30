"use client";

import type { ReactElement } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import styles from "./ConfirmModal.module.css";

/* ─── Types ─── */

interface ConfirmModalProps {
  readonly isOpen: boolean;
  readonly title: string;
  readonly message: string;
  readonly confirmLabel?: string;
  readonly cancelLabel?: string;
  readonly variant?: "danger" | "warning" | "default";
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
}

/* ─── Component ─── */

export function ConfirmModal({
  isOpen,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "default",
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  const confirmRef = useRef<HTMLButtonElement>(null);

  /* Focus the confirm button when the modal opens */
  useEffect(() => {
    if (isOpen) {
      confirmRef.current?.focus();
    }
  }, [isOpen]);

  /* Escape key closes the modal */
  useEffect(() => {
    if (!isOpen) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onCancel();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onCancel]);

  if (!isOpen) return null;

  const confirmClass =
    variant === "danger"
      ? styles.btnConfirmDanger
      : variant === "warning"
        ? styles.btnConfirmWarning
        : styles.btnConfirmDefault;

  return (
    <>
      {/* Overlay — click to cancel */}
      <div
        className={styles.overlay}
        onClick={onCancel}
        aria-hidden="true"
      />

      {/* Modal */}
      <div
        className={styles.modal}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-modal-title"
        aria-describedby="confirm-modal-message"
      >
        <h2 id="confirm-modal-title" className={styles.title}>
          {title}
        </h2>
        <p id="confirm-modal-message" className={styles.message}>
          {message}
        </p>
        <div className={styles.actions}>
          <button
            type="button"
            className={`${styles.btn} ${styles.btnCancel}`}
            onClick={onCancel}
          >
            {cancelLabel}
          </button>
          <button
            ref={confirmRef}
            type="button"
            className={`${styles.btn} ${confirmClass}`}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </>
  );
}

/* ─── useConfirm Hook ─── */

interface ConfirmOptions {
  readonly title: string;
  readonly message: string;
  readonly variant?: "danger" | "warning" | "default";
  readonly confirmLabel?: string;
  readonly cancelLabel?: string;
}

interface ConfirmState extends ConfirmOptions {
  readonly resolve: (value: boolean) => void;
}

export function useConfirm(): {
  confirm: (opts: ConfirmOptions) => Promise<boolean>;
  ConfirmDialog: () => ReactElement | null;
} {
  const [state, setState] = useState<ConfirmState | null>(null);

  const confirm = useCallback(
    (opts: ConfirmOptions): Promise<boolean> =>
      new Promise<boolean>((resolve) => {
        setState({ ...opts, resolve });
      }),
    [],
  );

  const handleConfirm = useCallback(() => {
    state?.resolve(true);
    setState(null);
  }, [state]);

  const handleCancel = useCallback(() => {
    state?.resolve(false);
    setState(null);
  }, [state]);

  const ConfirmDialog = useCallback(
    () =>
      state ? (
        <ConfirmModal
          isOpen
          title={state.title}
          message={state.message}
          variant={state.variant}
          confirmLabel={state.confirmLabel}
          cancelLabel={state.cancelLabel}
          onConfirm={handleConfirm}
          onCancel={handleCancel}
        />
      ) : null,
    [state, handleConfirm, handleCancel],
  );

  return { confirm, ConfirmDialog };
}
