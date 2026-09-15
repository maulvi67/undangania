import type { Metadata } from "next";
import { StatePanel } from "@wedding/ui";
import { AuthShell } from "../../components/auth/auth-shell";
import { OnboardingFlow } from "../../components/onboarding/onboarding-flow";
import { getActiveTemplates } from "../../components/templates/template-data";
import { getAuthenticatedRequest } from "../../lib/auth/server";
import "../onboarding.css";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

const title = "Mulai persiapan undangan — Wedding System";
const description =
  "Isi data dasar pernikahan Anda — mempelai, acara pertama, dan preferensi — lalu mulai menyusun undangan digital Anda.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title,
  description,
  alternates: { canonical: "/mulai" },
  openGraph: {
    type: "website",
    locale: "id_ID",
    url: "/mulai",
    title,
    description,
    siteName: "Wedding System",
  },
};

interface MulaiPageProps {
  searchParams: Promise<{ template?: string | string[] }>;
}

export default async function MulaiPage({ searchParams }: MulaiPageProps) {
  if (process.env.NODE_ENV === "production") {
    const authenticated = await getAuthenticatedRequest();
    return authenticated === null ? (
      <AuthShell>
        <StatePanel
          title="Masuk untuk mulai"
          description="Masuk ke akun Wedding System untuk menyiapkan workspace undangan Anda."
          action={
            <a
              className="ui-button ui-button--primary ui-button--lg"
              href="/masuk?next=%2Fmulai"
            >
              Masuk
            </a>
          }
        />
      </AuthShell>
    ) : (
      <AuthShell>
        <StatePanel
          title="Persiapan workspace belum tersedia"
          description="Layanan onboarding belum dapat menyimpan data dari lingkungan produksi."
          action={
            <a className="ui-button ui-button--secondary ui-button--lg" href="/dashboard">
              Kembali ke dasbor
            </a>
          }
        />
      </AuthShell>
    );
  }

  const params = await searchParams;
  const rawTemplate = Array.isArray(params.template) ? params.template[0] : params.template;
  // Validasi sisi server terhadap koleksi aktif — nilai lain diabaikan diam-diam
  // (rencana §2); diteruskan ke /editor saat selesai.
  const templateId =
    rawTemplate !== undefined &&
    getActiveTemplates().some((template) => template.id === rawTemplate)
      ? rawTemplate
      : "";

  return (
    <AuthShell>
      <OnboardingFlow templateId={templateId} />
    </AuthShell>
  );
}
