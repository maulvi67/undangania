import {
  ADMIN_FIXTURES,
  adminDashboardSchema,
  type AdminDashboard,
  type AdminFixture,
  type AdminLoad,
} from "./contract";

const REFRESHED_AT = "2026-03-21T07:32:00.000Z";
const UPDATED_AT = "2026-03-21T07:28:00.000Z";
const PROVIDER_CHECKED_AT = "2026-03-21T07:20:00.000Z";
const FAILED_AT = "2026-03-21T06:45:00.000Z";

const EMPTY_SECTION = {
  status: "ok" as const,
  rows: [],
  updatedAt: UPDATED_AT,
};

function baseDashboard(fixture: AdminFixture): AdminDashboard {
  return {
    fixture,
    session: {
      environment: "SIMULATION",
      environmentLabel: "Local · data simulasi",
      role: "ADMIN",
      roleLabel: "Platform admin",
      mfaActive: false,
      scope: "Operasi, pembayaran, template, audit",
      lastRefreshed: REFRESHED_AT,
    },
    freshness: {
      status: "fresh",
      message: "Data simulasi diperbarui pada permintaan terakhir.",
    },
    attention: EMPTY_SECTION,
    payments: {
      status: "ok",
      rows: [
        {
          id: "payment-example-001",
          reference: "PAY-EXAMPLE-001",
          severity: "healthy",
          status: "Terverifikasi",
          owner: "Finance queue",
          age: "12 menit",
          updatedAt: UPDATED_AT,
          orderReference: "ORD-EXAMPLE-1204",
          paymentReference: "PMT-EXAMPLE-8451",
          maskedCustomer: "R*** & B*** · workspace disamarkan",
          provider: "Midtrans",
          method: "QRIS",
          internalStatus: "PAID",
          providerStatus: "settlement",
          amountMinor: "349000",
          currency: "IDR",
          reconciliation: "Cocok",
          lastProviderCheck: PROVIDER_CHECKED_AT,
          details: [
            { label: "Email", value: "e***@contoh.test", masked: true },
            { label: "Notifikasi", value: "Terverifikasi", masked: false },
          ],
        },
      ],
      updatedAt: UPDATED_AT,
    },
    failedJobs: EMPTY_SECTION,
    publicationFailures: EMPTY_SECTION,
    printing: EMPTY_SECTION,
    support: EMPTY_SECTION,
    templates: {
      status: "ok",
      rows: [
        {
          id: "template-example-001",
          reference: "TPL-EXAMPLE-001",
          severity: "healthy",
          status: "Aktif",
          owner: "Template team",
          age: "—",
          updatedAt: UPDATED_AT,
          templateId: "seruni",
          name: "Seruni",
          availability: "Active",
          version: "v3",
          packageLink: "Digital Invitation Core",
          readiness: "Demo dan publikasi siap",
          lastChanged: "2026-03-18T04:00:00.000Z",
          reason: "Versi berlisensi dan telah melewati pemeriksaan manifest.",
        },
      ],
      updatedAt: UPDATED_AT,
    },
    lifecycle: EMPTY_SECTION,
    audit: {
      status: "ok",
      rows: [
        {
          id: "audit-example-001",
          timestamp: UPDATED_AT,
          actor: "admin-***42",
          role: "ADMIN",
          action: "Membuka ringkasan operasional",
          target: "Admin dashboard",
          reason: "—",
          result: "Berhasil",
          correlationId: "corr-example-9f2a",
          masked: true,
        },
      ],
      updatedAt: UPDATED_AT,
    },
  };
}

function attentionDashboard(): AdminDashboard {
  const dashboard = baseDashboard("attention");
  dashboard.attention = {
    status: "ok",
    updatedAt: UPDATED_AT,
    rows: [
      {
        id: "attention-example-001",
        reference: "PAY-EXAMPLE-017",
        severity: "critical",
        status: "Perlu rekonsiliasi",
        owner: "Belum ditetapkan",
        age: "2 jam",
        updatedAt: UPDATED_AT,
        issue: "Status pembayaran belum cocok",
        summary:
          "Notifikasi provider diterima, tetapi status internal masih menunggu verifikasi.",
        suggestedAction: "Periksa kembali melalui rekonsiliasi server",
        targetSection: "payments",
      },
      {
        id: "attention-example-002",
        reference: "PUB-EXAMPLE-008",
        severity: "high",
        status: "Publikasi gagal",
        owner: "Platform queue",
        age: "47 menit",
        updatedAt: FAILED_AT,
        issue: "Percobaan publikasi snapshot gagal",
        summary:
          "Versi publik sebelumnya masih aktif; tidak ada perubahan publik yang diterapkan.",
        suggestedAction: "Tinjau tahap publikasi yang gagal",
        targetSection: "publication-failures",
      },
      {
        id: "attention-example-003",
        reference: "JOB-EXAMPLE-031",
        severity: "warning",
        status: "Retry diblokir",
        owner: "Worker queue",
        age: "1 jam",
        updatedAt: FAILED_AT,
        issue: "Pekerjaan media membutuhkan pemeriksaan",
        summary: "Retry otomatis ditahan untuk mencegah efek samping ganda.",
        suggestedAction: "Tinjau alasan kegagalan dan idempotensi",
        targetSection: "failed-jobs",
      },
    ],
  };

  dashboard.payments = {
    status: "ok",
    updatedAt: UPDATED_AT,
    rows: [
      {
        id: "payment-example-017",
        reference: "PAY-EXAMPLE-017",
        severity: "critical",
        status: "Tinjauan manual",
        owner: "Belum ditetapkan",
        age: "2 jam",
        updatedAt: UPDATED_AT,
        orderReference: "ORD-EXAMPLE-1218",
        paymentReference: "PMT-EXAMPLE-8510",
        maskedCustomer: "A*** & D*** · workspace disamarkan",
        provider: "Midtrans",
        method: "QRIS",
        internalStatus: "PENDING",
        providerStatus: "settlement",
        amountMinor: "499000",
        currency: "IDR",
        reconciliation: "Status belum cocok",
        lastProviderCheck: PROVIDER_CHECKED_AT,
        details: [
          { label: "Email", value: "a***@contoh.test", masked: true },
          {
            label: "Redirect browser",
            value: "Bukan sumber kebenaran pembayaran",
            masked: false,
          },
        ],
      },
      {
        id: "payment-example-018",
        reference: "PAY-EXAMPLE-018",
        severity: "warning",
        status: "Notifikasi terlambat",
        owner: "Finance queue",
        age: "31 menit",
        updatedAt: UPDATED_AT,
        orderReference: "ORD-EXAMPLE-1220",
        paymentReference: "PMT-EXAMPLE-8512",
        maskedCustomer: "S*** & R*** · workspace disamarkan",
        provider: "Midtrans",
        method: "QRIS",
        internalStatus: "PENDING",
        providerStatus: "pending",
        amountMinor: "249000",
        currency: "IDR",
        reconciliation: "Menunggu notifikasi terverifikasi",
        lastProviderCheck: "2026-03-21T07:00:00.000Z",
        details: [
          { label: "Email", value: "s***@contoh.test", masked: true },
          {
            label: "Pemeriksaan berikutnya",
            value: "Menunggu tindakan server",
            masked: false,
          },
        ],
      },
    ],
  };

  dashboard.failedJobs = {
    status: "ok",
    updatedAt: UPDATED_AT,
    rows: [
      {
        id: "job-example-031",
        reference: "JOB-EXAMPLE-031",
        severity: "warning",
        status: "Retry diblokir",
        owner: "Worker queue",
        age: "1 jam",
        updatedAt: FAILED_AT,
        jobType: "Media processing",
        queue: "media.default",
        failureReason:
          "Asset tidak lolos pemeriksaan format pada tahap pemrosesan.",
        attempts: 3,
        firstFailedAt: "2026-03-21T05:45:00.000Z",
        lastFailedAt: FAILED_AT,
        retryState: "Perlu konfirmasi idempotensi",
        relatedResource: "Media asset disamarkan",
        details: [
          {
            label: "Stack trace",
            value: "Disembunyikan dari ringkasan",
            masked: true,
          },
          {
            label: "Side effect",
            value: "Belum dijalankan ulang",
            masked: false,
          },
        ],
      },
    ],
  };

  dashboard.publicationFailures = {
    status: "ok",
    updatedAt: UPDATED_AT,
    rows: [
      {
        id: "publication-example-008",
        reference: "PUB-EXAMPLE-008",
        severity: "high",
        status: "Gagal",
        owner: "Platform queue",
        age: "47 menit",
        updatedAt: FAILED_AT,
        invitationReference: "INV-EXAMPLE-044",
        attemptedVersion: 8,
        currentPublishedVersion: 7,
        failureStage: "Validasi snapshot",
        failedAt: FAILED_AT,
        previousSnapshotActive: true,
        retryState: "Menunggu pemeriksaan",
        details: [
          { label: "Versi dicoba", value: "Snapshot v8", masked: false },
          {
            label: "Versi publik",
            value: "Snapshot v7 masih aktif",
            masked: false,
          },
        ],
      },
    ],
  };

  dashboard.printing = {
    status: "ok",
    updatedAt: UPDATED_AT,
    rows: [
      {
        id: "printing-example-004",
        reference: "PRINT-EXAMPLE-004",
        severity: "info",
        status: "Menunggu vendor",
        owner: "Fulfillment",
        age: "6 jam",
        updatedAt: UPDATED_AT,
        orderReference: "PRINT-EXAMPLE-004",
        maskedWorkspace: "Workspace disamarkan",
        vendor: "Vendor terverifikasi",
        productionStatus: "Proof pending",
        shippingStatus: "Belum dikirim",
        lastProviderUpdate: "2026-03-21T02:00:00.000Z",
        stuckFor: "Belum melewati ambang eskalasi",
        escalationState: "Tidak dieskalasikan",
      },
    ],
  };

  dashboard.support = {
    status: "ok",
    updatedAt: UPDATED_AT,
    rows: [
      {
        id: "support-example-012",
        reference: "CASE-EXAMPLE-012",
        severity: "high",
        status: "Menunggu internal",
        owner: "Support queue",
        age: "3 jam",
        updatedAt: UPDATED_AT,
        caseId: "CASE-EXAMPLE-012",
        category: "Pembayaran",
        maskedWorkspace: "Workspace disamarkan",
        lastResponse: "Belum ada balasan internal",
        escalationState: "Perlu ditinjau finance",
      },
    ],
  };

  dashboard.lifecycle = {
    status: "ok",
    updatedAt: UPDATED_AT,
    rows: [
      {
        id: "lifecycle-example-005",
        reference: "ENT-EXAMPLE-005",
        severity: "warning",
        status: "Pengecualian",
        owner: "Commerce queue",
        age: "29 menit",
        updatedAt: UPDATED_AT,
        resourceType: "Entitlement",
        currentState: "Payment PAID",
        expectedState: "Entitlement ACTIVE",
        impact: "Customer belum dapat melanjutkan ke editor.",
        suggestedAction: "Periksa konsistensi event pembayaran",
        lastTransition: "2026-03-21T07:03:00.000Z",
      },
    ],
  };

  return dashboard;
}

function fixtureDashboard(fixture: AdminFixture): AdminDashboard {
  if (
    fixture === "attention" ||
    fixture === "stale" ||
    fixture === "audit-unavailable"
  ) {
    const dashboard = attentionDashboard();
    dashboard.fixture = fixture;
    if (fixture === "stale") {
      dashboard.freshness = {
        status: "stale",
        message:
          "Data simulasi belum diperbarui. Periksa kembali sebelum mengambil keputusan operasional.",
      };
    }
    if (fixture === "audit-unavailable") {
      dashboard.audit = {
        status: "unavailable",
        message:
          "Layanan audit sedang tidak tersedia. Data operasional lain tetap dapat dibaca.",
      };
    }
    return dashboard;
  }

  const dashboard = baseDashboard(fixture);
  if (fixture === "provider-unavailable") {
    dashboard.payments = {
      status: "unavailable",
      message:
        "Provider pembayaran tidak dapat dihubungi. Status internal tidak diubah oleh halaman ini.",
    };
    dashboard.printing = {
      status: "unavailable",
      message:
        "Pembaruan vendor printing belum tersedia. Coba lagi setelah provider pulih.",
    };
  }
  return dashboard;
}

export function getAdminFixtureNames(): readonly AdminFixture[] {
  return ADMIN_FIXTURES;
}

export async function loadAdminDashboard(
  fixture: AdminFixture,
): Promise<AdminLoad> {
  await new Promise<void>((resolve) => setTimeout(resolve, 60));
  if (fixture === "permission-denied") {
    return {
      kind: "permission-denied",
      message: "Akun ini belum memiliki izin untuk membuka konsol operasi.",
    };
  }
  if (fixture === "session-expired") {
    return {
      kind: "session-expired",
      message:
        "Sesi admin berakhir. Masuk kembali dengan MFA untuk melanjutkan.",
    };
  }

  return {
    kind: "ok",
    data: adminDashboardSchema.parse(fixtureDashboard(fixture)),
  };
}
