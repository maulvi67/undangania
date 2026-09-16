import type { Metadata } from "next";
import Link from "next/link";
import { AuthShell } from "../../components/auth/auth-shell";
import { ResendEmailForm } from "../../components/auth/resend-email-form";
import { TokenStatePanel } from "../../components/auth/token-state-panel";
import { consumeVerificationToken } from "../../lib/auth/token-check";
import "../auth.css";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

const title = "Verifikasi email — Wedding System";
const description =
  "Verifikasi alamat email Anda untuk mengaktifkan akun Wedding System.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title,
  description,
  alternates: { canonical: "/verifikasi" },
  robots: { index: false },
  openGraph: {
    type: "website",
    locale: "id_ID",
    url: "/verifikasi",
    title,
    description,
    siteName: "Wedding System",
  },
};

interface VerifikasiPageProps {
  searchParams: Promise<{ token?: string | string[] }>;
}

export default async function VerifikasiPage({
  searchParams,
}: VerifikasiPageProps) {
  const params = await searchParams;
  const rawToken = Array.isArray(params.token) ? params.token[0] : params.token;
  // Clicking the link is the act of verifying, so the token is consumed here and
  // the panel below only claims success once the address is actually verified.
  const check = rawToken ? await consumeVerificationToken(rawToken) : undefined;

  return (
    <AuthShell>
      {check ? (
        check.kind === "valid" ? (
          <section className="auth-panel">
            <h1 className="auth-panel__title" tabIndex={-1}>
              Email terverifikasi
            </h1>
            <p className="auth-panel__body">
              Akun Anda sudah aktif. Silakan masuk untuk melanjutkan.
            </p>
            <div className="auth-panel__actions">
              <Link
                className="ui-button ui-button--primary ui-button--lg"
                href="/masuk"
              >
                Masuk
              </Link>
            </div>
          </section>
        ) : (
          <TokenStatePanel
            kind={check.kind === "expired" ? "expired" : "invalid"}
            flow="verification"
          />
        )
      ) : (
        <ResendEmailForm />
      )}
    </AuthShell>
  );
}
