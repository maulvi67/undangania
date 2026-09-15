// @vitest-environment jsdom

import * as React from "react";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GuestImportWizard } from "./guest-import-wizard";
import { getGuestManagementData } from "../../lib/guests/fixtures";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("GuestImportWizard", () => {
  it("requires explicit opt-in for a potential duplicate before counting it", () => {
    vi.useFakeTimers();
    render(
      <GuestImportWizard
        management={getGuestManagementData("potential-duplicate")}
        fixture="potential-duplicate"
      />,
    );

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

    fireEvent.click(
      screen.getByRole("button", { name: "Konfirmasi impor (2)" }),
    );
    expect(
      screen.getByRole("heading", { name: "Impor siap diproses" }),
    ).toBeTruthy();
  });
});
