import type { Metadata } from "next";
import { AdminDashboardView } from "../components/admin/admin-dashboard";
import { parseAdminFixture } from "../lib/admin/contract";
import { loadAdminDashboard } from "../lib/admin/fixture-transport";
import { getAdminAccess } from "../lib/admin/server-auth";

export const metadata: Metadata = {
  title: "Ringkasan operasi — Wedding System",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

type AdminPageProps = {
  searchParams: Promise<{ state?: string | string[] }>;
};

export default async function AdminPage({ searchParams }: AdminPageProps) {
  if (process.env.NODE_ENV === "production") {
    const access = await getAdminAccess();
    if (access.kind === "unauthenticated" || access.kind === "forbidden") {
      return (
        <AdminDashboardView
          result={{
            kind: "permission-denied",
            message:
              "Masuk dengan akun admin terotorisasi dan MFA aktif untuk membuka konsol operasi.",
          }}
        />
      );
    }
    if (access.kind === "unavailable") {
      return (
        <AdminDashboardView
          result={{
            kind: "unavailable",
            message: "Layanan autentikasi admin sedang tidak tersedia.",
          }}
        />
      );
    }
    return (
      <AdminDashboardView
        result={{
          kind: "unavailable",
          message:
            "Akses admin terverifikasi, tetapi data operasi belum tersedia dari API produksi.",
        }}
      />
    );
  }

  const params = await searchParams;
  const fixture = parseAdminFixture(params.state);
  const result = await loadAdminDashboard(fixture);

  return <AdminDashboardView result={result} />;
}
