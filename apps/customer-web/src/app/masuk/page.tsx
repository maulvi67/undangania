import type { Metadata } from "next";
import { SignInView } from "../../components/auth/sign-in-view";
import { safeRedirectTarget } from "../../lib/auth/redirect";
import "../auth-view.css";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

const title = "Masuk — Undangania";
const description =
  "Masuk ke akun Undangania Anda untuk melanjutkan persiapan undangan pernikahan digital Anda.";

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
    siteName: "Undangania",
  },
};

interface MasukPageProps {
  searchParams: Promise<{ next?: string | string[]; oauth?: string | string[] }>;
}

export default async function MasukPage({ searchParams }: MasukPageProps) {
  const params = await searchParams;
  const rawNext = Array.isArray(params.next) ? params.next[0] : params.next;
  const next = safeRedirectTarget(rawNext);
  const rawOauth = Array.isArray(params.oauth) ? params.oauth[0] : params.oauth;
  const oauthError =
    rawOauth === "failed" || rawOauth === "unavailable" ? rawOauth : undefined;

  return <SignInView next={next} oauthError={oauthError} />;
}
