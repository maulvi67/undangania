"use client";

import { useEffect, useId, useRef, type ReactNode, type RefObject } from "react";
import { Button } from "@wedding/ui";

export function GuestDialog({
  id,
  open,
  title,
  description,
  children,
  onClose,
  triggerRef,
}: {
  /**
   * Identitas elemen dialog. Pemanggil perlu mengetahuinya untuk mengaitkan
   * tombol pemicu melalui `aria-controls`, karena pemicu dirender di luar
   * komponen ini.
   */
  id?: string;
  open: boolean;
  title: string;
  description?: string;
  children: ReactNode;
  onClose: () => void;
  triggerRef?: RefObject<HTMLElement | null>;
}) {
  const generatedId = useId();
  const dialogId = id ?? generatedId;
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const handleClose = () => {
      onClose();
      window.setTimeout(() => triggerRef?.current?.focus(), 0);
    };
    dialog.addEventListener("close", handleClose);
    return () => dialog.removeEventListener("close", handleClose);
  }, [onClose, triggerRef]);

  return (
    <dialog
      ref={dialogRef}
      id={dialogId}
      className="gst-dialog"
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      onClick={(event) => {
        if (event.target === dialogRef.current) onClose();
      }}
    >
      <div className="gst-dialog__panel">
        <header className="gst-dialog__header">
          <div>
            <h2 id={titleId}>{title}</h2>
            {description ? <p id={descriptionId}>{description}</p> : null}
          </div>
          <button type="button" className="gst-dialog__close" aria-label="Tutup" onClick={onClose}>
            ×
          </button>
        </header>
        <div className="gst-dialog__body">{children}</div>
      </div>
    </dialog>
  );
}

export function GuestConfirmDialog({
  id,
  open,
  title,
  description,
  confirmLabel,
  danger = false,
  onConfirm,
  onClose,
  triggerRef,
}: {
  id?: string;
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  danger?: boolean;
  onConfirm: () => void;
  onClose: () => void;
  triggerRef?: RefObject<HTMLElement | null>;
}) {
  return (
    <GuestDialog
      {...(id ? { id } : {})}
      open={open}
      title={title}
      description={description}
      onClose={onClose}
      {...(triggerRef ? { triggerRef } : {})}
    >
      <div className="gst-dialog__actions">
        <Button type="button" variant="secondary" onClick={onClose}>Batalkan</Button>
        <Button type="button" variant={danger ? "danger" : "primary"} onClick={onConfirm}>{confirmLabel}</Button>
      </div>
    </GuestDialog>
  );
}
