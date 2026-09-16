import type { Metadata } from "next";
import { toTenantContext } from "@wedding/application";
import { AdminDashboardView } from "../components/admin/admin-dashboard";
import { parseAdminFixture } from "../lib/admin/contract";
import { loadAdminDashboard } from "../lib/admin/fixture-transport";
import { loadAdminDashboardFromDatabase } from "../lib/admin/production-transport";
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
  const params = await searchParams;

  if (process.env.NODE_ENV !== "production") {
    const fixture = parseAdminFixture(params.state);
    return <AdminDashboardView result={await loadAdminDashboard(fixture)} />;
  }

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

  // `getAdminAccess` already proved an ADMIN role with MFA active, so the context
  // is built from the verified membership rather than from the request.
  const context = toTenantContext(
    {
      actorId: access.userId,
      sessionId: "",
      tenantId: access.tenantId,
      roles: ["ADMIN"],
    },
    access.tenantId,
  );

  const result = await loadAdminDashboardFromDatabase({
    context,
    // The console reads platform-wide sections, which the use-case permits only
    // for a caller that asked for no tenant. A platform admin is exactly that
    // caller: their own tenant is not the scope of the operations view.
    tenantId: null,
    now: new Date(),
    role: "ADMIN",
    mfaActive: access.mfaEnabled,
    environment: "PRODUCTION",
    environmentLabel: "Produksi",
  });

  return <AdminDashboardView result={result} />;
}
