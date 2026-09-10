"use client";

import { useState } from "react";
import { Alert, Button, Input, RadioGroup, Select } from "@wedding/ui";

/**
 * Demo-only RSVP form. Purely local: validates, then shows a confirmation.
 * No network calls, no persistence — stated in the UI so guests (customers
 * previewing) are not misled about data handling.
 */
export function RsvpForm() {
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState<string | undefined>(undefined);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = name.trim();
    if (trimmed.length === 0) {
      setError("Mohon isi nama Anda.");
      setSubmitted(undefined);
      return;
    }
    setError("");
    setSubmitted(trimmed);
  }

  if (submitted !== undefined) {
    return (
      <div aria-live="polite">
        <Alert variant="success" title={`Terima kasih, ${submitted}!`}>
          Konfirmasi Anda tercatat di pratinjau demo ini. Pada undangan sungguhan, konfirmasi
          langsung terkirim ke mempelai.
        </Alert>
      </div>
    );
  }

  return (
    <form className="dmv__rsvp" onSubmit={handleSubmit} noValidate>
      <Input
        id="dmv-rsvp-name"
        label="Nama Anda"
        required
        value={name}
        onChange={(event) => setName(event.target.value)}
        error={error}
      />
      <RadioGroup
        name="dmv-rsvp-kehadiran"
        legend="Konfirmasi kehadiran"
        defaultValue="hadir"
        required
        options={[
          { value: "hadir", label: "Hadir", hint: "Insya Allah dapat menghadiri" },
          { value: "berhalangan", label: "Berhalangan", hint: "Tidak dapat menghadiri" },
        ]}
      />
      <Select
        id="dmv-rsvp-pax"
        label="Jumlah tamu"
        hint="Termasuk Anda"
        defaultValue="1"
        options={[
          { value: "1", label: "1 orang" },
          { value: "2", label: "2 orang" },
          { value: "3", label: "3 orang" },
          { value: "4", label: "4 orang" },
        ]}
      />
      <Button type="submit">Kirim konfirmasi</Button>
      <p className="dmv__rsvp-note">
        Pratinjau demo — isian pada formulir ini tidak dikirim ke mana pun.
      </p>
    </form>
  );
}
