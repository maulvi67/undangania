import { expect, test } from "@playwright/test";

test.describe("customer dashboard shell", () => {
  test("shows the sign-in state and workspace navigation", async ({ page }) => {
    await page.goto("/dashboard", { waitUntil: "networkidle" });

    await expect(
      page.getByRole("heading", { name: "Anda belum masuk" }),
    ).toBeVisible();
    await expect(
      page.getByRole("navigation", { name: "Menu workspace" }).first(),
    ).toBeAttached();
    await expect(
      page.getByRole("link", { name: "Beranda" }).first(),
    ).toHaveAttribute("aria-current", "page");
    await expect(
      page
        .locator(".dsh-nav__link--unavailable")
        .filter({ hasText: "Anggaran" })
        .first(),
    ).toContainText("Segera hadir");
    await expect(page.getByRole("link", { name: "Masuk" })).toBeVisible();
  });

  test("opens mobile navigation and returns focus after Escape", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/dashboard", { waitUntil: "networkidle" });

    const trigger = page.getByRole("button", { name: "Menu" });
    await trigger.click();
    const dialog = page.getByRole("dialog", { name: "Menu workspace" });
    await expect(dialog).toBeVisible();
    await expect(
      dialog.getByRole("link", { name: "Daftar tamu" }),
    ).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(trigger).toBeFocused();
  });
});
