import type { Metadata } from "next";
import { AuthShell } from "../../components/auth/auth-shell";
import { SignInForm } from "../../components/auth/sign-in-form";
import { safeRedirectTarget } from "../../lib/auth/redirect";
import "../auth.css";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

const title = "Masuk — Wedding System";
const description =
  "Masuk ke akun Wedding System Anda untuk melanjutkan persiapan undangan pernikahan digital Anda.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title,
  description,
  alternates: { canonical: "/masuk" },
  openGraph: {
    type: "website",
    locale: "id_ID",
    url: "/masuk",
    title,
    description,
    siteName: "Wedding System",
  },
};

interface MasukPageProps {
  searchParams: Promise<{
    next?: string | string[];
    oauth?: string | string[];
  }>;
}

export default async function MasukPage({ searchParams }: MasukPageProps) {
  const params = await searchParams;
  const rawNext = Array.isArray(params.next) ? params.next[0] : params.next;
  // Server-side validation before the value ever reaches the client form;
  // the action validates again before any redirect.
  const next = safeRedirectTarget(rawNext);
  const rawOAuthError = Array.isArray(params.oauth)
    ? params.oauth[0]
    : params.oauth;
  const oauthError =
    rawOAuthError === "failed" || rawOAuthError === "unavailable"
      ? rawOAuthError
      : undefined;

  return (
    <AuthShell>
      <SignInForm
        next={next}
        {...(oauthError === undefined ? {} : { oauthError })}
      />
    </AuthShell>
  );
}
