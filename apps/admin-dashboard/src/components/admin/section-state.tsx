import { Alert } from "../ui/alert";
import type { SectionStatus } from "../../lib/admin/contract";
import { AdminRefreshControl } from "./admin-refresh-control";

type SectionStateProps = {
  status: SectionStatus;
  message?: string;
  emptyTitle?: string;
  emptyDescription?: string;
};

export function SectionState({
  status,
  message,
  emptyTitle = "Tidak ada item",
  emptyDescription = "Tidak ada data yang perlu ditampilkan pada bagian ini.",
}: SectionStateProps) {
  if (status === "permission-denied") return <Alert variant="warning" title="Akses bagian ini dibatasi">{message ?? "Peran saat ini tidak memiliki izin untuk membaca data ini."}</Alert>;
  if (status === "unavailable") return <Alert variant="error" title="Data belum tersedia">{message ?? "Layanan sumber data sedang tidak tersedia."} <span className="mt-2 inline-flex"><AdminRefreshControl /></span></Alert>;
  return <div className="border border-dashed border-[var(--color-line)] p-5 text-sm text-[var(--color-ink-soft)]"><strong className="block text-[var(--color-ink)]">{emptyTitle}</strong><span className="mt-1 block">{emptyDescription}</span></div>;
}
