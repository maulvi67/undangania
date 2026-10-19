"use client";

import * as React from "react";
import Link from "next/link";
import { Alert, Badge, Button, StatePanel } from "@wedding/ui";
import type {
  GuestHouseholdDetail,
  GuestManagementData,
} from "../../lib/guests/contract";
import { GuestHouseholdForm } from "./guest-household-form";
import { GuestLinkPanel } from "./guest-link-panel";
import { deleteGuestHouseholdAction } from "../../lib/guests/actions";
import { useRouter } from "next/navigation";

export function GuestHouseholdDetailView({
  household,
  management,
  invitationSlug,
}: {
  household: GuestHouseholdDetail;
  management: GuestManagementData;
  /** Null until the couple has published; the link has nowhere to point yet. */
  invitationSlug: string | null;
}) {
  const router = useRouter();
  const [edit, setEdit] = React.useState(false);
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const [deletePending, setDeletePending] = React.useState(false);
  const [deleteError, setDeleteError] = React.useState<string | null>(null);
  const remove = async () => {
    setDeletePending(true);
    setDeleteError(null);
    try {
      const outcome = await deleteGuestHouseholdAction(household.id);
      if (outcome.kind !== "ok") {
        setDeleteError(
          outcome.kind === "forbidden"
            ? "Anda tidak memiliki izin untuk menghapus rumah tangga ini."
            : outcome.kind === "not-found"
              ? "Rumah tangga ini sudah tidak tersedia."
              : "Rumah tangga belum dapat dihapus. Coba lagi.",
        );
        return;
      }
      router.push("/tamu");
      router.refresh();
    } finally {
      setDeletePending(false);
    }
  };
  if (edit) {
    return (
      <div className="gst-page gst-page--detail">
        <Link className="gst-backlink" href={`/tamu/${household.id}`}>
          ← Kembali ke detail rumah tangga
        </Link>
        <header className="gst-page__header">
          <div>
            <p className="gst-eyebrow">Edit rumah tangga</p>
            <h1>{household.displayName}</h1>
            <p className="gst-page__lead">
              Perubahan akan memengaruhi pengelolaan internal rumah tangga ini.
            </p>
          </div>
        </header>
        <GuestHouseholdForm
          events={management.events}
          tags={management.tags}
          mode="edit"
          householdId={household.id}
          initial={{
            displayName: household.displayName,
            maximumPax: household.maximumPax,
            eventIds: household.eventIds,
            tag: household.tags[0] ?? "",
            members: household.members.map((member) => ({
              id: member.id,
              name: member.displayName,
              category: member.category,
            })),
            phone: "",
            email: "",
          }}
        />
      </div>
    );
  }
  return (
    <div className="gst-page gst-page--detail">
      <Link className="gst-backlink" href="/tamu">
        ← Kembali ke daftar tamu
      </Link>
      <header className="gst-page__header gst-page__header--detail">
        <div>
          <p className="gst-eyebrow">Rumah tangga</p>
          <h1>{household.displayName}</h1>
          <p className="gst-page__lead">
            Kelola anggota, akses acara, dan tautan personal tanpa menampilkan
            kontak lengkap di daftar.
          </p>
        </div>
        {management.capabilities.canWrite ? (
          <div className="gst-detail__actions">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setEdit(true)}
            >
              Edit rumah tangga
            </Button>
            <Button
              type="button"
              variant="danger"
              onClick={() => setConfirmDelete(true)}
            >
              Hapus rumah tangga
            </Button>
          </div>
        ) : null}
      </header>

      {confirmDelete ? (
        <div className="gst-notice">
          <Alert variant="warning" title="Hapus rumah tangga ini?">
            Tautan personal tidak akan dapat digunakan lagi. Riwayat RSVP dan
            buku tamu tetap tersimpan.{" "}
            <Button
              type="button"
              variant="danger"
              size="sm"
              loading={deletePending}
              onClick={() => void remove()}
            >
              Ya, hapus
            </Button>{" "}
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={deletePending}
              onClick={() => setConfirmDelete(false)}
            >
              Batal
            </Button>
          </Alert>
          {deleteError ? (
            <p className="gst-muted" role="alert">
              {deleteError}
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="gst-detail-grid">
        <section
          className="gst-detail__section"
          aria-labelledby="gst-members-title"
        >
          <div className="gst-detail__section-head">
            <div>
              <p className="gst-eyebrow">Anggota</p>
              <h2 id="gst-members-title">{household.members.length} tamu</h2>
            </div>
            <Badge tone="neutral">Maksimal {household.maximumPax} pax</Badge>
          </div>
          <ul className="gst-detail__members">
            {household.members.map((member) => (
              <li key={member.id}>
                <span>{member.displayName}</span>
                <span className="gst-muted">
                  {member.category === "CHILD"
                    ? "Anak"
                    : member.category === "OTHER"
                      ? "Lainnya"
                      : "Dewasa"}
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section
          className="gst-detail__section"
          aria-labelledby="gst-events-title"
        >
          <p className="gst-eyebrow">Akses acara</p>
          <h2 id="gst-events-title">Acara yang tersedia</h2>
          <ul className="gst-detail__event-list">
            {household.eventNames.map((eventName) => (
              <li key={eventName}>{eventName}</li>
            ))}
          </ul>
          <p className="gst-detail__copy">
            Tamu hanya dapat melihat dan mengonfirmasi acara yang dipilih untuk
            rumah tangga ini.
          </p>
        </section>

        <section
          className="gst-detail__section"
          aria-labelledby="gst-contact-title"
        >
          <p className="gst-eyebrow">Data internal</p>
          <h2 id="gst-contact-title">Kontak tersimpan</h2>
          <dl className="gst-definition-list">
            <div>
              <dt>Telepon</dt>
              <dd>{household.phoneMasked ?? "Belum ditambahkan"}</dd>
            </div>
            <div>
              <dt>Email</dt>
              <dd>{household.emailMasked ?? "Belum ditambahkan"}</dd>
            </div>
          </dl>
          <p className="gst-detail__copy">
            Kontak disamarkan untuk mengurangi paparan data sensitif.
          </p>
        </section>

        <section
          className="gst-detail__section"
          aria-labelledby="gst-tags-title"
        >
          <p className="gst-eyebrow">Pengelompokan</p>
          <h2 id="gst-tags-title">Tag</h2>
          {household.tags.length > 0 ? (
            <ul className="gst-card__tags">
              {household.tags.map((tag) => (
                <li key={tag}>{tag}</li>
              ))}
            </ul>
          ) : (
            <p className="gst-muted">Belum ada tag.</p>
          )}
        </section>
      </div>
      <GuestLinkPanel
        household={household}
        management={management}
        invitationSlug={invitationSlug}
      />
    </div>
  );
}

export function GuestNotFound() {
  return (
    <div className="gst-state">
      <StatePanel
        title="Rumah tangga tidak ditemukan"
        description="Rumah tangga ini mungkin sudah dihapus atau tidak tersedia di workspace Anda."
        action={
          <Link
            className="ui-button ui-button--secondary ui-button--md"
            href="/tamu"
          >
            Kembali ke daftar tamu
          </Link>
        }
      />
    </div>
  );
}
