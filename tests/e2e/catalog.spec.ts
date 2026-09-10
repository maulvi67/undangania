import { test, expect } from "@playwright/test";

test.describe("template catalog", () => {
  test("has clear Indonesian heading", async ({ page }) => {
    await page.goto("/templates");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Pilih desain");
  });

  test("search is reflected in the URL and narrows results", async ({ page }) => {
    await page.goto("/templates");
    await page.fill("#ctlg-q", "nara");
    await page.getByRole("button", { name: "Cari" }).click();
    await expect(page).toHaveURL(/q=nara/);
    await expect(page.getByRole("status")).toContainText("Menampilkan 1 desain");
    await expect(page.getByRole("heading", { level: 3, name: "Nara" })).toBeVisible();
  });

  test("category filter submits via one GET and can be cleared", async ({ page }) => {
    await page.goto("/templates");
    await page.getByLabel("Klasik", { exact: true }).check();
    await page.getByRole("button", { name: "Terapkan filter" }).click();
    await expect(page).toHaveURL(/kategori=Klasik/);
    await expect(page.getByRole("status")).toContainText("Menampilkan 1 desain");
    await page.locator(".ctlg-tokens").getByRole("link", { name: "Hapus semua" }).click();
    await expect(page).toHaveURL(/\/templates$/);
    await expect(page.getByRole("status")).toContainText("Menampilkan 3 desain");
  });

  test("price sort defaults to Terbaru and reorders cards when changed", async ({ page }) => {
    await page.goto("/templates");
    const sort = page.locator("#ctlg-urutkan");
    await expect(sort).toHaveValue("terbaru");
    await sort.selectOption("harga-terendah");
    await page.getByRole("button", { name: "Terapkan filter" }).click();
    await expect(page).toHaveURL(/urutkan=harga-terendah/);
    await expect(sort).toHaveValue("harga-terendah");
    await expect(page.locator(".ctlg-card__amount").first()).toContainText("149");
  });

  test("tier filter chip explains core-feature parity", async ({ page }) => {
    await page.goto("/templates?harga=sederhana");
    await expect(page.locator(".ctlg-filters__hint, .ui-field__hint").first()).toContainText(
      "fitur inti yang sama",
    );
    await expect(page.getByRole("status")).toContainText("Menampilkan 1 desain");
  });

  test("empty search state explains recovery and resets", async ({ page }) => {
    await page.goto("/templates?q=tidakada");
    await expect(
      page.getByRole("heading", { name: "Tidak ada desain yang cocok" }),
    ).toBeVisible();
    await page.getByRole("link", { name: "Hapus semua filter" }).click();
    await expect(page).toHaveURL(/\/templates$/);
    await expect(page.getByRole("status")).toContainText("Menampilkan 3 desain");
  });

  test("card CTAs link to demo and detail routes", async ({ page }) => {
    await page.goto("/templates?q=seruni");
    await expect(page.getByRole("link", { name: "Lihat demo" })).toHaveAttribute(
      "href",
      "/templates/seruni-klasik/demo",
    );
    await expect(page.getByRole("link", { name: "Pilih desain" })).toHaveAttribute(
      "href",
      "/templates/seruni-klasik",
    );
  });

  test("explains core-feature parity and shows no ratings or scarcity", async ({ page }) => {
    await page.goto("/templates");
    const body = page.locator("body");
    await expect(body).toContainText("fitur inti");
    await expect(body).not.toContainText(/bintang|rating|ulasan|terjual|sisa \d|hanya tinggal/i);
  });
});
