"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { GuestContext } from "../../lib/public-invitation/guest-context";
import type {
  RsvpAnswer,
  RsvpDraft,
  RsvpDraftAnswer,
  RsvpTransport,
} from "../../lib/rsvp/contract";
import { GuestRsvpEventCard } from "./guest-rsvp-event-card";
import {
  GuestAccessStateMessage,
  LockedRsvpMessage,
} from "./guest-access-state";

type GuestRsvpProps = Readonly<{
  context: GuestContext;
  transport: RsvpTransport;
}>;

type RsvpFormStatus = "idle" | "submitting" | "success" | "error";

type EventErrors = Readonly<Record<string, string>>;

function initialAnswers(
  context: GuestContext,
): Record<string, RsvpAnswer | undefined> {
  return Object.fromEntries(
    context.events.map((event) => [event.id, event.existingResponse]),
  );
}

function initialDraft(
  context: GuestContext,
  answers: Record<string, RsvpAnswer | undefined>,
): RsvpDraft {
  return Object.fromEntries(
    context.events.map((event) => {
      const saved = answers[event.id];
      return [
        event.id,
        saved
          ? { response: saved.response, pax: saved.pax }
          : { response: null, pax: null },
      ];
    }),
  );
}

function validateDraft(
  context: GuestContext,
  draft: RsvpDraft,
): { valid: true } | { valid: false; errors: EventErrors } {
  const errors: Record<string, string> = {};
  for (const event of context.events) {
    const answer = draft[event.id];
    if (!answer?.response) {
      errors[event.id] = "Pilih jawaban untuk acara ini.";
      continue;
    }
    if (
      answer.response === "ATTENDING" &&
      (!answer.pax || answer.pax < 1 || answer.pax > context.maxPax)
    ) {
      errors[event.id] =
        `Jumlah tamu harus antara 1 dan ${context.maxPax} orang.`;
    }
  }
  return Object.keys(errors).length === 0
    ? { valid: true }
    : { valid: false, errors };
}

function sameAsSaved(
  context: GuestContext,
  draft: RsvpDraft,
  answers: Record<string, RsvpAnswer | undefined>,
): boolean {
  return context.events.every((event) => {
    const saved = answers[event.id];
    const current = draft[event.id];
    if (!saved || !current) return !saved && !current?.response;
    return saved.response === current.response && saved.pax === current.pax;
  });
}

export function GuestRsvp({ context, transport }: GuestRsvpProps) {
  const [answers, setAnswers] = useState(() => initialAnswers(context));
  const [draft, setDraft] = useState<RsvpDraft>(() =>
    initialDraft(context, initialAnswers(context)),
  );
  const [status, setStatus] = useState<RsvpFormStatus>("idle");
  const [errors, setErrors] = useState<EventErrors>({});
  const [formError, setFormError] = useState<string | undefined>();
  const [idempotencyKey, setIdempotencyKey] = useState("");
  const errorSummaryRef = useRef<HTMLDivElement>(null);
  const headingId = useId();
  const errorSummaryId = `${headingId}-errors`;
  const isLocked = context.state === "locked";
  const isUnavailable = context.events.length === 0;
  const isSaved = Object.values(answers).some(Boolean);
  const isUnchanged = sameAsSaved(context, draft, answers);

  useEffect(() => {
    if (status === "error") {
      requestAnimationFrame(() => errorSummaryRef.current?.focus());
    }
  }, [status]);

  function updateEvent(eventId: string, value: RsvpDraftAnswer) {
    setDraft((current) => ({ ...current, [eventId]: value }));
    setErrors((current) => {
      const next = { ...current };
      delete next[eventId];
      return next;
    });
    setFormError(undefined);
    if (status === "success" || status === "error") setIdempotencyKey("");
    if (status !== "idle") setStatus("idle");
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validation = validateDraft(context, draft);
    if (!validation.valid) {
      setErrors(validation.errors);
      setFormError("Lengkapi jawaban untuk setiap acara sebelum menyimpan.");
      setStatus("error");
      return;
    }

    const nextKey =
      idempotencyKey ||
      globalThis.crypto?.randomUUID?.() ||
      `guest-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    setIdempotencyKey(nextKey);
    setStatus("submitting");
    setFormError(undefined);
    const result = await transport.submit({
      idempotencyKey: nextKey,
      updates: context.events.map((event) => {
        const value = draft[event.id];
        const saved = answers[event.id];
        return {
          eventId: event.id,
          response: value?.response ?? "DECLINED",
          pax: value?.response === "ATTENDING" ? (value.pax ?? 0) : 0,
          expectedVersion: saved?.optimisticVersion ?? null,
        };
      }),
    });

    if (result.kind === "error") {
      setFormError(result.message);
      setStatus("error");
      return;
    }

    const nextAnswers: Record<string, RsvpAnswer | undefined> = { ...answers };
    result.answers.forEach((answer, index) => {
      const event = context.events[index];
      if (event) nextAnswers[event.id] = answer;
    });
    setAnswers(nextAnswers);
    setStatus("success");
  }

  return (
    <section
      className="gld-guest-rsvp"
      id="guest-rsvp"
      aria-labelledby={headingId}
    >
      <p className="gld-kicker">Khusus untuk tamu undangan</p>
      <h2 id={headingId}>Konfirmasi kehadiran</h2>
      {context.greetingName ? (
        <p className="gld-guest-rsvp__greeting">
          Halo, {context.greetingName}.
        </p>
      ) : null}
      <p className="gld-copy">
        Mohon berikan jawaban untuk setiap acara yang tercantum. Jawaban Anda
        membantu kami menyiapkan hari ini dengan baik.
      </p>
      {context.rsvpDeadlineLabel ? (
        <p className="gld-guest-rsvp__deadline">
          Konfirmasi paling lambat <strong>{context.rsvpDeadlineLabel}</strong>.
        </p>
      ) : null}
      <GuestAccessStateMessage context={context} />
      {isLocked ? <LockedRsvpMessage /> : null}

      {isUnavailable ? null : (
        <form className="gld-guest-rsvp__form" onSubmit={submit} noValidate>
          {formError ? (
            <div
              className="gld-form-feedback"
              id={errorSummaryId}
              ref={errorSummaryRef}
              tabIndex={-1}
              role="alert"
              aria-live="assertive"
            >
              {formError}
            </div>
          ) : null}
          <div className="gld-guest-rsvp__events">
            {context.events.map((event) => (
              <GuestRsvpEventCard
                key={event.id}
                event={event}
                maxPax={context.maxPax}
                value={draft[event.id] ?? { response: null, pax: null }}
                savedAnswer={answers[event.id]}
                disabled={isLocked || status === "submitting"}
                error={errors[event.id]}
                onChange={(value) => updateEvent(event.id, value)}
              />
            ))}
          </div>
          <div className="gld-guest-rsvp__actions">
            {status === "success" ? (
              <div
                className="gld-form-feedback gld-form-feedback--success"
                role="status"
                aria-live="polite"
              >
                Jawaban kehadiran berhasil disimpan. Anda dapat mengubahnya
                selama konfirmasi masih dibuka.
              </div>
            ) : null}
            <button
              className="gld-button"
              type="submit"
              disabled={
                isLocked || status === "submitting" || (isSaved && isUnchanged)
              }
            >
              {status === "submitting"
                ? "Menyimpan…"
                : isSaved
                  ? "Simpan perubahan"
                  : "Simpan jawaban"}
            </button>
            {isSaved && isUnchanged && !isLocked ? (
              <p className="gld-muted">
                Jawaban Anda sudah tersimpan. Pilih jawaban di atas untuk
                mengubahnya.
              </p>
            ) : null}
          </div>
        </form>
      )}
    </section>
  );
}
