import { expect, test } from "@playwright/test";

const URL = "/invite/rani-bima";

test.describe("golden public invitation performance", () => {
  test("loads without runtime failures or unbounded asset requests", async ({ page }) => {
    const failures: string[] = [];
    page.on("requestfailed", (request) => failures.push(request.url()));
    page.on("response", (response) => {
      if (response.status() >= 400) failures.push(`${response.status()} ${response.url()}`);
    });
    await page.goto(URL, { waitUntil: "networkidle" });
    await page.getByText("Buka undangan").click();
    await expect(page.locator(".gld-invitation")).toBeVisible();
    expect(failures).toEqual([]);

    const metrics = await page.evaluate(() => ({
      imageRequests: performance.getEntriesByType("resource").filter((entry) => /\.(png|jpe?g|webp|avif|gif)(\?|$)/i.test(entry.name)).length,
      audioRequests: performance.getEntriesByType("resource").filter((entry) => /\.(mp3|wav|ogg|m4a)(\?|$)/i.test(entry.name)).length,
      scriptCount: document.scripts.length,
      layoutWidth: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    }));
    expect(metrics.imageRequests).toBe(0);
    expect(metrics.audioRequests).toBe(0);
    expect(metrics.layoutWidth).toBe(0);
    expect(metrics.scriptCount).toBeLessThanOrEqual(12);
  });

  test("honors reduced motion styles", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(URL);
    const style = await page.locator(".gld-invitation").evaluate((element) => {
      const computed = getComputedStyle(element);
      return {
        transitionSeconds: Number.parseFloat(computed.transitionDuration),
        animationSeconds: Number.parseFloat(computed.animationDuration),
      };
    });
    expect(style.transitionSeconds).toBeLessThanOrEqual(0.001);
    expect(style.animationSeconds).toBeLessThanOrEqual(0.001);
  });
});
