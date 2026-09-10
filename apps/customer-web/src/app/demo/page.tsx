import { redirect } from "next/navigation";
import { DEFAULT_TEMPLATE_ID } from "../../components/templates/template-data";

/**
 * Landing page's "Lihat demo undangan lengkap" entry point.
 * Redirects to the default template's demo; swap to a curated picker
 * when the catalog ships (MVP-UI-003).
 */
export default function DemoRedirectPage() {
  redirect(`/templates/${DEFAULT_TEMPLATE_ID}/demo`);
}
