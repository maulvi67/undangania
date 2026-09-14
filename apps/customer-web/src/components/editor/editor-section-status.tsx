import { Badge } from "@wedding/ui";
import {
  sectionStatus,
  type EditorContent,
  type EditorSectionId,
  type EditorTemplate,
} from "../../lib/editor/contract";

const labels = {
  complete: "Lengkap",
  incomplete: "Belum lengkap",
  optional: "Opsional",
  attention: "Perlu diperiksa",
  locked: "Tidak tersedia",
} as const;

export function EditorSectionStatus({
  content,
  section,
  template,
}: {
  content: EditorContent;
  section: EditorSectionId;
  template: EditorTemplate;
}) {
  const status = sectionStatus(content, section, template.manifest);
  const tone =
    status === "complete"
      ? "olive"
      : status === "attention"
        ? "blush"
        : status === "optional"
          ? "neutral"
          : "gold";
  return <Badge tone={tone}>{labels[status]}</Badge>;
}
