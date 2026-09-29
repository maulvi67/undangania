import type { Metadata } from "next";
import { AuthShell } from "../../components/auth/auth-shell";
import { ForgotPasswordForm } from "../../components/auth/forgot-password-form";
import "../auth.css";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

const title = "Lupa kata sandi — Undangania";
const description =
  "Kirim tautan pemulihan untuk mengatur ulang kata sandi akun Undangania Anda.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title,
  description,
  alternates: { canonical: "/lupa-sandi" },
  openGraph: {
    type: "website",
    locale: "id_ID",
    url: "/lupa-sandi",
    title,
    description,
    siteName: "Undangania",
  },
};

export default function LupaSandiPage() {
  return (
    <AuthShell>
      <ForgotPasswordForm />
    </AuthShell>
  );
}
