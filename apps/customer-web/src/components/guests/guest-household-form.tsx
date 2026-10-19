"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Button, Checkbox, Input, Select } from "@wedding/ui";
import { useRouter } from "next/navigation";
import type { GuestEvent, GuestTag } from "../../lib/guests/contract";
import {
  createGuestHouseholdAction,
  updateGuestHouseholdAction,
} from "../../lib/guests/actions";
import type { GuestMutationOutcome } from "../../lib/guests/outcomes";

type MemberDraft = {
  id: string;
  name: string;
  category: "ADULT" | "CHILD" | "OTHER";
};

/**
 * Maps a mutation outcome onto the form's own error surface. A `forbidden` or
 * `unavailable` result is not a field problem, so it is reported as a form-level
 * message rather than attached to an input the guest cannot fix.
 */
function outcomeMessage(outcome: GuestMutationOutcome): string | null {
  switch (outcome.kind) {
    case "ok":
      return null;
    case "invalid":
      return outcome.errors[0] ?? "Periksa kembali data rumah tangga.";
    case "forbidden":
      return "Anda tidak memiliki izin untuk menyimpan perubahan ini.";
    case "not-found":
      return "Rumah tangga ini tidak ditemukan di workspace Anda.";
    case "unavailable":
      return "Data belum dapat disimpan. Periksa koneksi Anda lalu coba lagi.";
  }
}

export function GuestHouseholdForm({
  events,
  tags,
  mode = "create",
  householdId,
  initial,
}: {
  events: readonly GuestEvent[];
  tags: readonly GuestTag[];
  mode?: "create" | "edit";
  /** Required in edit mode; the server re-checks that it is in scope. */
  householdId?: string;
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
  const router = useRouter();
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
  const [pending, setPending] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
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
    if (eventIds.size === 0)
      result.events = "Pilih setidaknya satu acara untuk rumah tangga ini.";
    return result;
  }, [displayName, eventIds, maximumPax, members]);
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
  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitted(true);
    setServerError(null);
    if (Object.keys(errors).length > 0) return;

    // The body is built from the form's own state, and the phone/email fields are
    // intentionally not sent: contact storage needs an encryption boundary this
    // form does not have yet, so an accepted write would have to discard them.
    const body = {
      displayName: displayName.trim(),
      maximumPax: Number(maximumPax),
      eventIds: [...eventIds],
      tags: tag.trim() === "" ? [] : [tag.trim()],
      members: members
        .filter((member) => member.name.trim() !== "")
        .map((member) => ({
          displayName: member.name.trim(),
          category: member.category,
        })),
    };

    setPending(true);
    try {
      const outcome =
        mode === "edit" && householdId !== undefined
          ? await updateGuestHouseholdAction(householdId, body)
          : await createGuestHouseholdAction(body);
      const message = outcomeMessage(outcome);
      if (message !== null) {
        setServerError(message);
        return;
      }
      setSaved(true);
      // The list is served by a Server Component, so it has to be re-fetched for
      // the new row to appear.
      router.push("/tamu");
      router.refresh();
    } finally {
      setPending(false);
    }
  };
  return (
    <form className="gst-form" onSubmit={submit} noValidate>
      {serverError ? (
        <div className="gst-form__summary" role="alert">
          <p className="gst-form__summary-title">
            Rumah tangga belum tersimpan
          </p>
          <p>{serverError}</p>
        </div>
      ) : null}
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
          aria-describedby="gst-events-note"
        >
          <legend>
            Akses acara <span className="ui-field__req">(wajib)</span>
          </legend>
          <p className="gst-form__hint" id="gst-events-note">
            Tamu hanya dapat melihat dan mengonfirmasi acara yang dipilih.
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
          hint="Tag dipakai untuk menyaring daftar tamu di halaman Tamu."
        />
      </section>

      <section className="gst-form__section" aria-labelledby="gst-form-contact">
        <p className="gst-eyebrow">Langkah 4 · opsional</p>
        <h2 id="gst-form-contact">Kontak internal</h2>
        <p className="gst-form__intro" id="gst-contact-note">
          Belum dapat disimpan. Kontak disimpan terenkripsi dan pengisian dari
          formulir ini belum tersedia, sehingga tidak ada nilai yang dikirim.
        </p>
        <div className="gst-form__two-column">
          <Input
            id="gst-phone"
            label="Nomor telepon"
            type="tel"
            inputMode="tel"
            value={phone}
            disabled
            onChange={(event) => setPhone(event.target.value)}
            hint="Belum tersedia"
          />
          <Input
            id="gst-email"
            label="Email"
            type="email"
            inputMode="email"
            value={email}
            disabled
            onChange={(event) => setEmail(event.target.value)}
            hint="Belum tersedia"
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
        <Button type="submit" loading={pending} disabled={pending}>
          {mode === "create" ? "Simpan rumah tangga" : "Simpan perubahan"}
        </Button>
      </div>
      {saved ? (
        <p className="gst-form__success" role="status">
          Rumah tangga tersimpan.
        </p>
      ) : null}
    </form>
  );
}
