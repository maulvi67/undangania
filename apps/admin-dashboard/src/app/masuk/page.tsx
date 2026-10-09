import type { Metadata } from "next";
import { AdminSignInForm } from "../../components/admin/admin-sign-in-form";
import { safeAdminRedirectTarget } from "../../lib/admin/redirect";

export const metadata: Metadata = {
  title: "Masuk konsol admin — Undangania",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

interface AdminSignInPageProps {
  searchParams: Promise<{ next?: string | string[] }>;
}

export default async function AdminSignInPage({
  searchParams,
}: AdminSignInPageProps) {
  const params = await searchParams;
  const rawNext = Array.isArray(params.next) ? params.next[0] : params.next;
  const next = safeAdminRedirectTarget(rawNext);

  return <AdminSignInForm next={next} />;
}
