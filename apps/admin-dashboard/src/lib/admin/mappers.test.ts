import { describe, expect, it } from "vitest";
import {
  toAuditRow,
  toFailedJobRow,
  toPaymentRow,
  toPublicationFailureRow,
} from "./mappers";

/**
 * The mappers turn stored rows into the console's display contract. The `details`
 * list is the interesting part: it is *derived*, not stored, so these tests pin
 * that every entry corresponds to a real column and that nothing is invented when
 * a column is absent.
 */
describe("admin row mappers", () => {
  it("derives payment details only from columns the row actually has", () => {
    const row = toPaymentRow({
      id: "payment-1",
      reference: "PAY-1",
      severity: "critical",
      status: "Tinjauan manual",
      owner: "Finance queue",
      age: "2 jam",
      updatedAt: "2026-03-21T07:28:00.000Z",
      orderReference: "ORD-1",
      paymentReference: "PMT-1",
      maskedCustomer: "R*** & B***",
      provider: "Midtrans",
      method: "QRIS",
      internalStatus: "PENDING",
      providerStatus: "settlement",
      amountMinor: "499000",
      currency: "IDR",
      reconciliation: "Status belum cocok",
      lastProviderCheck: "2026-03-21T07:20:00.000Z",
    });

    expect(row.details.map((item) => item.label)).toEqual([
      "Status internal",
      "Status provider",
      "Rekonsiliasi",
      "Nominal",
    ]);
    expect(row.details).toContainEqual({
      label: "Nominal",
      value: "499000 IDR",
      masked: false,
    });
    // The default must be unmasked: these columns are already safe to show, and a
    // silent `masked: true` would hide operational detail the console needs.
    expect(row.details.every((item) => item.masked === false)).toBe(true);
  });

  it("maps failed job attempts and retry state", () => {
    const row = toFailedJobRow({
      id: "job-1",
      reference: "JOB-1",
      severity: "warning",
      status: "Retry diblokir",
      owner: "Worker queue",
      age: "1 jam",
      updatedAt: "2026-03-21T06:45:00.000Z",
      jobType: "Media processing",
      queue: "media.default",
      failureReason: "Asset gagal pemeriksaan format.",
      attempts: 3,
      firstFailedAt: "2026-03-21T05:45:00.000Z",
      lastFailedAt: "2026-03-21T06:45:00.000Z",
      retryState: "Perlu konfirmasi idempotensi",
      relatedResource: "Media asset disamarkan",
    });

    expect(row.details).toContainEqual({
      label: "Percobaan",
      value: "3",
      masked: false,
    });
    expect(row.attempts).toBe(3);
  });

  it("omits the published-version detail when nothing was ever published", () => {
    const row = toPublicationFailureRow({
      id: "publication-1",
      reference: "PUB-1",
      severity: "high",
      status: "Gagal",
      owner: "Platform queue",
      age: "47 menit",
      updatedAt: "2026-03-21T06:45:00.000Z",
      invitationReference: "INV-1",
      attemptedVersion: 1,
      currentPublishedVersion: null,
      failureStage: "Validasi snapshot",
      failedAt: "2026-03-21T06:45:00.000Z",
      previousSnapshotActive: false,
      retryState: "Menunggu pemeriksaan",
    });

    // A first publish has no previous version; showing "0" or "—" would imply a
    // version exists.
    expect(row.details.map((item) => item.label)).not.toContain("Versi publik");
    expect(row.details).toContainEqual({
      label: "Snapshot sebelumnya",
      value: "Tidak aktif",
      masked: false,
    });
  });

  it("includes the published-version detail when one exists", () => {
    const row = toPublicationFailureRow({
      id: "publication-2",
      reference: "PUB-2",
      severity: "high",
      status: "Gagal",
      owner: "Platform queue",
      age: "47 menit",
      updatedAt: "2026-03-21T06:45:00.000Z",
      invitationReference: "INV-2",
      attemptedVersion: 8,
      currentPublishedVersion: 7,
      failureStage: "Validasi snapshot",
      failedAt: "2026-03-21T06:45:00.000Z",
      previousSnapshotActive: true,
      retryState: "Menunggu pemeriksaan",
    });

    expect(row.details).toContainEqual({
      label: "Versi publik",
      value: "7",
      masked: false,
    });
    expect(row.details).toContainEqual({
      label: "Snapshot sebelumnya",
      value: "Masih aktif",
      masked: false,
    });
  });

  it("carries the audit masking flag rather than deciding it here", () => {
    const row = toAuditRow({
      id: "audit-1",
      timestamp: "2026-03-21T07:28:00.000Z",
      actor: "admin-***42",
      role: "ADMIN",
      action: "Membuka ringkasan operasional",
      target: "Admin dashboard",
      reason: "—",
      result: "Berhasil",
      correlationId: "corr-9f2a",
      masked: true,
    });

    // Whether an actor identifier is masked is decided by the query layer; the
    // mapper must not downgrade it.
    expect(row.masked).toBe(true);
    expect(row.actor).toBe("admin-***42");
  });
});
