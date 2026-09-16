import type { Metadata } from "next";
import { AuthShell } from "../../components/auth/auth-shell";
import { ResetPasswordForm } from "../../components/auth/reset-password-form";
import { TokenStatePanel } from "../../components/auth/token-state-panel";
import { checkResetToken } from "../../lib/auth/token-check";
import "../auth.css";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

const title = "Atur ulang kata sandi — Wedding System";
const description = "Atur kata sandi baru untuk akun Wedding System Anda.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title,
  description,
  alternates: { canonical: "/reset-sandi" },
  robots: { index: false },
  openGraph: {
    type: "website",
    locale: "id_ID",
    url: "/reset-sandi",
    title,
    description,
    siteName: "Wedding System",
  },
};

interface ResetSandiPageProps {
  searchParams: Promise<{ token?: string | string[] }>;
}

export default async function ResetSandiPage({
  searchParams,
}: ResetSandiPageProps) {
  const params = await searchParams;
  const rawToken = Array.isArray(params.token) ? params.token[0] : params.token;
  // Inspection only — the token is spent when the form is submitted, not when the
  // page is loaded, so a prefetching mail client cannot burn the link.
  const check = rawToken ? await checkResetToken(rawToken) : undefined;

  return (
    <AuthShell>
      {check?.kind === "valid" && rawToken ? (
        <ResetPasswordForm token={rawToken} />
      ) : (
        <TokenStatePanel
          kind={check?.kind === "expired" ? "expired" : "invalid"}
          flow="reset"
        />
      )}
    </AuthShell>
  );
}
