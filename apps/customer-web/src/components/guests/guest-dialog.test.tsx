// @vitest-environment jsdom

import * as React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { GuestBulkActions } from "./guest-bulk-actions";
import { GuestLinkPanel } from "./guest-link-panel";
import {
  getGuestHouseholdDetail,
  getGuestManagementData,
} from "../../lib/guests/fixtures";

// jsdom belum mengimplementasikan showModal/close pada <dialog>.
beforeAll(() => {
  const proto = window.HTMLDialogElement.prototype;
  proto.showModal = function showModal(this: HTMLDialogElement) {
    this.open = true;
  };
  proto.close = function close(this: HTMLDialogElement) {
    this.open = false;
    this.dispatchEvent(new Event("close"));
  };
});

afterEach(cleanup);

function dialogFor(trigger: HTMLElement): HTMLDialogElement {
  const id = trigger.getAttribute("aria-controls") ?? "";
  const dialog = document.getElementById(id);
  if (!dialog) throw new Error(`dialog dengan id "${id}" tidak ditemukan`);
  return dialog as HTMLDialogElement;
}

function expectDisclosureWiring(trigger: HTMLElement) {
  expect(trigger.getAttribute("aria-haspopup")).toBe("dialog");
  expect(trigger.getAttribute("aria-expanded")).toBe("false");
  const dialog = dialogFor(trigger);
  expect(trigger.getAttribute("aria-controls")).toBe(dialog.id);
  return dialog;
}

describe("GuestLinkPanel disclosure", () => {
  function renderPanel() {
    const household = getGuestHouseholdDetail("household-budi");
    if (!household) throw new Error("fixture rumah tangga tidak ditemukan");
    return render(
      <GuestLinkPanel
        household={household}
        management={getGuestManagementData("normal")}
      />,
    );
  }

  it("mengaitkan pemicu ganti tautan dengan dialognya", () => {
    renderPanel();
    const trigger = screen.getByRole("button", { name: "Ganti tautan" });
    const dialog = expectDisclosureWiring(trigger);

    fireEvent.click(trigger);
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    expect(dialog.open).toBe(true);

    fireEvent.click(screen.getByRole("button", { name: "Batalkan" }));
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    expect(dialog.open).toBe(false);
  });

  it("mengaitkan pemicu nonaktifkan tautan dengan dialognya", () => {
    renderPanel();
    const trigger = screen.getByRole("button", { name: "Nonaktifkan tautan" });
    const dialog = expectDisclosureWiring(trigger);

    fireEvent.click(trigger);
    expect(trigger.getAttribute("aria-expanded")).toBe("true");

    fireEvent.click(screen.getByRole("button", { name: "Batalkan" }));
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    expect(dialog.open).toBe(false);
  });

  it("memberi setiap dialog identitas yang berbeda", () => {
    renderPanel();
    const rotate = screen.getByRole("button", { name: "Ganti tautan" });
    const disable = screen.getByRole("button", { name: "Nonaktifkan tautan" });
    expect(rotate.getAttribute("aria-controls")).not.toBe(
      disable.getAttribute("aria-controls"),
    );
  });

  it("tidak menandai dialog sebagai terbuka saat halaman dimuat", () => {
    renderPanel();
    const dialogs = document.querySelectorAll("dialog.gst-dialog");
    expect(dialogs.length).toBe(2);
    for (const dialog of dialogs) {
      expect((dialog as HTMLDialogElement).open).toBe(false);
    }
  });
});

describe("GuestBulkActions disclosure", () => {
  it("mengaitkan tombol tindakan dengan dialognya", () => {
    render(<GuestBulkActions selectedCount={2} />);
    const trigger = screen.getByRole("button", { name: "Tindakan" });
    const dialog = expectDisclosureWiring(trigger);

    fireEvent.click(trigger);
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    expect(dialog.open).toBe(true);

    fireEvent.click(screen.getByRole("button", { name: "Ekspor pilihan" }));
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    expect(dialog.open).toBe(false);
  });

  it("tidak merender apa pun saat tidak ada rumah tangga terpilih", () => {
    const { container } = render(<GuestBulkActions selectedCount={0} />);
    expect(container.querySelector("dialog")).toBeNull();
    expect(screen.queryByRole("button", { name: "Tindakan" })).toBeNull();
  });
});
