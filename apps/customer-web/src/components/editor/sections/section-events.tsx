import { Button, Input, Select } from "@wedding/ui";
import type { EditorContent, EditorEvent } from "../../../lib/editor/contract";
import type { EditorPatch } from "../editor-form";

const TIMEZONES = [
  { value: "Asia/Jakarta", label: "WIB — Asia/Jakarta" },
  { value: "Asia/Makassar", label: "WITA — Asia/Makassar" },
  { value: "Asia/Jayapura", label: "WIT — Asia/Jayapura" },
] as const;

function eventId(): string {
  return `event-${Date.now().toString(36)}`;
}

function updateEvent(
  events: EditorContent["events"],
  id: string,
  patch: Partial<EditorEvent>,
): EditorContent["events"] {
  return events.map((event) =>
    event.id === id ? { ...event, ...patch } : event,
  );
}

export function SectionEvents({
  content,
  onChange,
}: {
  content: EditorContent;
  onChange: (patch: EditorPatch) => void;
}) {
  const addEvent = () => {
    const timezone = content.settings.timezone;
    onChange({
      events: [
        ...content.events,
        {
          id: eventId(),
          eventType: "",
          title: "",
          startsAt: "",
          endsAt: null,
          timezone,
          venueName: "",
          address: null,
          mapUrl: null,
        },
      ],
    });
  };

  const removeEvent = (id: string) =>
    onChange({ events: content.events.filter((event) => event.id !== id) });

  return (
    <div className="ed-section-content">
      <div className="ed-repeatable-list">
        {content.events.map((event, index) => (
          <fieldset className="ed-repeatable-card" key={event.id}>
            <legend className="ed-repeatable-card__legend">
              Acara {index + 1}
            </legend>
            <div className="ed-form-grid ed-form-grid--two">
              <Input
                id={`editor-event-type-${event.id}`}
                label="Jenis acara"
                hint="Contoh: Akad Nikah atau Resepsi"
                value={event.eventType}
                onChange={(input) =>
                  onChange({
                    events: updateEvent(content.events, event.id, {
                      eventType: input.currentTarget.value,
                    }),
                  })
                }
              />
              <Input
                id={`editor-event-title-${event.id}`}
                label="Judul acara"
                required
                value={event.title}
                onChange={(input) =>
                  onChange({
                    events: updateEvent(content.events, event.id, {
                      title: input.currentTarget.value,
                    }),
                  })
                }
              />
              <Input
                id={`editor-event-start-${event.id}`}
                label="Mulai"
                required
                type="datetime-local"
                value={event.startsAt}
                onChange={(input) =>
                  onChange({
                    events: updateEvent(content.events, event.id, {
                      startsAt: input.currentTarget.value,
                    }),
                  })
                }
              />
              <Input
                id={`editor-event-end-${event.id}`}
                label="Selesai"
                hint="Opsional"
                type="datetime-local"
                value={event.endsAt ?? ""}
                onChange={(input) =>
                  onChange({
                    events: updateEvent(content.events, event.id, {
                      endsAt: input.currentTarget.value || null,
                    }),
                  })
                }
              />
            </div>
            <Select
              id={`editor-event-timezone-${event.id}`}
              label="Zona waktu"
              required
              options={TIMEZONES}
              value={event.timezone}
              onChange={(input) =>
                onChange({
                  events: updateEvent(content.events, event.id, {
                    timezone: input.currentTarget.value,
                  }),
                })
              }
            />
            <div className="ed-repeatable-card__footer">
              <p className="ed-form-note">
                Tanggal dan waktu ditampilkan sesuai zona waktu acara.
              </p>
              <Button
                type="button"
                variant="danger"
                size="sm"
                onClick={() => removeEvent(event.id)}
                disabled={content.events.length <= 1}
              >
                Hapus acara
              </Button>
            </div>
          </fieldset>
        ))}
      </div>
      <Button type="button" variant="secondary" onClick={addEvent}>
        Tambah acara
      </Button>
      {content.events.length === 0 ? (
        <p className="ed-inline-note">
          Belum ada acara. Tambahkan setidaknya satu acara untuk melanjutkan ke
          publikasi.
        </p>
      ) : null}
    </div>
  );
}
