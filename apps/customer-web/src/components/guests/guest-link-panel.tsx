"use client";

import { useId, useMemo, useRef, useState } from "react";
import { Alert, Badge, Button, Input } from "@wedding/ui";
import type {
  GuestHouseholdDetail,
  GuestManagementData,
} from "../../lib/guests/contract";
import { GuestConfirmDialog } from "./guest-dialog";

function demoLink(householdId: string, version: number): string {
  return `https://demo.wedding-system.test/i/${householdId}/v${version}`;
}

export function GuestLinkPanel({
  household,
  management,
}: {
  household: GuestHouseholdDetail;
  management: GuestManagementData;
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
  const [linkAvailable, setLinkAvailable] = useState(false);
  const link = useMemo(
    () => demoLink(household.id, tokenVersion),
    [household.id, tokenVersion],
  );
  const shareMessage = useMemo(
    () =>
      `Halo ${household.displayName},\n\nDengan penuh sukacita, kami mengundang Anda untuk hadir di acara pernikahan kami.\n\nSilakan membuka undangan dan mengonfirmasi kehadiran melalui tautan berikut:\n\n${link}\n\nTerima kasih atas doa dan perhatian Anda.`,
    [household.displayName, link],
  );

  const copy = async (value: string, success: string) => {
    if (!navigator.clipboard) {
      setNotice(
        "Penyalinan otomatis tidak tersedia. Tautan ditampilkan untuk disalin manual.",
      );
      setLinkAvailable(true);
      return;
    }
    try {
      await navigator.clipboard.writeText(value);
      setNotice(success);
      setLinkAvailable(true);
    } catch {
      setNotice(
        "Penyalinan otomatis tidak tersedia. Tautan ditampilkan untuk disalin manual.",
      );
      setLinkAvailable(true);
    }
  };

  const rotate = () => {
    setTokenVersion((current) => current + 1);
    setLinkStatus("ACTIVE");
    setLinkAvailable(true);
    setNotice(
      "Tautan baru siap disalin. Tautan ini hanya tersedia selama halaman ini terbuka.",
    );
    setShowRotate(false);
  };

  const disable = () => {
    setLinkStatus("DISABLED");
    setNotice("Tautan personal dinonaktifkan.");
    setShowDisable(false);
  };

  const canManage = management.capabilities.canManageLink;
  const active = linkStatus === "ACTIVE";
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
      <div className="gst-link-panel__masked">
        <Input
          id="gst-masked-link"
          label="Tautan personal"
          value={
            active ? `https://…/${household.id}/••••` : "Tautan tidak aktif"
          }
          readOnly
          disabled={!active}
          hint="Token asli tidak disimpan atau ditampilkan di daftar tamu."
        />
      </div>
      {linkAvailable && active ? (
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
            variant={notice.includes("dinonaktifkan") ? "warning" : "success"}
            title="Status tautan"
          >
            {notice}
          </Alert>
        </div>
      ) : null}
      <div className="gst-detail__actions">
        <Button
          type="button"
          disabled={!canManage || !active}
          onClick={() => void copy(link, "Tautan personal disalin.")}
        >
          Salin tautan
        </Button>
        <Button
          type="button"
          variant="secondary"
          disabled={!canManage || !active}
          onClick={() => void copy(shareMessage, "Pesan undangan disalin.")}
        >
          Salin pesan
        </Button>
      </div>
      {canManage ? (
        <div className="gst-link-panel__danger-actions">
          <Button
            ref={rotateTriggerRef}
            type="button"
            variant="tertiary"
            disabled={!active}
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
            disabled={!active}
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
        confirmLabel="Ganti tautan"
        onConfirm={rotate}
        onClose={() => setShowRotate(false)}
        triggerRef={rotateTriggerRef}
      />
      <GuestConfirmDialog
        id={disableDialogId}
        open={showDisable}
        title="Nonaktifkan tautan personal?"
        description="Tamu yang menggunakan tautan ini tidak dapat lagi membuka undangan atau mengirim konfirmasi melalui tautan tersebut."
        confirmLabel="Nonaktifkan tautan"
        danger
        onConfirm={disable}
        onClose={() => setShowDisable(false)}
        triggerRef={disableTriggerRef}
      />
    </section>
  );
}
