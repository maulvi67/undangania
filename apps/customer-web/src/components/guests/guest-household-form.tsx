"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Button, Checkbox, Input, Select } from "@wedding/ui";
import type { GuestEvent, GuestTag } from "../../lib/guests/contract";

type MemberDraft = {
  id: string;
  name: string;
  category: "ADULT" | "CHILD" | "OTHER";
};

export function GuestHouseholdForm({
  events,
  tags,
  mode = "create",
  initial,
}: {
  events: readonly GuestEvent[];
  tags: readonly GuestTag[];
  mode?: "create" | "edit";
  initial?: {
    displayName: string;
    maximumPax: number;
    eventIds: readonly string[];
    tag: string;
    members: readonly MemberDraft[];
    phone: string;
    email: string;
  };
}) {
  const [displayName, setDisplayName] = useState(initial?.displayName ?? "");
  const [maximumPax, setMaximumPax] = useState(
    String(initial?.maximumPax ?? 1),
  );
  const [eventIds, setEventIds] = useState<ReadonlySet<string>>(
    new Set(initial?.eventIds ?? []),
  );
  const [tag, setTag] = useState(initial?.tag ?? "");
  const [members, setMembers] = useState<readonly MemberDraft[]>(
    initial?.members ?? [{ id: "new-1", name: "", category: "ADULT" }],
  );
  const [phone, setPhone] = useState(initial?.phone ?? "");
  const [email, setEmail] = useState(initial?.email ?? "");
  const [submitted, setSubmitted] = useState(false);
  const errors = useMemo(() => {
    const result: Record<string, string> = {};
    if (displayName.trim() === "")
      result.displayName = "Nama rumah tangga wajib diisi.";
    if (members.filter((member) => member.name.trim() !== "").length === 0)
      result.members = "Tambahkan setidaknya satu nama tamu.";
    const parsedPax = Number(maximumPax);
    const namedMembers = members.filter(
      (member) => member.name.trim() !== "",
    ).length;
    if (!Number.isInteger(parsedPax) || parsedPax < 1)
      result.maximumPax = "Maksimal pax harus berupa angka lebih besar dari 0.";
    else if (parsedPax < namedMembers)
      result.maximumPax =
        "Maksimal pax tidak boleh lebih kecil dari jumlah tamu yang sudah ditambahkan.";
    if (eventIds.size === 0) result.events = "Pilih setidaknya satu acara.";
    if (email.trim() !== "" && !/^\S+@\S+\.\S+$/.test(email))
      result.email = "Email belum memiliki format yang benar.";
    return result;
  }, [displayName, email, eventIds, maximumPax, members]);
  const updateMember = (id: string, patch: Partial<MemberDraft>) => {
    setMembers((current) =>
      current.map((member) =>
        member.id === id ? { ...member, ...patch } : member,
      ),
    );
  };
  const addMember = () =>
    setMembers((current) => [
      ...current,
      { id: `new-${current.length + 1}`, name: "", category: "ADULT" },
    ]);
  const removeMember = (id: string) =>
    setMembers((current) =>
      current.length > 1
        ? current.filter((member) => member.id !== id)
        : current,
    );
  const toggleEvent = (id: string, checked: boolean) => {
    setEventIds((current) => {
      const next = new Set(current);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };
  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitted(true);
    if (Object.keys(errors).length === 0) {
      // Fixture-only success. A live route must call the authorized application use case.
      window.history.replaceState(null, "", "/tamu?notice=household-saved");
    }
  };
  return (
    <form className="gst-form" onSubmit={submit} noValidate>
      {submitted && Object.keys(errors).length > 0 ? (
        <div className="gst-form__summary" role="alert">
          <p className="gst-form__summary-title">
            Periksa kembali data rumah tangga
          </p>
          <ul>
            {Object.values(errors).map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>
        </div>
      ) : null}
      <section
        className="gst-form__section"
        aria-labelledby="gst-form-household"
      >
        <p className="gst-eyebrow">Langkah 1</p>
        <h2 id="gst-form-household">Rumah tangga</h2>
        <Input
          id="gst-household-name"
          label="Nama rumah tangga"
          required
          value={displayName}
          onChange={(event) => setDisplayName(event.target.value)}
          {...(submitted && errors.displayName
            ? { error: errors.displayName }
            : {})}
          hint="Contoh: Keluarga Budi Santoso. Nama ini hanya untuk pengelolaan internal."
        />
      </section>

      <section className="gst-form__section" aria-labelledby="gst-form-members">
        <p className="gst-eyebrow">Langkah 2</p>
        <h2 id="gst-form-members">Anggota rumah tangga</h2>
        <p className="gst-form__intro">
          Nama tamu akan digunakan untuk membantu Anda mengenali penerima
          undangan.
        </p>
        <div className="gst-member-list">
          {members.map((member, index) => (
            <div className="gst-member-row" key={member.id}>
              <Input
                id={`gst-member-${member.id}`}
                label={`Nama tamu ${index + 1}`}
                required={index === 0}
                value={member.name}
                onChange={(event) =>
                  updateMember(member.id, { name: event.target.value })
                }
                {...(submitted && index === 0 && errors.members
                  ? { error: errors.members }
                  : {})}
              />
              <Select
                id={`gst-member-category-${member.id}`}
                label="Kategori"
                value={member.category}
                onChange={(event) =>
                  updateMember(member.id, {
                    category: event.target.value as MemberDraft["category"],
                  })
                }
                options={[
                  { value: "ADULT", label: "Dewasa" },
                  { value: "CHILD", label: "Anak" },
                  { value: "OTHER", label: "Lainnya" },
                ]}
              />
              <Button
                type="button"
                variant="tertiary"
                onClick={() => removeMember(member.id)}
                disabled={members.length === 1}
              >
                Hapus
              </Button>
            </div>
          ))}
        </div>
        <Button type="button" variant="secondary" onClick={addMember}>
          Tambah nama tamu
        </Button>
      </section>

      <section className="gst-form__section" aria-labelledby="gst-form-access">
        <p className="gst-eyebrow">Langkah 3</p>
        <h2 id="gst-form-access">Akses undangan</h2>
        <Input
          id="gst-maximum-pax"
          label="Maksimal pax"
          required
          type="number"
          min={1}
          inputMode="numeric"
          value={maximumPax}
          onChange={(event) => setMaximumPax(event.target.value)}
          {...(submitted && errors.maximumPax
            ? { error: errors.maximumPax }
            : {})}
          hint="Jumlah maksimal orang yang dapat dikonfirmasi melalui tautan ini."
        />
        <fieldset
          className="gst-event-fieldset"
          aria-describedby={submitted ? "gst-events-error" : undefined}
        >
          <legend>
            Akses acara <span className="ui-field__req">(wajib)</span>
          </legend>
          <p className="gst-form__hint">
            Pilih acara yang dapat dilihat dan dikonfirmasi oleh rumah tangga
            ini.
          </p>
          {events.map((event) => (
            <Checkbox
              key={event.id}
              id={`gst-event-${event.id}`}
              label={event.title}
              checked={eventIds.has(event.id)}
              onChange={(inputEvent) =>
                toggleEvent(event.id, inputEvent.target.checked)
              }
            />
          ))}
          {submitted && errors.events ? (
            <p id="gst-events-error" className="ui-field__error">
              {errors.events}
            </p>
          ) : null}
        </fieldset>
        <Select
          id="gst-tag"
          label="Tag"
          value={tag}
          onChange={(event) => setTag(event.target.value)}
          options={[
            { value: "", label: "Tanpa tag" },
            ...tags.map((item) => ({ value: item.label, label: item.label })),
          ]}
          hint="Opsional. Tag membantu Anda menyaring daftar tamu."
        />
      </section>

      <section className="gst-form__section" aria-labelledby="gst-form-contact">
        <p className="gst-eyebrow">Langkah 4 · opsional</p>
        <h2 id="gst-form-contact">Kontak internal</h2>
        <p className="gst-form__intro">
          Kontak hanya untuk pengelolaan internal dan tidak ditampilkan pada
          undangan publik.
        </p>
        <div className="gst-form__two-column">
          <Input
            id="gst-phone"
            label="Nomor telepon"
            type="tel"
            inputMode="tel"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            hint="Opsional"
          />
          <Input
            id="gst-email"
            label="Email"
            type="email"
            inputMode="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            {...(submitted && errors.email ? { error: errors.email } : {})}
            hint="Opsional"
          />
        </div>
      </section>

      <div className="gst-form__actions">
        <Link
          className="ui-button ui-button--secondary ui-button--md"
          href="/tamu"
        >
          Batal
        </Link>
        <Button type="submit">
          {mode === "create" ? "Simpan rumah tangga" : "Simpan perubahan"}
        </Button>
      </div>
      {submitted && Object.keys(errors).length === 0 ? (
        <p className="gst-form__success" role="status">
          Rumah tangga siap disimpan. Pada versi produksi, perubahan akan
          melalui layanan workspace yang terotorisasi.
        </p>
      ) : null}
    </form>
  );
}
