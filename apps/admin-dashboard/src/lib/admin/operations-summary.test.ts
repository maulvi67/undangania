import { describe, expect, it } from "vitest";
import {
  formatSectionRowCount,
  getOperationsSummary,
  getSectionRowCount,
  type OperationsSectionData,
  type OperationsSectionSnapshot,
} from "./operations-summary";

const emptySection: OperationsSectionSnapshot = { status: "ok", rows: [] };

function makeSections(): OperationsSectionData {
  return {
    attention: emptySection,
    payments: emptySection,
    failedJobs: emptySection,
    publicationFailures: emptySection,
    printing: emptySection,
    support: emptySection,
    templates: emptySection,
    lifecycle: emptySection,
    audit: emptySection,
  };
}

describe("admin operations summary", () => {
  it("counts rows only when a section is available", () => {
    expect(
      getSectionRowCount({ status: "ok", rows: [{ id: "one" }, {}] }),
    ).toBe(2);
    expect(getSectionRowCount({ status: "ok", rows: [] })).toBe(0);
    expect(
      getSectionRowCount({
        status: "unavailable",
        message: "Upstream unavailable",
      }),
    ).toBeNull();
    expect(
      formatSectionRowCount({
        status: "permission-denied",
        message: "Restricted",
      }),
    ).toBe("—");
  });

  it("excludes unavailable sections from visible row totals and chart values", () => {
    const data = {
      ...makeSections(),
      attention: { status: "ok", rows: [{ id: "one" }, { id: "two" }] },
      payments: { status: "unavailable", message: "Provider unavailable" },
      failedJobs: { status: "permission-denied", message: "Restricted" },
    } satisfies OperationsSectionData;

    const summary = getOperationsSummary(data);

    expect(summary.visibleRowCount).toBe(2);
    expect(summary.unavailableSectionCount).toBe(2);
    expect(summary.chartData.find(({ key }) => key === "attention")).toEqual({
      key: "attention",
      label: "Perlu perhatian",
      count: 2,
    });
    expect(summary.chartData.some(({ key }) => key === "payments")).toBe(false);
    expect(
      summary.sections.find(({ key }) => key === "payments")?.rowCount,
    ).toBeNull();
  });
});
