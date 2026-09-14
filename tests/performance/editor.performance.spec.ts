import { test, expect, type Page, type TestInfo } from "@playwright/test";

const VIEWPORTS = [
  { width: 375, height: 812 },
  { width: 390, height: 844 },
  { width: 768, height: 1024 },
  { width: 1440, height: 900 },
] as const;

type RuntimeEvidence = {
  consoleErrors: string[];
  pageErrors: string[];
  requestFailures: string[];
  httpErrors: string[];
};

async function installObservers(page: Page) {
  await page.addInitScript(() => {
    const target = window as unknown as {
      __editorPerformance?: {
        cls: number;
        layoutShifts: number;
        longTasks: number;
        lcp: number | null;
      };
    };
    target.__editorPerformance = {
      cls: 0,
      layoutShifts: 0,
      longTasks: 0,
      lcp: null,
    };
    if (!("PerformanceObserver" in window)) return;
    if (PerformanceObserver.supportedEntryTypes.includes("layout-shift")) {
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          const shift = entry as PerformanceEntry & {
            hadRecentInput?: boolean;
            value?: number;
          };
          if (!shift.hadRecentInput) {
            target.__editorPerformance!.cls += shift.value ?? 0;
            target.__editorPerformance!.layoutShifts += 1;
          }
        }
      }).observe({ type: "layout-shift", buffered: true });
    }
    if (PerformanceObserver.supportedEntryTypes.includes("longtask")) {
      new PerformanceObserver((list) => {
        target.__editorPerformance!.longTasks += list.getEntries().length;
      }).observe({ type: "longtask", buffered: true });
    }
    if (
      PerformanceObserver.supportedEntryTypes.includes(
        "largest-contentful-paint",
      )
    ) {
      new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const last = entries[entries.length - 1];
        if (last) target.__editorPerformance!.lcp = last.startTime;
      }).observe({ type: "largest-contentful-paint", buffered: true });
    }
  });
}

async function collectMetrics(page: Page) {
  return page.evaluate(() => {
    const target = window as unknown as {
      __editorPerformance?: {
        cls: number;
        layoutShifts: number;
        longTasks: number;
        lcp: number | null;
      };
    };
    const navigation = performance.getEntriesByType("navigation")[0] as
      PerformanceNavigationTiming | undefined;
    const resources = performance.getEntriesByType(
      "resource",
    ) as PerformanceResourceTiming[];
    return {
      viewport: { width: window.innerWidth, height: window.innerHeight },
      navigation: {
        domContentLoaded: navigation?.domContentLoadedEventEnd ?? null,
        load: navigation?.loadEventEnd ?? null,
        transferSize: navigation?.transferSize ?? null,
        encodedBodySize: navigation?.encodedBodySize ?? null,
      },
      resources: {
        count: resources.length,
        transferSize: resources.reduce(
          (total, resource) => total + resource.transferSize,
          0,
        ),
        scripts: resources.filter((resource) => resource.name.includes(".js"))
          .length,
        styles: resources.filter((resource) => resource.name.includes(".css"))
          .length,
        images: resources.filter((resource) => resource.initiatorType === "img")
          .length,
      },
      performance: target.__editorPerformance ?? null,
    };
  });
}

async function capture(page: Page, testInfo: TestInfo, name: string) {
  const path = testInfo.outputPath(`${name}.png`);
  await page.screenshot({ path, fullPage: true });
  await testInfo.attach(name, { path, contentType: "image/png" });
}

for (const viewport of VIEWPORTS) {
  test(`editor performance evidence at ${viewport.width}px`, async ({
    page,
  }, testInfo) => {
    const evidence: RuntimeEvidence = {
      consoleErrors: [],
      pageErrors: [],
      requestFailures: [],
      httpErrors: [],
    };
    page.on("console", (message) => {
      if (message.type() === "error")
        evidence.consoleErrors.push(message.text());
    });
    page.on("pageerror", (error) => evidence.pageErrors.push(error.message));
    page.on("requestfailed", (request) => {
      evidence.requestFailures.push(
        `${request.method()} ${request.url()} — ${request.failure()?.errorText ?? "unknown"}`,
      );
    });
    page.on("response", (response) => {
      if (
        response.status() >= 400 &&
        !response.url().includes("/_next/webpack-hmr")
      ) {
        evidence.httpErrors.push(`${response.status()} ${response.url()}`);
      }
    });
    await installObservers(page);
    await page.setViewportSize(viewport);
    await page.goto(
      `/editor?fixture=normal&invitation=performance-${viewport.width}&section=couple`,
      { waitUntil: "networkidle" },
    );
    await expect(page.locator("h1").first()).toBeVisible();
    await page.waitForTimeout(500);
    const metrics = await collectMetrics(page);
    await testInfo.attach("editor-performance.json", {
      body: Buffer.from(JSON.stringify({ evidence, metrics }, null, 2)),
      contentType: "application/json",
    });
    expect(evidence.consoleErrors).toEqual([]);
    expect(evidence.pageErrors).toEqual([]);
    expect(evidence.requestFailures).toEqual([]);
    expect(evidence.httpErrors).toEqual([]);
    expect(metrics.performance?.cls ?? 0).toBeLessThan(0.1);
    await capture(page, testInfo, `editor-performance-${viewport.width}`);
  });
}
