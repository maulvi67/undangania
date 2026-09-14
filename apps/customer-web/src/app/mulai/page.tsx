import type { Metadata } from "next";
import { AuthShell } from "../../components/auth/auth-shell";
import { OnboardingFlow } from "../../components/onboarding/onboarding-flow";
import { getActiveTemplates } from "../../components/templates/template-data";
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
