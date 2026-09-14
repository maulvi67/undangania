import { Alert, Button, ErrorState, EmptyState } from "@wedding/ui";
import type { SectionStatus } from "../../lib/admin/contract";

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
  if (status === "permission-denied") {
    return (
      <Alert variant="warning" title="Akses bagian ini dibatasi">
        {message ??
          "Peran saat ini tidak memiliki izin untuk membaca data ini."}
      </Alert>
    );
  }

  if (status === "unavailable") {
    return (
      <ErrorState
        title="Data belum tersedia"
        description={message ?? "Layanan sumber data sedang tidak tersedia."}
        action={
          <Button variant="secondary">Coba lagi setelah layanan pulih</Button>
        }
      />
    );
  }

  return <EmptyState title={emptyTitle} description={emptyDescription} />;
}
