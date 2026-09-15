// @vitest-environment jsdom
import { afterEach, beforeAll, expect, test } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { Dialog, Drawer } from "./overlays";

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

function getDialog(container: HTMLElement) {
  const dialog = container.querySelector("dialog");
  if (!dialog) throw new Error("dialog tidak dirender");
  return dialog;
}

test("Drawer menandai pemicu sebagai disclosure yang tertutup", () => {
  const { container } = render(
    <Drawer triggerLabel="Menu" title="Navigasi">
      <a href="/templates">Template</a>
    </Drawer>,
  );

  const trigger = screen.getByRole("button", { name: "Menu" });
  const dialog = getDialog(container);

  expect(trigger.getAttribute("aria-expanded")).toBe("false");
  expect(trigger.getAttribute("aria-haspopup")).toBe("dialog");
  expect(trigger.getAttribute("aria-controls")).toBe(dialog.id);
  expect(dialog.id).not.toBe("");
});

test("Drawer memperbarui aria-expanded saat dibuka dan ditutup", () => {
  render(
    <Drawer triggerLabel="Menu" title="Navigasi">
      <a href="/templates">Template</a>
    </Drawer>,
  );

  const trigger = screen.getByRole("button", { name: "Menu" });
  expect(trigger.getAttribute("aria-expanded")).toBe("false");

  fireEvent.click(trigger);
  expect(trigger.getAttribute("aria-expanded")).toBe("true");

  fireEvent.click(screen.getByRole("button", { name: "Tutup" }));
  expect(trigger.getAttribute("aria-expanded")).toBe("false");
  expect(document.activeElement).toBe(trigger);
});

test("Dialog menandai pemicu dengan keadaan terbuka yang sama", () => {
  const { container } = render(
    <Dialog triggerLabel="Buka syarat" title="Syarat dan ketentuan">
      <p>Isi syarat.</p>
    </Dialog>,
  );

  const trigger = screen.getByRole("button", { name: "Buka syarat" });
  const dialog = getDialog(container);

  expect(trigger.getAttribute("aria-expanded")).toBe("false");
  expect(trigger.getAttribute("aria-haspopup")).toBe("dialog");
  expect(trigger.getAttribute("aria-controls")).toBe(dialog.id);

  fireEvent.click(trigger);
  expect(trigger.getAttribute("aria-expanded")).toBe("true");
  expect(dialog.open).toBe(true);

  fireEvent.click(screen.getByRole("button", { name: "Tutup" }));
  expect(trigger.getAttribute("aria-expanded")).toBe("false");
  expect(dialog.open).toBe(false);
});
