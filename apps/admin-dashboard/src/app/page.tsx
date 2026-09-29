import type { Metadata } from "next";
import { toTenantContext } from "@wedding/application";
import { AdminDashboardView } from "../components/admin/admin-dashboard";
import { parseAdminFixture, parseAdminQuery } from "../lib/admin/contract";
import { loadAdminDashboard } from "../lib/admin/fixture-transport";
import { loadAdminDashboardFromDatabase } from "../lib/admin/production-transport";
import { getAdminAccess } from "../lib/admin/server-auth";

export const metadata: Metadata = {
  title: "Ringkasan operasi — Undangania",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

type AdminPageProps = {
  searchParams: Promise<{
    state?: string | string[];
    page?: string | string[];
    limit?: string | string[];
    search?: string | string[];
  }>;
};

export default async function AdminPage({ searchParams }: AdminPageProps) {
  const params = await searchParams;
  const query = parseAdminQuery(params);

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
    tenantId: access.tenantId,
    now: new Date(),
    role: "ADMIN",
    mfaActive: access.mfaEnabled,
    environment: "PRODUCTION",
    environmentLabel: "Produksi",
    query,
  });

  return <AdminDashboardView result={result} />;
}
