export type MaskedAuditExportRow = Readonly<{
  id: string;
  timestamp: string;
  actor: string;
  role: string;
  action: string;
  target: string;
  reason: string;
  result: string;
  correlationId: string;
  masked: true;
}>;

type RecordValue = Record<string, unknown>;

function isRecord(value: unknown): value is RecordValue {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringField(value: RecordValue, key: string): string | null {
  const field = value[key];
  return typeof field === "string" && field.length > 0 ? field : null;
}

function maskedAuditRow(value: unknown): MaskedAuditExportRow | null {
  if (!isRecord(value) || value.masked !== true) return null;

  const id = stringField(value, "id");
  const timestamp = stringField(value, "timestamp");
  const actor = stringField(value, "actor");
  const role = stringField(value, "role");
  const action = stringField(value, "action");
  const target = stringField(value, "target");
  const reason = stringField(value, "reason");
  const result = stringField(value, "result");
  const correlationId = stringField(value, "correlationId");

  if (
    id === null ||
    timestamp === null ||
    actor === null ||
    role === null ||
    action === null ||
    target === null ||
    reason === null ||
    result === null ||
    correlationId === null
  ) {
    return null;
  }

  return {
    id,
    timestamp,
    actor,
    role,
    action,
    target,
    reason,
    result,
    correlationId,
    masked: true,
  };
}

export function parseMaskedAuditExport(value: unknown): MaskedAuditExportRow[] {
  if (!isRecord(value)) return [];
  const data = value.data;
  if (!isRecord(data) || !Array.isArray(data.auditRows)) return [];

  return data.auditRows.flatMap((row) => {
    const parsed = maskedAuditRow(row);
    return parsed === null ? [] : [parsed];
  });
}

function csvCell(value: string): string {
  const safeValue = /^[=+\-@]/u.test(value) ? `'${value}` : value;
  return `"${safeValue.replaceAll('"', '""')}"`;
}

export function maskedAuditCsv(rows: readonly MaskedAuditExportRow[]): string {
  const header = [
    "id",
    "timestamp",
    "actor_masked",
    "role",
    "action",
    "target_masked",
    "reason",
    "result",
    "correlation_id",
  ];
  const lines = rows.map((row) =>
    [
      row.id,
      row.timestamp,
      row.actor,
      row.role,
      row.action,
      row.target,
      row.reason,
      row.result,
      row.correlationId,
    ]
      .map(csvCell)
      .join(","),
  );
  return [header.map(csvCell).join(","), ...lines].join("\r\n");
}

export function downloadMaskedAuditCsv(
  rows: readonly MaskedAuditExportRow[],
  at = new Date(),
): void {
  const filename = `audit-masked-${at.toISOString().slice(0, 10)}.csv`;
  const blob = new Blob([maskedAuditCsv(rows)], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}
