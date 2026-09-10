import type { Metadata } from "next";
import Link from "next/link";
import { AuthShell } from "../../components/auth/auth-shell";
import { signInHref } from "../../lib/auth/redirect";
import "../auth.css";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

const title = "Sesi berakhir — Wedding System";
const description = "Untuk keamanan, silakan masuk kembali untuk melanjutkan.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title,
  description,
  alternates: { canonical: "/sesi-berakhir" },
  robots: { index: false },
  openGraph: {
    type: "website",
    locale: "id_ID",
    url: "/sesi-berakhir",
    title,
    description,
    siteName: "Wedding System",
  },
};

interface SesiBerakhirPageProps {
  searchParams: Promise<{ next?: string | string[] }>;
}

export default async function SesiBerakhirPage({ searchParams }: SesiBerakhirPageProps) {
  const params = await searchParams;
  const rawNext = Array.isArray(params.next) ? params.next[0] : params.next;
  const href = signInHref(rawNext);

  return (
    <AuthShell>
      <section className="auth-panel">
        <h1 className="auth-panel__title" tabIndex={-1}>
          Sesi Anda berakhir
        </h1>
        <p className="auth-panel__body">
          Untuk keamanan, Anda diminta masuk kembali.
        </p>
        <div className="auth-panel__actions">
          <Link className="ui-button ui-button--primary ui-button--lg" href={href}>
            Masuk kembali
          </Link>
        </div>
        <div className="auth-links">
          <Link href="/">Kembali ke beranda</Link>
        </div>
      </section>
    </AuthShell>
  );
}
