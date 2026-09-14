import type { GuestEvent } from "../../lib/public-invitation/guest-context";
import type {
  RsvpAnswer,
  RsvpDraftAnswer,
  RsvpResponse,
} from "../../lib/rsvp/contract";
import { responseLabel } from "../../lib/rsvp/contract";

type GuestRsvpEventCardProps = Readonly<{
  event: GuestEvent;
  maxPax: number;
  value: RsvpDraftAnswer;
  savedAnswer?: RsvpAnswer | undefined;
  disabled: boolean;
  error?: string | undefined;
  onChange: (value: RsvpDraftAnswer) => void;
}>;

const RESPONSE_OPTIONS: readonly { value: RsvpResponse; label: string }[] = [
  { value: "ATTENDING", label: "Hadir" },
  { value: "TENTATIVE", label: "Masih tentatif" },
  { value: "DECLINED", label: "Tidak dapat hadir" },
];

export function GuestRsvpEventCard({
  event,
  maxPax,
  value,
  savedAnswer,
  disabled,
  error,
  onChange,
}: GuestRsvpEventCardProps) {
  const titleId = `gld-event-${event.id}-title`;
  const hintId = `gld-event-${event.id}-hint`;
  const errorId = `gld-event-${event.id}-error`;
  const paxId = `gld-event-${event.id}-pax`;
  const describedBy = error ? `${hintId} ${errorId}` : hintId;

  function selectResponse(response: RsvpResponse) {
    const pax =
      response === "ATTENDING"
        ? value.pax && value.pax > 0
          ? value.pax
          : 1
        : 0;
    onChange({ response, pax });
  }

  return (
    <fieldset
      className={`gld-guest-event${error ? " gld-guest-event--error" : ""}`}
    >
      <legend id={titleId}>{event.title}</legend>
      <div className="gld-guest-event__meta" id={hintId}>
        <time dateTime={event.startsAt}>
          {event.dateLabel} · {event.timeLabel} {event.timezoneLabel}
        </time>
        <strong>{event.venueName}</strong>
        {event.address ? <span>{event.address}</span> : null}
        {event.mapUrl ? (
          <a href={event.mapUrl} target="_blank" rel="noreferrer">
            Buka peta <span aria-hidden="true">↗</span>
          </a>
        ) : null}
      </div>

      {savedAnswer ? (
        <p className="gld-guest-event__saved" role="status">
          Jawaban tersimpan: {responseLabel(savedAnswer.response)}
          {savedAnswer.response === "ATTENDING"
            ? `, ${savedAnswer.pax} orang`
            : ""}
          .
        </p>
      ) : null}

      <div className="gld-guest-event__choices" aria-describedby={describedBy}>
        {RESPONSE_OPTIONS.map((option) => (
          <label className="gld-choice" key={option.value}>
            <input
              type="radio"
              name={`rsvp-${event.id}`}
              value={option.value}
              checked={value.response === option.value}
              disabled={disabled}
              onChange={() => selectResponse(option.value)}
            />
            <span>{option.label}</span>
          </label>
        ))}
      </div>

      {value.response === "ATTENDING" ? (
        <label className="gld-guest-event__pax" htmlFor={paxId}>
          <span>Jumlah tamu</span>
          <select
            id={paxId}
            value={value.pax ?? ""}
            disabled={disabled}
            aria-describedby={describedBy}
            onChange={(eventValue) =>
              onChange({ ...value, pax: Number(eventValue.target.value) })
            }
          >
            {Array.from({ length: maxPax }, (_, index) => index + 1).map(
              (pax) => (
                <option value={pax} key={pax}>
                  {pax} {pax === 1 ? "orang" : "orang"}
                </option>
              ),
            )}
          </select>
          <small>Maksimal {maxPax} orang untuk undangan ini.</small>
        </label>
      ) : null}

      {error ? (
        <p className="gld-field-error" id={errorId} role="alert">
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}
