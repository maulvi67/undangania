import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

/**
 * The landing reveals sections on scroll, and the FAQ answer animates open. Both
 * effects begin *after* this helper is called — the reveal is triggered by an
 * `IntersectionObserver` callback, which can fire once a click has already
 * scrolled the section into view. axe measures the *effective* colour of a
 * partially transparent element, so sampling mid-flight reports a contrast
 * failure that no settled reader ever sees.
 *
 * So this waits in two steps: every section inside the viewport must have been
 * revealed, then the finite animations must drain. The ambient layers — the
 * marquee, the floating card, the drifting bokeh — loop forever, so their
 * `finished` promise never settles; only finite animations are awaited.
 */
async function settleAnimations(page: import("@playwright/test").Page) {
  await page.waitForFunction(
    () => {
      const sections = document.querySelectorAll(
        '.lnd-section[data-reveal="pending"], .lnd-final[data-reveal="pending"]',
      );
      for (const element of sections) {
        const rect = element.getBoundingClientRect();
        // A section still waiting to be revealed while it is on screen means
        // the observer has not run yet.
        if (rect.top < window.innerHeight && rect.bottom > 0) return false;
      }
      return true;
    },
    undefined,
    { timeout: 15_000 },
  );

  await page.waitForFunction(
    () =>
      document
        .getAnimations()
        .filter(
          (animation) => animation.effect?.getTiming().iterations !== Infinity,
        )
        .every((animation) =>
          ["finished", "idle"].includes(animation.playState),
        ),
    undefined,
    { timeout: 15_000 },
  );
}

test.describe("landing page", () => {
  test("exposes value proposition and primary CTA above the fold", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toContainText(
      "Hari bahagia Anda, dirangkai dalam undangan digital yang personal",
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
      const failure = request.failure()?.errorText ?? "";
      // Next.js prefetches links on hover and in the viewport, and the browser
      // cancels any prefetch still in flight when the page navigates away or the
      // test closes its context. An aborted `_rsc` prefetch is a normal
      // cancellation, not a broken resource, so only genuine transport and
      // server failures count here.
      const isAbortedPrefetch =
        failure === "net::ERR_ABORTED" && request.url().includes("_rsc=");
      if (isAbortedPrefetch) return;
      failedRequests.push(`${request.method()} ${request.url()} ${failure}`);
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
    await settleAnimations(page);
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
    await settleAnimations(page);
    await page.locator("details").first().locator("summary").click();
    // The answer fades in over 340ms; audit it once it has arrived.
    await settleAnimations(page);
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
