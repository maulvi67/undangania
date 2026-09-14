import { Input, Textarea } from "@wedding/ui";
import type { EditorContent, EditorEvent } from "../../../lib/editor/contract";
import type { EditorPatch } from "../editor-form";

function updateEvent(
  events: EditorContent["events"],
  id: string,
  patch: Partial<EditorEvent>,
): EditorContent["events"] {
  return events.map((event) =>
    event.id === id ? { ...event, ...patch } : event,
  );
}

export function SectionVenue({
  content,
  onChange,
}: {
  content: EditorContent;
  onChange: (patch: EditorPatch) => void;
}) {
  return (
    <div className="ed-section-content">
      {content.events.length === 0 ? (
        <p className="ed-inline-note">
          Tambahkan acara terlebih dahulu agar setiap lokasi dapat diisi.
        </p>
      ) : null}
      <div className="ed-repeatable-list">
        {content.events.map((event, index) => (
          <fieldset className="ed-repeatable-card" key={event.id}>
            <legend className="ed-repeatable-card__legend">
              Lokasi acara {index + 1}: {event.title || "Belum diberi judul"}
            </legend>
            <Input
              id={`editor-venue-name-${event.id}`}
              label="Nama tempat"
              required
              maxLength={250}
              value={event.venueName}
              onChange={(input) =>
                onChange({
                  events: updateEvent(content.events, event.id, {
                    venueName: input.currentTarget.value,
                  }),
                })
              }
            />
            <Textarea
              id={`editor-venue-address-${event.id}`}
              label="Alamat"
              hint="Boleh dilengkapi nanti. Maksimal 1.000 karakter."
              maxLength={1000}
              value={event.address ?? ""}
              onChange={(input) =>
                onChange({
                  events: updateEvent(content.events, event.id, {
                    address: input.currentTarget.value || null,
                  }),
                })
              }
            />
            <Input
              id={`editor-venue-map-${event.id}`}
              label="Tautan peta"
              hint="Opsional. Tempel tautan Google Maps atau layanan peta lain yang aman."
              type="url"
              inputMode="url"
              value={event.mapUrl ?? ""}
              onChange={(input) =>
                onChange({
                  events: updateEvent(content.events, event.id, {
                    mapUrl: input.currentTarget.value || null,
                  }),
                })
              }
            />
          </fieldset>
        ))}
      </div>
    </div>
  );
}
