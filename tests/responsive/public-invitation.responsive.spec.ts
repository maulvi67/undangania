import { expect, test } from "@playwright/test";

const viewports = [
  { width: 320, height: 568 },
  { width: 360, height: 800 },
  { width: 375, height: 812 },
  { width: 390, height: 844 },
  { width: 412, height: 915 },
  { width: 768, height: 1024 },
  { width: 1024, height: 768 },
  { width: 1280, height: 800 },
  { width: 1440, height: 900 },
];

for (const viewport of viewports) {
  test(`@responsive invitation has no overflow at ${viewport.width}x${viewport.height}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await page.goto("/invite/rani-bima");
    await page.getByText("Buka undangan").click();
    const metrics = await page.evaluate(() => ({
      overflow:
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth,
      bodyOverflow: document.body.scrollWidth - document.body.clientWidth,
      invitationWidth:
        document.querySelector(".gld-invitation")?.getBoundingClientRect()
          .width ?? 0,
      viewportWidth: document.documentElement.clientWidth,
    }));
    expect(metrics.overflow).toBe(0);
    expect(metrics.bodyOverflow).toBe(0);
    expect(metrics.invitationWidth).toBeLessThanOrEqual(metrics.viewportWidth);
  });
}

test("Nara stays within narrow and wide viewports", async ({ page }) => {
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto("/invite/rani-bima-nara");
    await page.getByText("Buka undangan").click();
    const metrics = await page.evaluate(() => ({
      documentWidth: document.documentElement.scrollWidth,
      viewportWidth: document.documentElement.clientWidth,
      invitationWidth:
        document.querySelector(".gld-invitation")?.getBoundingClientRect()
          .width ?? 0,
    }));
    expect(metrics.documentWidth).toBe(metrics.viewportWidth);
    expect(metrics.invitationWidth).toBeLessThanOrEqual(metrics.viewportWidth);
  }
});

test("long Indonesian content remains reachable on a narrow viewport", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto("/invite/rani-bima-long-content");
  await page.getByText("Buka undangan").click();
  const overflow = await page.evaluate(
    () =>
      document.documentElement.scrollWidth >
      document.documentElement.clientWidth,
  );
  expect(overflow).toBe(false);
  await expect(
    page.getByRole("heading", { name: /Raden Mas Aditya/ }).first(),
  ).toBeVisible();
});

test("large gallery reserves bounded tiles without layout overflow", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/invite/rani-bima-large-gallery");
  await page.getByText("Buka undangan").click();
  await expect(page.locator(".gld-gallery__tile")).toHaveCount(30);
  const widths = await page
    .locator(".gld-gallery__tile")
    .evaluateAll((tiles) =>
      tiles.map((tile) => (tile as HTMLElement).getBoundingClientRect().width),
    );
  expect(widths.every((width) => width > 0 && width < 200)).toBe(true);
});
