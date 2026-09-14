"use client";

import { useMemo } from "react";
import type { GuestContext } from "../../lib/public-invitation/guest-context";
import {
  createGuestbookStubTransport,
  type GuestbookSimulation,
} from "../../lib/guestbook/stub-transport";
import {
  createRsvpStubTransport,
  type RsvpSimulation,
} from "../../lib/rsvp/stub-transport";
import { GuestbookForm } from "./guestbook-form";
import { GuestRsvp } from "./guest-rsvp";

type GuestInvitationExperienceProps = Readonly<{
  coupleNames: string;
  context: GuestContext;
  rsvpSimulation: RsvpSimulation;
  guestbookSimulation: GuestbookSimulation;
}>;

export function GuestInvitationExperience({
  coupleNames,
  context,
  rsvpSimulation,
  guestbookSimulation,
}: GuestInvitationExperienceProps) {
  const rsvpTransport = useMemo(
    () => createRsvpStubTransport(rsvpSimulation),
    [rsvpSimulation],
  );
  const guestbookTransport = useMemo(
    () => createGuestbookStubTransport(guestbookSimulation),
    [guestbookSimulation],
  );

  return (
    <div className="gld-guest-experience" id="rsvp">
      <GuestRsvp context={context} transport={rsvpTransport} />
      {context.guestbook.enabled ? (
        <section
          className="gld-guestbook"
          aria-labelledby="gld-guestbook-form-title"
        >
          <p className="gld-kicker">Doa dan ucapan</p>
          <h2 id="gld-guestbook-form-title">Bagikan ucapan</h2>
          <p className="gld-copy">
            Sampaikan doa dan ucapan hangat Anda untuk {coupleNames}. Bagian ini
            opsional dan tidak memengaruhi jawaban kehadiran.
          </p>
          <GuestbookForm
            coupleNames={coupleNames}
            transport={guestbookTransport}
          />
        </section>
      ) : null}
      <p className="gld-guest-experience__note">
        Prototype fixture: data ini belum terhubung ke penyimpanan undangan
        produksi.
      </p>
    </div>
  );
}
