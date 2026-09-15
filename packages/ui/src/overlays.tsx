"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { cx } from "./cx";
import { IconClose } from "./icons";
import { Button, type ButtonVariant } from "./button";

type OverlayProps = {
  triggerLabel: string;
  triggerVariant?: ButtonVariant;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
};

function useNativeDialog() {
  const [open, setOpen] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
  }, [open]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const handleClose = () => {
      setOpen(false);
      triggerRef.current?.focus();
    };
    dialog.addEventListener("close", handleClose);
    return () => dialog.removeEventListener("close", handleClose);
  }, []);

  // Cadangan Escape untuk lingkungan tanpa CloseWatcher (mis. jsdom).
  useEffect(() => {
    if (!open) return;
    const handleKeydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") dialogRef.current?.close();
    };
    document.addEventListener("keydown", handleKeydown);
    return () => document.removeEventListener("keydown", handleKeydown);
  }, [open]);

  const requestClose = () => dialogRef.current?.close();

  return { open, setOpen, dialogRef, triggerRef, requestClose };
}

export function Dialog({ triggerLabel, triggerVariant = "secondary", title, children, footer }: OverlayProps) {
  const id = useId();
  const { open, setOpen, dialogRef, triggerRef, requestClose } = useNativeDialog();

  return (
    <>
      <Button
        ref={triggerRef}
        variant={triggerVariant}
        onClick={() => setOpen(true)}
        aria-expanded={open}
        aria-controls={id}
        aria-haspopup="dialog"
      >
        {triggerLabel}
      </Button>
      <dialog
        ref={dialogRef}
        id={id}
        className="ui-dialog"
        aria-labelledby={`${id}-title`}
        onClick={(event) => {
          if (event.target === dialogRef.current) requestClose();
        }}
      >
        <header className="ui-overlay__header">
          <h2 className="ui-overlay__title" id={`${id}-title`}>
            {title}
          </h2>
          <button type="button" className="ui-overlay__close" aria-label="Tutup" onClick={requestClose}>
            <IconClose />
          </button>
        </header>
        <div className="ui-overlay__body">{children}</div>
        {footer ? <footer className="ui-overlay__footer">{footer}</footer> : null}
      </dialog>
    </>
  );
}

export function Drawer({
  triggerLabel,
  triggerVariant = "secondary",
  title,
  children,
  side = "right",
}: OverlayProps & { side?: "left" | "right" }) {
  const id = useId();
  const { open, setOpen, dialogRef, triggerRef, requestClose } = useNativeDialog();

  return (
    <>
      <Button
        ref={triggerRef}
        variant={triggerVariant}
        onClick={() => setOpen(true)}
        aria-expanded={open}
        aria-controls={id}
        aria-haspopup="dialog"
      >
        {triggerLabel}
      </Button>
      <dialog
        ref={dialogRef}
        id={id}
        className={cx("ui-drawer", side === "left" ? "ui-drawer--left" : "ui-drawer--right")}
        aria-labelledby={`${id}-title`}
        onClick={(event) => {
          if (event.target === dialogRef.current) requestClose();
        }}
      >
        <header className="ui-overlay__header">
          <h2 className="ui-overlay__title" id={`${id}-title`}>
            {title}
          </h2>
          <button type="button" className="ui-overlay__close" aria-label="Tutup" onClick={requestClose}>
            <IconClose />
          </button>
        </header>
        <div className="ui-overlay__body">{children}</div>
      </dialog>
    </>
  );
}
