import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const DETAIL_URL = "/templates/seruni-klasik";

test.describe("template detail accessibility", () => {
  for (const state of ["default", "desktop-preview", "demo", "rsvp-error"] as const) {
    test(`@a11y no critical or serious violations (${state})`, async ({ page }) => {
      if (state === "demo") {
        await page.goto(`${DETAIL_URL}/demo`);
      } else {
        await page.goto(DETAIL_URL);
        if (state === "desktop-preview") {
          await page.locator("label[for='tpl-device-desktop']").click();
        }
      }
      if (state === "rsvp-error") {
        await page.goto(`${DETAIL_URL}/demo`);
        await page.getByRole("button", { name: "Kirim konfirmasi" }).click();
        await expect(page.getByText("Mohon isi nama Anda.")).toBeVisible();
      }
      const result = await new AxeBuilder({ page }).analyze();
      expect(
        result.violations.filter((v) => ["critical", "serious"].includes(v.impact ?? "")),
      ).toEqual([]);
    });
  }
});
