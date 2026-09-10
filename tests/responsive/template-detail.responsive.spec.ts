import { test, expect } from "@playwright/test";

const ROUTES = ["/templates/seruni-klasik", "/templates/seruni-klasik/demo"];

for (const route of ROUTES) {
  for (const viewport of [
    { width: 320, height: 568 },
    { width: 375, height: 812 },
    { width: 390, height: 844 },
    { width: 768, height: 1024 },
    { width: 1024, height: 768 },
    { width: 1440, height: 900 },
  ]) {
    test(`${route} fits ${viewport.width}x${viewport.height}`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await page.goto(route);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
      );
      expect(overflow).toBe(false);
    });
  }
}

test("200% zoom equivalent (320px content in 640px viewport) has no overflow", async ({ page }) => {
  await page.setViewportSize({ width: 640, height: 360 });
  await page.goto("/templates/seruni-klasik");
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBe(0);
});
