// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const { exportGuestRosterAction } = vi.hoisted(() => ({
  exportGuestRosterAction: vi.fn(),
}));

vi.mock("../../lib/guests/actions", () => ({
  exportGuestRosterAction,
}));

import { GuestExportAction } from "./guest-export-action";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("GuestExportAction", () => {
  it("requests a real CSV and starts a browser download", async () => {
    exportGuestRosterAction.mockResolvedValueOnce({
      kind: "ok",
      filename: "daftar-tamu-2026-09-17.csv",
      contentType: "text/csv;charset=utf-8",
      csv: "nama_rumah_tangga\r\n",
      householdCount: 1,
      guestCount: 1,
    });
    const createObjectUrl = vi.fn(() => "blob:guest-export");
    const revokeObjectUrl = vi.fn();
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: createObjectUrl,
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      value: revokeObjectUrl,
    });
    const anchorClick = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => undefined);

    render(<GuestExportAction canExport householdIds={["hh-1"]} />);
    fireEvent.click(screen.getByRole("button", { name: "Ekspor daftar tamu" }));

    expect(exportGuestRosterAction).toHaveBeenCalledWith({
      householdIds: ["hh-1"],
    });
    expect(await screen.findByText(/1 rumah tangga dan 1 tamu/)).toBeTruthy();
    expect(createObjectUrl).toHaveBeenCalledOnce();
    expect(anchorClick).toHaveBeenCalledOnce();
    expect(revokeObjectUrl).toHaveBeenCalledWith("blob:guest-export");

    anchorClick.mockRestore();
  });

  it("shows the server failure without simulating a completed export", async () => {
    exportGuestRosterAction.mockResolvedValueOnce({ kind: "forbidden" });

    render(<GuestExportAction canExport />);
    fireEvent.click(screen.getByRole("button", { name: "Ekspor daftar tamu" }));

    expect(
      await screen.findByText(
        "Anda tidak memiliki izin untuk mengekspor daftar tamu.",
      ),
    ).toBeTruthy();
    expect(screen.queryByText(/simulasi/i)).toBeNull();
  });

  it("does not call the action for a restricted role", () => {
    render(<GuestExportAction canExport={false} />);
    expect(
      screen.getByRole("button", { name: "Ekspor daftar tamu" }),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Ekspor daftar tamu" }));
    expect(exportGuestRosterAction).not.toHaveBeenCalled();
  });
});
