import type { Metadata } from "next";
import { AuthShell } from "../../components/auth/auth-shell";
import { RegisterForm } from "../../components/auth/register-form";
import { safeRedirectTarget } from "../../lib/auth/redirect";
import "../auth.css";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

const title = "Buat akun — Undangania";
const description =
  "Buat akun Undangania. Satu akun untuk mengelola undangan pernikahan digital Anda.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title,
  description,
  alternates: { canonical: "/daftar" },
  openGraph: {
    type: "website",
    locale: "id_ID",
    url: "/daftar",
    title,
    description,
    siteName: "Undangania",
  },
};

interface DaftarPageProps {
  searchParams: Promise<{ next?: string | string[] }>;
}

export default async function DaftarPage({ searchParams }: DaftarPageProps) {
  const params = await searchParams;
  const rawNext = Array.isArray(params.next) ? params.next[0] : params.next;
  const next = safeRedirectTarget(rawNext);

  return (
    <AuthShell>
      <RegisterForm next={next} />
    </AuthShell>
  );
}
