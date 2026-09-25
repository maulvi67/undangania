import { describe, expect, it } from "vitest";
import { maskedAuditCsv, parseMaskedAuditExport } from "./audit-export";

describe("masked audit export", () => {
  it("accepts only complete rows explicitly marked masked", () => {
    const rows = parseMaskedAuditExport({
      data: {
        auditRows: [
          {
            id: "audit-1",
            timestamp: "2026-09-22T09:00:00.000Z",
            actor: "ad***",
            role: "ADMIN",
            action: "ADMIN_EXPORT_AUDIT",
            target: "AuditEvent:au***",
            reason: "operasional",
            result: "tercatat",
            correlationId: "corr-1",
            masked: true,
          },
          {
            id: "raw-audit",
            actor: "admin-1",
            masked: false,
          },
        ],
      },
    });

    expect(rows).toHaveLength(1);
    expect(rows[0]?.actor).toBe("ad***");
    expect(JSON.stringify(rows)).not.toContain("admin-1");
  });

  it("returns an empty export for an invalid response envelope", () => {
    expect(
      parseMaskedAuditExport({ data: { auditRows: "not-an-array" } }),
    ).toEqual([]);
    expect(parseMaskedAuditExport(null)).toEqual([]);
  });

  it("escapes CSV cells and neutralizes spreadsheet formulas", () => {
    const csv = maskedAuditCsv([
      {
        id: "audit-1",
        timestamp: "2026-09-22T09:00:00.000Z",
        actor: "ad***",
        role: "ADMIN",
        action: "=IMPORTDATA('x')",
        target: "Audit:au***",
        reason: "contains, comma",
        result: "tercatat",
        correlationId: "corr-1",
        masked: true,
      },
    ]);

    expect(csv).toContain("\"'=IMPORTDATA('x')\"");
    expect(csv).toContain('"contains, comma"');
  });
});
