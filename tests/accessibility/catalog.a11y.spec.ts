import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

async function expectNoCriticalViolations(page: Page) {
  const result = await new AxeBuilder({ page }).analyze();
  expect(result.violations.filter((v) => ["critical", "serious"].includes(v.impact ?? ""))).toEqual(
    [],
  );
}

test("template catalog has no automatically detectable critical accessibility violations", async ({
  page,
}) => {
  await page.goto("/templates");
  await expectNoCriticalViolations(page);
});

test("filtered catalog state has no critical accessibility violations", async ({ page }) => {
  await page.goto("/templates?q=nara&kategori=Modern&urutkan=harga-terendah");
  await expectNoCriticalViolations(page);
});

test("collapsed filter panel has no critical accessibility violations", async ({ page }) => {
  await page.goto("/templates");
  await page
    .locator("details.ctlg-filters")
    .evaluate((element) => (element as HTMLDetailsElement).removeAttribute("open"));
  await expectNoCriticalViolations(page);
});
