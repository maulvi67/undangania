import { test, expect } from "@playwright/test";

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

const LONG_TEXT =
  "Gedung Nusantara — Ballroom Utama dengan akses ramah keluarga, ruang tunggu, area parkir, petunjuk masuk, dan alamat panjang di Kota Bandung. ".repeat(
    5,
  );

for (const viewport of VIEWPORTS) {
  test(`editor fits ${viewport.width}x${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto(
      `/editor?fixture=normal&invitation=responsive-${viewport.width}&section=couple`,
      { waitUntil: "networkidle" },
    );
    await expect(page.locator("h1").first()).toBeVisible();
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            document.documentElement.scrollWidth <=
            document.documentElement.clientWidth,
        ),
      )
      .toBe(true);
    await expect(page.getByLabel("Nama mempelai pertama")).toBeVisible();
  });
}

test("long venue content does not create horizontal overflow", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto(
    "/editor?fixture=normal&invitation=responsive-long-content&section=venue",
    { waitUntil: "networkidle" },
  );
  const venue = page.locator('input[id^="editor-venue-name-"]').first();
  const address = page.locator('textarea[id^="editor-venue-address-"]').first();
  await venue.fill(LONG_TEXT);
  await address.fill(LONG_TEXT);
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          document.documentElement.scrollWidth <=
          document.documentElement.clientWidth,
      ),
    )
    .toBe(true);
  await expect(venue).toHaveValue(LONG_TEXT.slice(0, 250));
  await expect(address).toHaveValue(LONG_TEXT.slice(0, 1000));
});

test("editor remains usable in landscape", async ({ page }) => {
  await page.setViewportSize({ width: 812, height: 375 });
  await page.goto(
    "/editor?fixture=normal&invitation=responsive-landscape&section=couple",
    { waitUntil: "networkidle" },
  );
  await expect(page.getByLabel("Nama mempelai pertama")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Lihat pratinjau" }),
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
});
