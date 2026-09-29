export const OPERATIONS_SECTION_DEFINITIONS = [
  { key: "attention", label: "Perlu perhatian" },
  { key: "payments", label: "Pembayaran" },
  { key: "failedJobs", label: "Pekerjaan gagal" },
  { key: "publicationFailures", label: "Publikasi" },
  { key: "printing", label: "Produksi cetak" },
  { key: "support", label: "Dukungan" },
  { key: "templates", label: "Template" },
  { key: "lifecycle", label: "Siklus hidup" },
  { key: "audit", label: "Audit" },
] as const;

export type OperationsSectionKey =
  (typeof OPERATIONS_SECTION_DEFINITIONS)[number]["key"];

export type OperationsSectionSnapshot =
  | { status: "ok"; rows: readonly unknown[] }
  | {
      status: "unavailable" | "permission-denied";
      message: string;
    };

export type OperationsSectionData = Readonly<
  Record<OperationsSectionKey, OperationsSectionSnapshot>
>;

export type OperationsSummaryRow = {
  key: OperationsSectionKey;
  label: string;
  status: OperationsSectionSnapshot["status"];
  rowCount: number | null;
};

export type OperationsSummary = {
  sections: OperationsSummaryRow[];
  chartData: Array<{ key: OperationsSectionKey; label: string; count: number }>;
  visibleRowCount: number;
  unavailableSectionCount: number;
};

export function getSectionRowCount(
  section: OperationsSectionSnapshot,
): number | null {
  return section.status === "ok" ? section.rows.length : null;
}

export function formatSectionRowCount(
  section: OperationsSectionSnapshot,
): string {
  const count = getSectionRowCount(section);
  return count === null ? "—" : String(count);
}

export function getOperationsSummary(
  data: OperationsSectionData,
): OperationsSummary {
  const sections = OPERATIONS_SECTION_DEFINITIONS.map(({ key, label }) => {
    const section = data[key];

    return {
      key,
      label,
      status: section.status,
      rowCount: getSectionRowCount(section),
    };
  });
  const chartData = sections.flatMap((section) =>
    section.rowCount === null
      ? []
      : [{ key: section.key, label: section.label, count: section.rowCount }],
  );

  return {
    sections,
    chartData,
    visibleRowCount: chartData.reduce(
      (total, section) => total + section.count,
      0,
    ),
    unavailableSectionCount: sections.filter(
      (section) => section.rowCount === null,
    ).length,
  };
}
