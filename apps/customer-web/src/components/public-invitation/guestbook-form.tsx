"use client";

import { useId, useRef, useState, type FormEvent } from "react";
import {
  GUESTBOOK_MAX_LENGTH,
  validateGuestbookMessage,
  type GuestbookTransport,
} from "../../lib/guestbook/contract";

type GuestbookFormProps = Readonly<{
  coupleNames: string;
  transport: GuestbookTransport;
}>;

type GuestbookStatus = "idle" | "editing" | "submitting" | "success" | "error";

export function GuestbookForm({ coupleNames, transport }: GuestbookFormProps) {
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<GuestbookStatus>("idle");
  const [error, setError] = useState<string | undefined>();
  const [idempotencyKey, setIdempotencyKey] = useState("");
  const feedbackRef = useRef<HTMLDivElement>(null);
  const messageId = useId();
  const hintId = `${messageId}-hint`;
  const errorId = `${messageId}-error`;

  function updateMessage(value: string) {
    setMessage(value);
    setError(undefined);
    if (status === "success" || status === "error") setIdempotencyKey("");
    if (status !== "success") setStatus(value.length > 0 ? "editing" : "idle");
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validation = validateGuestbookMessage(message);
    if (!validation.valid) {
      setError(validation.message);
      setStatus("error");
      requestAnimationFrame(() => feedbackRef.current?.focus());
      return;
    }

    const nextKey =
      idempotencyKey ||
      globalThis.crypto?.randomUUID?.() ||
      `guest-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    setIdempotencyKey(nextKey);
    setStatus("submitting");
    setError(undefined);
    const result = await transport.submit({
      message: validation.value,
      idempotencyKey: nextKey,
    });
    if (result.kind === "error") {
      setError(result.message);
      setStatus("error");
      requestAnimationFrame(() => feedbackRef.current?.focus());
      return;
    }

    setStatus("success");
    setIdempotencyKey("");
    setMessage("");
    requestAnimationFrame(() => feedbackRef.current?.focus());
  }

  const feedback =
    error ??
    (status === "success" ? "Ucapan terkirim untuk ditinjau." : undefined);

  return (
    <form className="gld-guestbook-form" onSubmit={submit} noValidate>
      <div className="gld-form-field">
        <label htmlFor={messageId}>Ucapan untuk {coupleNames}</label>
        <textarea
          id={messageId}
          value={message}
          maxLength={GUESTBOOK_MAX_LENGTH}
          rows={5}
          aria-describedby={`${hintId}${error ? ` ${errorId}` : ""}`}
          aria-invalid={error ? true : undefined}
          disabled={status === "submitting"}
          onChange={(event) => updateMessage(event.target.value)}
          placeholder="Tulis doa dan ucapan Anda di sini…"
        />
        <div className="gld-guestbook-form__meta" id={hintId}>
          <span>Ucapan akan ditinjau sebelum tampil di undangan.</span>
          <span aria-live="polite">
            {message.length}/{GUESTBOOK_MAX_LENGTH}
          </span>
        </div>
      </div>
      {feedback ? (
        <div
          className={`gld-form-feedback${status === "success" ? " gld-form-feedback--success" : ""}`}
          id={error ? errorId : undefined}
          ref={feedbackRef}
          tabIndex={-1}
          role={status === "success" ? "status" : "alert"}
          aria-live="polite"
        >
          {feedback}
        </div>
      ) : null}
      <button
        className="gld-button gld-button--secondary"
        type="submit"
        disabled={status === "submitting"}
      >
        {status === "submitting" ? "Mengirim…" : "Kirim ucapan"}
      </button>
    </form>
  );
}
