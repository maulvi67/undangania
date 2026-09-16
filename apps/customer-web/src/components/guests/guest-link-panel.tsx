"use client";

import { useId, useMemo, useRef, useState } from "react";
import { Alert, Badge, Button, Input } from "@wedding/ui";
import type {
  GuestHouseholdDetail,
  GuestManagementData,
} from "../../lib/guests/contract";
import {
  rotateGuestLinkAction,
  setGuestLinkStatusAction,
} from "../../lib/guests/actions";
import { GuestConfirmDialog } from "./guest-dialog";

/**
 * Builds the absolute personalized link from the token the server just issued.
 *
 * The token is only ever shown once — the server keeps a hash — so this is the one
 * moment the link can be assembled. `origin` is read at click time rather than at
 * render, because the component may be server-rendered before a host is known.
 */
function personalizedLink(slug: string, token: string): string {
  const path = `/invite/${encodeURIComponent(slug)}?g=${encodeURIComponent(token)}`;
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  return `${origin}${path}`;
}

export function GuestLinkPanel({
  household,
  management,
  invitationSlug,
}: {
  household: GuestHouseholdDetail;
  management: GuestManagementData;
  /** Null until the couple has published; the link has nowhere to point yet. */
  invitationSlug: string | null;
}) {
  const [linkStatus, setLinkStatus] = useState(household.linkStatus);
  const [tokenVersion, setTokenVersion] = useState(household.tokenVersion);
  const [showRotate, setShowRotate] = useState(false);
  const [showDisable, setShowDisable] = useState(false);
  const panelId = useId();
  const rotateDialogId = `${panelId}-rotate`;
  const disableDialogId = `${panelId}-disable`;
  const rotateTriggerRef = useRef<HTMLButtonElement>(null);
  const disableTriggerRef = useRef<HTMLButtonElement>(null);
  const [notice, setNotice] = useState<string>("");
  const [isError, setIsError] = useState(false);
  const [pending, setPending] = useState(false);
  /** The one-time plaintext link, held only for as long as this page is open. */
  const [issuedToken, setIssuedToken] = useState<string | null>(null);

  const link = useMemo(
    () =>
      issuedToken === null || invitationSlug === null
        ? ""
        : personalizedLink(invitationSlug, issuedToken),
    [issuedToken, invitationSlug],
  );

  const shareMessage = useMemo(
    () =>
      link === ""
        ? ""
        : `Halo ${household.displayName},\n\nDengan penuh sukacita, kami mengundang Anda untuk hadir di acara pernikahan kami.\n\nSilakan membuka undangan dan mengonfirmasi kehadiran melalui tautan berikut:\n\n${link}\n\nTerima kasih atas doa dan perhatian Anda.`,
    [household.displayName, link],
  );

  const copy = async (value: string, success: string) => {
    if (value === "") return;
    try {
      await navigator.clipboard.writeText(value);
      setIsError(false);
      setNotice(success);
    } catch {
      setIsError(true);
      setNotice(
        "Penyalinan otomatis tidak tersedia. Tautan ditampilkan untuk disalin manual.",
      );
    }
  };

  const rotate = async () => {
    setPending(true);
    try {
      const outcome = await rotateGuestLinkAction(household.id);
      if (outcome.kind !== "ok") {
        setIsError(true);
        setNotice(
          outcome.kind === "forbidden"
            ? "Anda tidak memiliki izin untuk mengganti tautan ini."
            : outcome.kind === "not-found"
              ? "Rumah tangga ini tidak ditemukan di workspace Anda."
              : "Tautan belum dapat diganti. Silakan coba lagi.",
        );
        return;
      }
      setIssuedToken(outcome.token);
      setTokenVersion(outcome.tokenVersion);
      setLinkStatus("ACTIVE");
      setIsError(false);
      setNotice(
        "Tautan baru siap disalin. Tautan ini hanya tersedia selama halaman ini terbuka.",
      );
    } finally {
      setPending(false);
      setShowRotate(false);
    }
  };

  const disable = async () => {
    setPending(true);
    try {
      const outcome = await setGuestLinkStatusAction(household.id, "DISABLED");
      if (outcome.kind !== "ok") {
        setIsError(true);
        setNotice("Tautan belum dapat dinonaktifkan. Silakan coba lagi.");
        return;
      }
      setLinkStatus("DISABLED");
      setIssuedToken(null);
      setIsError(false);
      setNotice("Tautan personal dinonaktifkan.");
    } finally {
      setPending(false);
      setShowDisable(false);
    }
  };

  const canManage = management.capabilities.canManageLink;
  const active = linkStatus === "ACTIVE";
  // A link cannot be shared before the invitation is published; the guest would
  // reach a page that renders no content.
  const shareable = active && invitationSlug !== null;

  return (
    <section
      className="gst-detail__section gst-link-panel"
      aria-labelledby="gst-link-title"
    >
      <div className="gst-detail__section-head">
        <div>
          <p className="gst-eyebrow">Akses tamu</p>
          <h2 id="gst-link-title">Tautan personal</h2>
        </div>
        <Badge tone={active ? "olive" : "blush"}>
          {active ? "Aktif" : "Dinonaktifkan"}
        </Badge>
      </div>
      <p className="gst-detail__copy">
        Tautan ini memberi akses ke undangan dan konfirmasi untuk rumah tangga
        ini. Simpan dan bagikan hanya kepada penerima yang dituju.
      </p>
      {invitationSlug === null ? (
        <div className="gst-link-panel__notice">
          <Alert variant="info" title="Undangan belum diterbitkan">
            Tautan baru dapat dibagikan setelah undangan diterbitkan. Terbitkan
            undangan Anda lebih dahulu dari halaman editor.
          </Alert>
        </div>
      ) : null}
      <div className="gst-link-panel__masked">
        <Input
          id="gst-masked-link"
          label="Tautan personal"
          value={
            active
              ? `https://…/invite/${invitationSlug ?? ""}/••••`
              : "Tautan tidak aktif"
          }
          readOnly
          disabled={!active}
          hint="Token asli tidak disimpan atau ditampilkan di daftar tamu."
        />
      </div>
      {link !== "" ? (
        <div className="gst-link-panel__one-time">
          <p className="gst-eyebrow">Tautan sementara untuk disalin</p>
          <code>{link}</code>
          <p>
            Jangan kirimkan tautan ini ke penerima yang tidak dituju. Tautan
            tidak akan ditampilkan lagi setelah Anda meninggalkan halaman.
          </p>
        </div>
      ) : null}
      {notice ? (
        <div className="gst-link-panel__notice">
          <Alert
            variant={isError ? "warning" : "success"}
            title="Status tautan"
          >
            {notice}
          </Alert>
        </div>
      ) : null}
      <div className="gst-detail__actions">
        <Button
          type="button"
          disabled={!canManage || !shareable || link === "" || pending}
          onClick={() => void copy(link, "Tautan personal disalin.")}
        >
          Salin tautan
        </Button>
        <Button
          type="button"
          variant="secondary"
          disabled={!canManage || !shareable || shareMessage === "" || pending}
          onClick={() => void copy(shareMessage, "Pesan undangan disalin.")}
        >
          Salin pesan
        </Button>
      </div>
      {canManage && shareable ? (
        <p className="gst-muted">
          {link === ""
            ? "Ganti tautan untuk menerbitkan tautan baru yang siap dibagikan."
            : "Tautan hanya dapat dibagikan selama halaman ini terbuka."}
        </p>
      ) : null}
      {canManage ? (
        <div className="gst-link-panel__danger-actions">
          <Button
            ref={rotateTriggerRef}
            type="button"
            variant="tertiary"
            disabled={pending}
            onClick={() => setShowRotate(true)}
            aria-expanded={showRotate}
            aria-controls={rotateDialogId}
            aria-haspopup="dialog"
          >
            Ganti tautan
          </Button>
          <Button
            ref={disableTriggerRef}
            type="button"
            variant="tertiary"
            disabled={!active || pending}
            onClick={() => setShowDisable(true)}
            aria-expanded={showDisable}
            aria-controls={disableDialogId}
            aria-haspopup="dialog"
          >
            Nonaktifkan tautan
          </Button>
        </div>
      ) : (
        <p className="gst-muted">
          Anda dapat melihat status tautan, tetapi tidak memiliki izin untuk
          mengubahnya.
        </p>
      )}
      <GuestConfirmDialog
        id={rotateDialogId}
        open={showRotate}
        title="Ganti tautan personal?"
        description="Tautan lama akan langsung berhenti berfungsi. Tautan baru hanya akan ditampilkan sekali setelah proses ini selesai."
        confirmLabel={pending ? "Mengganti…" : "Ganti tautan"}
        onConfirm={() => void rotate()}
        onClose={() => setShowRotate(false)}
        triggerRef={rotateTriggerRef}
      />
      <GuestConfirmDialog
        id={disableDialogId}
        open={showDisable}
        title="Nonaktifkan tautan personal?"
        description="Tamu yang menggunakan tautan ini tidak dapat lagi membuka undangan atau mengirim konfirmasi melalui tautan tersebut."
        confirmLabel={pending ? "Menonaktifkan…" : "Nonaktifkan tautan"}
        danger
        onConfirm={() => void disable()}
        onClose={() => setShowDisable(false)}
        triggerRef={disableTriggerRef}
      />
      <span className="ui-visually-hidden">Versi tautan: {tokenVersion}</span>
    </section>
  );
}
