// @vitest-environment jsdom
import { afterEach, expect, test } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { Input, Select, Textarea } from "./field";

afterEach(cleanup);

test("Input mengaitkan label, petunjuk, dan galat", () => {
  render(
    <Input
      id="nama"
      label="Nama panggilan"
      required
      hint="Nama ini muncul di undangan."
      error="Nama panggilan wajib diisi."
    />,
  );
  const input = screen.getByLabelText("Nama panggilan (wajib)");
  expect(input.getAttribute("aria-invalid")).toBe("true");
  const describedBy = input.getAttribute("aria-describedby") ?? "";
  expect(describedBy).toContain("nama-hint");
  expect(describedBy).toContain("nama-error");
  expect(screen.getByText("Nama panggilan wajib diisi.")).toBeTruthy();
  expect(screen.getByText("Nama ini muncul di undangan.")).toBeTruthy();
});

test("Input tanpa galat tidak menandai aria-invalid", () => {
  render(<Input id="kota" label="Kota" />);
  const input = screen.getByLabelText("Kota");
  expect(input.getAttribute("aria-invalid")).toBeNull();
});

test("Textarea mengaitkan label dan baris petunjuk", () => {
  render(
    <Textarea
      id="ucapan"
      label="Ucapan pembuka"
      hint="Tulis ucapan singkat untuk tamu Anda."
      rows={4}
    />,
  );
  const textarea = screen.getByLabelText("Ucapan pembuka");
  expect(textarea.getAttribute("aria-describedby")).toContain("ucapan-hint");
});

test("Select merender opsi dan placeholder", () => {
  render(
    <Select
      id="acara"
      label="Jumlah acara"
      placeholder="Pilih jumlah acara"
      options={[
        { value: "satu", label: "Satu acara (Akad)" },
        { value: "dua", label: "Dua acara (Akad & Resepsi)" },
      ]}
    />,
  );
  const select = screen.getByLabelText("Jumlah acara");
  expect(
    screen.getByRole("option", { name: "Dua acara (Akad & Resepsi)" }),
  ).toBeTruthy();
  expect((select as HTMLSelectElement).options.length).toBe(3);
});
