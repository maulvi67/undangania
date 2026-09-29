import { expect, test } from "@playwright/test";

const VIEWPORTS = [
  { width: 320, height: 568 },
  { width: 360, height: 800 },
  { width: 375, height: 812 },
  { width: 390, height: 844 },
  { width: 412, height: 915 },
  { width: 768, height: 1024 },
  { width: 1024, height: 768 },
  { width: 1280, height: 800 },
  { width: 1440, height: 900 },
] as const;

for (const viewport of VIEWPORTS) {
  test(`customer dashboard fits ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto("/dashboard", { waitUntil: "networkidle" });
    await expect(
      page.getByRole("heading", { name: "Anda belum masuk" }),
    ).toBeVisible();
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            document.documentElement.scrollWidth <=
            document.documentElement.clientWidth,
        ),
      )
      .toBe(true);

    if (viewport.width < 1024) {
      await expect(page.getByRole("button", { name: "Menu" })).toBeVisible();
    } else {
      await expect(page.locator(".dsh-sidebar")).toBeVisible();
    }
  });
}
