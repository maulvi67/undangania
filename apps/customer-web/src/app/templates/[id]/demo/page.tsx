import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Alert, Badge } from "@wedding/ui";
import { DemoInvitation } from "../../../../components/templates/demo/demo-invitation";
import {
  getActiveTemplates,
  getTemplate,
} from "../../../../components/templates/template-data";
import "../../../templates.css";

interface DemoPageProps {
  params: Promise<{ id: string }>;
}

export function generateStaticParams() {
  return getActiveTemplates()
    .filter((template) => template.demo.available)
    .map((template) => ({ id: template.id }));
}

/** Noindex: demo content is synthetic and must not compete with real pages. */
export const metadata: Metadata = {
  title: "Demo undangan — Undangania",
  robots: { index: false, follow: false },
};

export default async function TemplateDemoPage({ params }: DemoPageProps) {
  const { id } = await params;
  const template = getTemplate(id);
  if (!template || template.status !== "ACTIVE" || !template.demo.available) {
    notFound();
  }

  return (
    <div className="ui-shell">
      <a className="ui-skip-link" href="#konten-utama">
        Langsung ke konten utama
      </a>
      <header className="dmv-chrome">
        <a className="dmv-chrome__back" href={`/templates/${template.id}`}>
          ← Kembali ke detail desain
        </a>
        <Badge tone="gold">Demo</Badge>
      </header>
      <main id="konten-utama" tabIndex={-1}>
        <h1 className="ui-visually-hidden">
          Demo undangan desain {template.name}
        </h1>
        <div className="dmv-banner">
          <Alert
            variant="info"
            title="Pratinjau demo — semua data di bawah adalah data contoh."
          >
            Inilah tampilan undangan lengkap dengan desain {template.name},
            dilihat dari sudut pandang tamu Anda.
          </Alert>
        </div>
        <DemoInvitation template={template} />
      </main>
    </div>
  );
}
