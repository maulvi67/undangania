import type { Metadata } from "next";
import { StatePanel } from "@wedding/ui";
import { AuthShell } from "../../components/auth/auth-shell";
import { OnboardingFlow } from "../../components/onboarding/onboarding-flow";
import { getActiveTemplates } from "../../components/templates/template-data";
import { getAuthenticatedRequest } from "../../lib/auth/server";
import { resolveSessionWorkspaceOrNull } from "../../lib/workspace/session-workspace";
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
  const rawTemplate = Array.isArray(params.template)
    ? params.template[0]
    : params.template;
  // Validated server-side against the active collection — any other value is
  // silently ignored and passed through to /editor on completion.
  const templateId =
    rawTemplate !== undefined &&
    getActiveTemplates().some((template) => template.id === rawTemplate)
      ? rawTemplate
      : "";

  const workspace = await resolveSessionWorkspaceOrNull();

  if (workspace === null) {
    const request = await getAuthenticatedRequest();
    return (
      <AuthShell>
        <StatePanel
          title={
            request === null ? "Masuk untuk mulai" : "Workspace belum tersedia"
          }
          description={
            request === null
              ? "Masuk ke akun Wedding System untuk menyiapkan workspace undangan Anda."
              : "Data pernikahan untuk akun ini belum dapat dibuka. Coba muat ulang sebentar lagi."
          }
          action={
            <a
              className="ui-button ui-button--primary ui-button--lg"
              href={request === null ? "/masuk?next=%2Fmulai" : "/dashboard"}
            >
              {request === null ? "Masuk" : "Kembali ke dasbor"}
            </a>
          }
        />
      </AuthShell>
    );
  }

  // The wizard persists to the session's own wedding; the template choice only
  // rides along to the editor once the data is saved.
  return (
    <AuthShell>
      <OnboardingFlow templateId={templateId} />
    </AuthShell>
  );
}
