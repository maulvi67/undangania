"use client";

import { useMemo } from "react";
import type { GuestbookTransport } from "../../lib/guestbook/contract";
import type { GuestContext } from "../../lib/public-invitation/guest-context";
import type { RsvpTransport } from "../../lib/rsvp/contract";
import { GuestbookForm } from "./guestbook-form";
import { GuestRsvp } from "./guest-rsvp";

type GuestInvitationExperienceProps = Readonly<{
  coupleNames: string;
  invitationSlug: string;
  context: GuestContext;
  /**
   * The personalized-link token. It is passed to the server actions, which is what
   * scopes the write; it is never sent anywhere else and is not rendered.
   */
  guestToken?: string;
}>;

/**
 * Builds the browser-side transports.
 *
 * The token is the bearer credential and the invitation slug binds it to the
 * page being rendered. Both values are handed to a Server Action rather than to a
 * public API, so the household is resolved server-side and the client cannot name
 * one. The returned shapes match the contract the fixture transports already
 * produced, which is why the RSVP and guestbook components needed no changes.
 */
function createRsvpTransport(
  token: string | undefined,
  invitationSlug: string,
): RsvpTransport {
  return {
    async submit(command) {
      if (token === undefined) {
        return {
          kind: "error",
          code: "SUBMISSION_FAILED",
          message:
            "Tautan undangan ini tidak dapat digunakan. Minta tautan terbaru kepada pasangan.",
          preserveInput: true,
        };
      }
      const { submitRsvpAction } =
        await import("../../lib/public-invitation/guest-actions");
      return submitRsvpAction({
        token,
        invitationSlug,
        idempotencyKey: command.idempotencyKey,
        updates: command.updates.map((update) => ({
          eventId: update.eventId,
          response: update.response,
          pax: update.pax,
          expectedVersion: update.expectedVersion,
        })),
      });
    },
  };
}

function createGuestbookTransport(
  token: string | undefined,
  invitationSlug: string,
): GuestbookTransport {
  return {
    async submit(command) {
      if (token === undefined) {
        return {
          kind: "error",
          code: "REJECTED",
          message:
            "Tautan undangan ini tidak dapat digunakan. Minta tautan terbaru kepada pasangan.",
          preserveInput: true,
        };
      }
      const { submitGuestbookAction } =
        await import("../../lib/public-invitation/guest-actions");
      return submitGuestbookAction({
        token,
        invitationSlug,
        message: command.message,
        idempotencyKey: command.idempotencyKey,
      });
    },
  };
}

export function GuestInvitationExperience({
  coupleNames,
  invitationSlug,
  context,
  guestToken,
}: GuestInvitationExperienceProps) {
  const rsvpTransport = useMemo(
    () => createRsvpTransport(guestToken, invitationSlug),
    [guestToken, invitationSlug],
  );
  const guestbookTransport = useMemo(
    () => createGuestbookTransport(guestToken, invitationSlug),
    [guestToken, invitationSlug],
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
    </div>
  );
}
