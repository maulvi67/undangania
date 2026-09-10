import { test, expect } from "@playwright/test";

const VIEWPORTS = [
  { width: 320, height: 568 },
  { width: 375, height: 812 },
  { width: 390, height: 844 },
  { width: 768, height: 1024 },
  { width: 1024, height: 768 },
  { width: 1440, height: 900 },
];

for (const viewport of VIEWPORTS) {
  test(`catalog fits ${viewport.width}x${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto("/templates");
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(overflow).toBe(false);
  });

  test(`filtered catalog fits ${viewport.width}x${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto("/templates?q=klasik&harga=eksklusif&urutkan=harga-terendah");
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(overflow).toBe(false);
  });
}

test("collapsed filter panel does not cause horizontal overflow", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto("/templates");
  await page
    .locator("details.ctlg-filters")
    .evaluate((element) => (element as HTMLDetailsElement).removeAttribute("open"));
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  expect(overflow).toBe(false);
});
