// @vitest-environment jsdom

import * as React from "react";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GuestImportWizard } from "./guest-import-wizard";
import { getGuestHouseholds } from "../../lib/guests/fixtures";

// The wizard calls a Server Action, whose module reaches the database. Mocking it
// keeps this test on the wizard's own behaviour and off Prisma's module init.
vi.mock("../../lib/guests/actions", () => ({
  importGuestHouseholdsAction: vi.fn(async (rows: readonly unknown[]) => ({
    kind: "ok",
    createdHouseholds: rows.length,
    createdGuests: rows.length,
  })),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

import { importGuestHouseholdsAction } from "../../lib/guests/actions";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.clearAllMocks();
});

const HEADER =
  "nama_rumah_tangga,nama_tamu,telepon,email,maksimal_pax,akses_acara,tag";

const EVENTS = [
  { id: "akad", title: "Akad Nikah" },
  { id: "resepsi", title: "Resepsi" },
];

/**
 * Uploads CSV content through the real file input.
 *
 * The wizard reads the file with `FileReader` and then waits 220ms before showing
 * the preview. Those are real timers, so the assertions wait for the outcome rather
 * than trying to advance a clock the reader does not consult.
 */
async function uploadCsv(contents: string): Promise<void> {
  const input = screen.getByLabelText("Pilih file CSV") as HTMLInputElement;
  const file = new File([contents], "tamu.csv", { type: "text/csv" });
  fireEvent.change(input, { target: { files: [file] } });
  await waitFor(() => {
    expect(
      screen.queryByRole("button", { name: /Konfirmasi impor/ }),
    ).not.toBeNull();
  });
}

function renderWizard(
  fixture: "normal" | "potential-duplicate" = "normal",
  existingHouseholds: readonly { id: string }[] = [],
) {
  render(
    <GuestImportWizard
      events={EVENTS}
      existingHouseholds={existingHouseholds as never}
      fixture={fixture}
    />,
  );
}

async function confirmImport(): Promise<void> {
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: /Konfirmasi impor/ }));
  });
}

describe("GuestImportWizard", () => {
  it("requires explicit opt-in for a potential duplicate before counting it", () => {
    vi.useFakeTimers();
    // The fixture CSV's household name matches one already on file, which is what
    // makes the wizard ask rather than assume.
    renderWizard("potential-duplicate", getGuestHouseholds());

    fireEvent.click(
      screen.getByRole("button", { name: "Muat fixture pengujian" }),
    );
    act(() => {
      vi.advanceTimersByTime(220);
    });

    expect(screen.getAllByText("Duplikat potensial")).toHaveLength(2);
    expect(
      screen.getByRole("button", { name: "Konfirmasi impor (1)" }),
    ).toHaveProperty("disabled", false);

    fireEvent.click(
      screen.getAllByRole("checkbox", {
        name: "Impor sebagai rumah tangga baru",
      })[0]!,
    );
    expect(
      screen.getByRole("button", { name: "Konfirmasi impor (2)" }),
    ).toHaveProperty("disabled", false);
  });

  it("sends one entry per household and reports what was created", async () => {
    renderWizard();
    await uploadCsv(
      [
        HEADER,
        "Keluarga Budi Santoso,Budi Santoso,,budi@example.id,4,Akad Nikah|Resepsi,Keluarga besar",
      ].join("\n"),
    );
    await confirmImport();

    expect(importGuestHouseholdsAction).toHaveBeenCalledWith([
      {
        householdName: "Keluarga Budi Santoso",
        memberNames: ["Budi Santoso"],
        maximumPax: 4,
      },
    ]);
    expect(screen.getByRole("heading", { name: "Impor selesai" })).toBeTruthy();
  });

  it("groups repeated household names into a single entry", async () => {
    // The same household name across several rows is one household with several
    // members, not several households — otherwise one family is created repeatedly.
    renderWizard();
    await uploadCsv(
      [
        HEADER,
        "Keluarga Rahman,Ahmad Rahman,,ahmad@example.id,4,Resepsi,Keluarga",
        "Keluarga Rahman,Siti Rahman,,siti@example.id,4,Resepsi,Keluarga",
        "Keluarga Rahman,Naya Rahman,,,4,Resepsi,Keluarga",
      ].join("\n"),
    );
    await confirmImport();

    expect(importGuestHouseholdsAction).toHaveBeenCalledWith([
      {
        householdName: "Keluarga Rahman",
        memberNames: ["Ahmad Rahman", "Siti Rahman", "Naya Rahman"],
        maximumPax: 4,
      },
    ]);
  });

  it("raises the allowance to fit the members actually listed", async () => {
    // A row stating one pax for a three-person household would otherwise store an
    // allowance smaller than the guest list, which the form itself rejects.
    renderWizard();
    await uploadCsv(
      [
        HEADER,
        "Keluarga Kecil,Anak Satu,,,1,Resepsi,",
        "Keluarga Kecil,Anak Dua,,,1,Resepsi,",
      ].join("\n"),
    );
    await confirmImport();

    expect(importGuestHouseholdsAction).toHaveBeenCalledWith([
      {
        householdName: "Keluarga Kecil",
        memberNames: ["Anak Satu", "Anak Dua"],
        maximumPax: 2,
      },
    ]);
  });

  it("leaves out rows that failed validation", async () => {
    renderWizard();
    await uploadCsv(
      [
        HEADER,
        "Keluarga Pantas,Maya Pantas,,maya@example.id,2,Resepsi,Teman",
        "Baris Tidak Valid,,,+bukan-email,0,Acara Tidak Ada,",
      ].join("\n"),
    );
    await confirmImport();

    expect(importGuestHouseholdsAction).toHaveBeenCalledWith([
      {
        householdName: "Keluarga Pantas",
        memberNames: ["Maya Pantas"],
        maximumPax: 2,
      },
    ]);
  });

  it("reports a failed import instead of claiming success", async () => {
    vi.mocked(importGuestHouseholdsAction).mockResolvedValueOnce({
      kind: "unavailable",
    });
    renderWizard();
    await uploadCsv(
      [HEADER, "Keluarga Budi Santoso,Budi Santoso,,,2,Resepsi,"].join("\n"),
    );
    await confirmImport();

    expect(
      screen.getByRole("heading", { name: "Impor belum berhasil" }),
    ).toBeTruthy();
  });
});
