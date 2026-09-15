import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test.describe("landing page", () => {
  test("exposes value proposition and primary CTA above the fold", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toContainText(
      "Undangan pernikahan digital yang elegan",
    );
    await expect(
      page.getByRole("link", { name: "Lihat koleksi desain" }).first(),
    ).toBeVisible();
  });

  test("primary CTA targets the template catalog", async ({ page }) => {
    await page.goto("/");
    const cta = page
      .getByRole("link", { name: "Lihat koleksi desain" })
      .first();
    await expect(cta).toHaveAttribute("href", "/templates");
  });

  test("secondary CTA targets the complete demo", async ({ page }) => {
    await page.goto("/");
    const demo = page
      .getByRole("link", { name: "Lihat demo undangan lengkap" })
      .first();
    await expect(demo).toHaveAttribute("href", "/demo");
  });

  test("FAQ answers expand and collapse", async ({ page }) => {
    await page.goto("/");
    const first = page.locator("details").first();
    await expect(first).not.toHaveAttribute("open");
    await first.locator("summary").click();
    await expect(first).toHaveAttribute("open");
    // <details> itself carries the implicit `group` role, so query the answer content.
    await expect(first.locator(".lnd-faq__answer")).toBeVisible();
    await first.locator("summary").click();
    await expect(first).not.toHaveAttribute("open");
  });

  test("skip link is the first keyboard stop and reaches main content", async ({
    page,
  }) => {
    await page.goto("/");
    // WebKit (Safari semantics) excludes plain links from the default Tab order,
    // so the skip link is focused directly there; other engines Tab to it first.
    if (test.info().project.name !== "webkit") {
      await page.keyboard.press("Tab");
      const firstStop = await page.evaluate(
        () => document.activeElement?.className ?? "",
      );
      expect(firstStop).toContain("ui-skip-link");
    } else {
      await page.locator(".ui-skip-link").focus();
    }
    await page.keyboard.press("Enter");
    const focusInMain = await page.evaluate(() =>
      Boolean(document.activeElement && document.activeElement.closest("main")),
    );
    expect(focusInMain).toBe(true);
  });

  test("no console or network failures while loading", async ({ page }) => {
    const consoleErrors: string[] = [];
    const failedRequests: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") consoleErrors.push(message.text());
    });
    page.on("requestfailed", (request) => {
      failedRequests.push(
        `${request.method()} ${request.url()} ${request.failure()?.errorText ?? ""}`,
      );
    });
    page.on("response", (response) => {
      if (response.status() >= 400)
        failedRequests.push(`${response.status()} ${response.url()}`);
    });
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    expect(consoleErrors).toEqual([]);
    expect(failedRequests).toEqual([]);
  });
});

test.describe("landing page accessibility", () => {
  test("@a11y no critical or serious axe violations (default state)", async ({
    page,
  }) => {
    await page.goto("/");
    const result = await new AxeBuilder({ page }).analyze();
    expect(
      result.violations.filter((v) =>
        ["critical", "serious"].includes(v.impact ?? ""),
      ),
    ).toEqual([]);
  });

  test("@a11y no critical or serious axe violations (FAQ open state)", async ({
    page,
  }) => {
    await page.goto("/");
    await page.locator("details").first().locator("summary").click();
    const result = await new AxeBuilder({ page }).analyze();
    expect(
      result.violations.filter((v) =>
        ["critical", "serious"].includes(v.impact ?? ""),
      ),
    ).toEqual([]);
  });
});

test.describe("landing page without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("renders content, CTAs, and FAQ without JavaScript", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Lihat koleksi desain" }).first(),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Lihat demo undangan lengkap" }).first(),
    ).toBeVisible();
    const first = page.locator("details").first();
    await first.locator("summary").click();
    await expect(first).toHaveAttribute("open");
  });
});
