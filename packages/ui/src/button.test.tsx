// @vitest-environment jsdom
import { afterEach, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { Button } from "./button";

afterEach(cleanup);

test("merender varian utama dengan nama yang dapat diakses", () => {
  render(<Button variant="primary">Simpan Perubahan</Button>);
  const button = screen.getByRole("button", { name: "Simpan Perubahan" });
  expect(button.className).toContain("ui-button--primary");
  expect(button.className).toContain("ui-button--md");
});

test("tombol nonaktif tidak memicu klik", () => {
  const onClick = vi.fn();
  render(
    <Button disabled onClick={onClick}>
      Kirim Undangan
    </Button>
  );
  const button = screen.getByRole("button", { name: "Kirim Undangan" }) as HTMLButtonElement;
  expect(button.disabled).toBe(true);
  fireEvent.click(button);
  expect(onClick).not.toHaveBeenCalled();
});

test("keadaan memuat menandai aria-busy dan menonaktifkan tombol", () => {
  render(<Button loading>Simpan Perubahan</Button>);
  const button = screen.getByRole("button", { name: "Simpan Perubahan" }) as HTMLButtonElement;
  expect(button.getAttribute("aria-busy")).toBe("true");
  expect(button.disabled).toBe(true);
});

test("ukuran sm menerapkan kelas ukuran", () => {
  render(
    <Button size="sm" variant="secondary">
      Pratinjau
    </Button>
  );
  expect(screen.getByRole("button").className).toContain("ui-button--sm");
});
