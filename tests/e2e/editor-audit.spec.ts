import { test, expect, type Page, type TestInfo } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const VIEWPORTS = [
  { width: 375, height: 812 },
  { width: 390, height: 844 },
] as const;

const LONG_VENUE =
  "Gedung Nusantara — Ballroom Utama dengan akses ramah keluarga, ruang tunggu, area parkir, dan petunjuk masuk dari Jalan Raya Bandung. ".repeat(
    5,
  );
const LONG_ADDRESS =
  "Jl. Contoh Panjang No. 123, Kelurahan Sukamaju, Kecamatan Coblong, Kota Bandung, Jawa Barat, dekat taman kota dan halte utama. ".repeat(
    5,
  );

type RuntimeEvidence = {
  consoleErrors: string[];
  consoleWarnings: string[];
  pageErrors: string[];
  requestFailures: string[];
  httpErrors: string[];
};

const evidenceByPage = new WeakMap<Page, RuntimeEvidence>();

function instrumentPage(page: Page) {
  const evidence: RuntimeEvidence = {
    consoleErrors: [],
    consoleWarnings: [],
    pageErrors: [],
    requestFailures: [],
    httpErrors: [],
  };
  evidenceByPage.set(page, evidence);

  page.on("console", (message) => {
    if (message.type() === "error") evidence.consoleErrors.push(message.text());
    if (message.type() === "warning")
      evidence.consoleWarnings.push(message.text());
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
}

async function installPerformanceObserver(page: Page) {
  await page.addInitScript(() => {
    const target = window as unknown as {
      __editorAudit?: {
        cls: number;
        layoutShifts: number;
        longTasks: number;
        lcp: number | null;
      };
    };
    target.__editorAudit = { cls: 0, layoutShifts: 0, longTasks: 0, lcp: null };

    if ("PerformanceObserver" in window) {
      if (PerformanceObserver.supportedEntryTypes.includes("layout-shift")) {
        const observer = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            const layoutShift = entry as PerformanceEntry & {
              hadRecentInput?: boolean;
              value?: number;
            };
            if (!layoutShift.hadRecentInput) {
              target.__editorAudit!.cls += layoutShift.value ?? 0;
              target.__editorAudit!.layoutShifts += 1;
            }
          }
        });
        observer.observe({ type: "layout-shift", buffered: true });
      }
      if (PerformanceObserver.supportedEntryTypes.includes("longtask")) {
        const observer = new PerformanceObserver((list) => {
          target.__editorAudit!.longTasks += list.getEntries().length;
        });
        observer.observe({ type: "longtask", buffered: true });
      }
      if (
        PerformanceObserver.supportedEntryTypes.includes(
          "largest-contentful-paint",
        )
      ) {
        const observer = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          const last = entries[entries.length - 1];
          if (last) target.__editorAudit!.lcp = last.startTime;
        });
        observer.observe({ type: "largest-contentful-paint", buffered: true });
      }
    }
  });
}

async function openEditor(
  page: Page,
  width: number,
  options: {
    fixture?: string;
    section?: string;
    invitation: string;
    reducedMotion?: boolean;
  },
) {
  await page.setViewportSize({ width, height: width === 375 ? 812 : 844 });
  if (options.reducedMotion) {
    await page.emulateMedia({ reducedMotion: "reduce" });
  }
  await page.goto(
    `/editor?fixture=${options.fixture ?? "normal"}&invitation=${options.invitation}&section=${options.section ?? "couple"}`,
    { waitUntil: "networkidle" },
  );
  await expect(page.locator("h1").first()).toBeVisible();
}

async function waitForSaved(page: Page) {
  await page.waitForTimeout(900);
  await expect(page.getByText("Tersimpan", { exact: true })).toBeVisible({
    timeout: 5_000,
  });
}

async function keyboardSelectSection(page: Page, name: RegExp) {
  const mobilePicker = page.locator("#ed-mobile-section");
  if (await mobilePicker.isVisible()) {
    const options = await mobilePicker.locator("option").allTextContents();
    const optionIndex = options.findIndex((option) => name.test(option));
    expect(optionIndex).toBeGreaterThanOrEqual(0);
    await mobilePicker.focus();
    await expect(mobilePicker).toBeFocused();
    await mobilePicker.selectOption({ index: optionIndex });
    return;
  }
  const button = page.getByRole("button", { name });
  await button.focus();
  await expect(button).toBeFocused();
  await button.press("Enter");
}

async function assertNoHorizontalOverflow(page: Page) {
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          document.documentElement.scrollWidth <=
          document.documentElement.clientWidth,
      ),
    )
    .toBe(true);
}

async function capture(page: Page, testInfo: TestInfo, name: string) {
  const path = testInfo.outputPath(`${name}.png`);
  await page.screenshot({ path, fullPage: true });
  await testInfo.attach(name, { path, contentType: "image/png" });
}

async function collectPageMetrics(page: Page) {
  return page.evaluate(() => {
    const target = window as unknown as {
      __editorAudit?: {
        cls: number;
        layoutShifts: number;
        longTasks: number;
        lcp: number | null;
      };
    };
    const navigation = performance.getEntriesByType("navigation")[0] as
      PerformanceNavigationTiming | undefined;
    const focused = document.activeElement;
    const focusedRect = focused?.getBoundingClientRect();
    return {
      viewport: { width: window.innerWidth, height: window.innerHeight },
      document: {
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
        scrollHeight: document.documentElement.scrollHeight,
      },
      performance: {
        cls: target.__editorAudit?.cls ?? null,
        layoutShifts: target.__editorAudit?.layoutShifts ?? null,
        longTasks: target.__editorAudit?.longTasks ?? null,
        lcp: target.__editorAudit?.lcp ?? null,
        domContentLoaded: navigation?.domContentLoadedEventEnd ?? null,
        load: navigation?.loadEventEnd ?? null,
      },
      focus: focused
        ? {
            tag: focused.tagName,
            id: focused.id,
            role: focused.getAttribute("role"),
            name: focused.getAttribute("aria-label"),
            visible:
              !!focusedRect && focusedRect.width > 0 && focusedRect.height > 0,
            inViewport:
              !!focusedRect &&
              focusedRect.top >= 0 &&
              focusedRect.bottom <= window.innerHeight,
          }
        : null,
    };
  });
}

async function assertRuntimeHealthy(page: Page) {
  const evidence = evidenceByPage.get(page);
  expect(evidence?.consoleErrors ?? []).toEqual([]);
  expect(evidence?.pageErrors ?? []).toEqual([]);
  expect(evidence?.requestFailures ?? []).toEqual([]);
  expect(evidence?.httpErrors ?? []).toEqual([]);
}

async function assertNoSeriousA11yViolations(page: Page) {
  const result = await new AxeBuilder({ page }).analyze();
  const serious = result.violations.filter((violation) =>
    ["critical", "serious"].includes(violation.impact ?? ""),
  );
  expect(serious, JSON.stringify(serious, null, 2)).toEqual([]);
}

test.beforeEach(async ({ page }) => {
  instrumentPage(page);
  await installPerformanceObserver(page);
});

test.afterEach(async ({ page }, testInfo) => {
  const evidence = evidenceByPage.get(page);
  const metrics = await collectPageMetrics(page).catch(() => null);
  await testInfo.attach("runtime-and-performance.json", {
    body: Buffer.from(JSON.stringify({ evidence, metrics }, null, 2)),
    contentType: "application/json",
  });
});

test.describe("guided editor browser quality", () => {
  for (const viewport of VIEWPORTS) {
    test(`core editing, preview, refresh, keyboard, and mobile layout at ${viewport.width}px`, async ({
      page,
    }, testInfo) => {
      const invitation = `audit-core-${viewport.width}-${Date.now()}-${testInfo.workerIndex}`;
      await openEditor(page, viewport.width, { invitation, section: "couple" });

      const firstName = page.getByLabel("Nama mempelai pertama");
      const secondName = page.getByLabel("Nama mempelai kedua");
      await firstName.fill("Ayu Larasati");
      await secondName.fill("Dimas Pratama");
      await waitForSaved(page);

      await keyboardSelectSection(page, /^Acara/);
      await expect(page.locator(".ed-form__header h2")).toContainText("acara");
      await page
        .getByRole("button", { name: "Tambah acara", exact: true })
        .click();
      await page
        .getByRole("button", { name: "Tambah acara", exact: true })
        .click();
      await page
        .getByRole("button", { name: "Tambah acara", exact: true })
        .click();
      const eventCards = page.locator(".ed-form .ed-repeatable-card");
      await expect(eventCards).toHaveCount(5);
      for (const [index, title] of [
        [2, "Pengajian keluarga"],
        [3, "Akad Nikah"],
        [4, "Resepsi malam"],
      ] as const) {
        const card = eventCards.nth(index);
        await card.locator('input[id^="editor-event-title-"]').fill(title);
        await card
          .locator('input[id^="editor-event-start-"]')
          .fill(
            `2026-09-${13 + index}T${String(8 + index).padStart(2, "0")}:00`,
          );
      }
      await waitForSaved(page);

      await keyboardSelectSection(page, /Lokasi & peta/);
      const venueCard = page.locator(".ed-form .ed-repeatable-card").first();
      await venueCard
        .locator('input[id^="editor-venue-name-"]')
        .fill(LONG_VENUE);
      await venueCard
        .locator('textarea[id^="editor-venue-address-"]')
        .fill(LONG_ADDRESS);
      await assertNoHorizontalOverflow(page);
      await waitForSaved(page);
      await capture(page, testInfo, `core-long-content-${viewport.width}`);

      await keyboardSelectSection(page, /^Kisah/);
      const storyToggle = page.locator("#editor-story-visible");
      await storyToggle.check();
      await expect(storyToggle).toBeChecked();
      await waitForSaved(page);
      await storyToggle.uncheck();
      await expect(storyToggle).not.toBeChecked();
      await waitForSaved(page);

      const desktopPreview = page.getByLabel("Desktop", { exact: true });
      const phonePreview = page.getByLabel("Ponsel", { exact: true });
      await desktopPreview.check();
      await expect(page.locator(".ed-device--desktop:visible")).toBeVisible();
      await phonePreview.check();
      await expect(page.locator(".ed-device--phone:visible")).toBeVisible();

      const previewTrigger = page.getByRole("button", {
        name: "Lihat pratinjau",
        exact: true,
      });
      await previewTrigger.click();
      const dialog = page.getByRole("dialog", { name: "Pratinjau undangan" });
      await expect(dialog).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(dialog).toBeHidden();
      await expect(previewTrigger).toBeFocused();

      // Start a fresh sequential-focus traversal so the browser does not retain
      // the closed dialog's previous tab-navigation anchor.
      await page.reload({ waitUntil: "networkidle" });
      await expect(page.locator("h1").first()).toBeVisible();
      if (testInfo.project.name === "webkit") {
        // WebKit does not tab to an off-screen absolutely positioned skip link;
        // focus it explicitly, matching the existing landing-page audit.
        await page.locator(".ui-skip-link").focus();
      } else {
        await page.keyboard.press("Tab");
      }
      await expect(page.locator(".ui-skip-link")).toBeFocused();
      const focusTargets: string[] = [];
      for (let index = 0; index < 32; index += 1) {
        await page.keyboard.press("Tab");
        const current = await page.evaluate(() => {
          const element = document.activeElement;
          if (!(element instanceof HTMLElement)) return null;
          const rect = element.getBoundingClientRect();
          return {
            id: element.id,
            tag: element.tagName,
            label:
              element.getAttribute("aria-label") ??
              element.textContent?.trim().slice(0, 40),
            visible: rect.width > 0 && rect.height > 0,
            inViewport: rect.top >= 0 && rect.bottom <= window.innerHeight,
          };
        });
        if (!current) continue;
        // Next.js DevTools adds a portal in development. Once the browser
        // reaches it (and then BODY), the application focus sequence is done.
        if (current.tag === "NEXTJS-PORTAL" || current.tag === "BODY") break;
        focusTargets.push(
          current.id || `${current.tag}:${current.label ?? ""}`,
        );
        expect(current.visible, JSON.stringify(current)).toBe(true);
        expect(current.inViewport, JSON.stringify(current)).toBe(true);
      }
      expect(focusTargets).toContain("ed-mobile-section");
      expect(focusTargets).toContain("editor-partner-one");
      await assertRuntimeHealthy(page);
      await capture(page, testInfo, `core-final-${viewport.width}`);

      await page.reload({ waitUntil: "networkidle" });
      await expect(page.getByLabel("Nama mempelai pertama")).toHaveValue(
        "Ayu Larasati",
      );
      await expect(page.getByLabel("Nama mempelai kedua")).toHaveValue(
        "Dimas Pratama",
      );
      await assertNoHorizontalOverflow(page);
      await assertRuntimeHealthy(page);
    });

    test(`validation and accessibility states at ${viewport.width}px`, async ({
      page,
    }, testInfo) => {
      const invitation = `audit-validation-${viewport.width}-${Date.now()}-${testInfo.workerIndex}`;
      await openEditor(page, viewport.width, {
        fixture: "missing-data",
        invitation,
        section: "settings",
      });
      await expect(
        page.getByRole("heading", { name: "Masih ada yang perlu dilengkapi" }),
      ).toBeVisible();
      await expect(
        page.getByText("Lengkapi nama kedua mempelai.", { exact: true }),
      ).toBeVisible();
      await expect(page.locator("#editor-invitation-slug")).toHaveAttribute(
        "aria-invalid",
        "true",
      );
      await assertNoSeriousA11yViolations(page);
      await assertNoHorizontalOverflow(page);
      await capture(page, testInfo, `validation-${viewport.width}`);
      await assertRuntimeHealthy(page);
    });

    test(`save failure keeps edited input at ${viewport.width}px`, async ({
      page,
    }, testInfo) => {
      const invitation = `audit-save-failed-${viewport.width}-${Date.now()}-${testInfo.workerIndex}`;
      await openEditor(page, viewport.width, {
        fixture: "save-failed",
        invitation,
        section: "couple",
      });
      const firstName = page.getByLabel("Nama mempelai pertama");
      await firstName.fill("Nama tetap ada setelah gagal simpan");
      await expect(
        page.getByText("Gagal menyimpan", { exact: true }),
      ).toBeVisible({
        timeout: 5_000,
      });
      await expect(
        page.getByText("Perubahan belum tersimpan", { exact: true }),
      ).toBeVisible();
      await expect(firstName).toHaveValue(
        "Nama tetap ada setelah gagal simpan",
      );
      await assertNoSeriousA11yViolations(page);
      await capture(page, testInfo, `save-failed-${viewport.width}`);
      await assertRuntimeHealthy(page);
    });

    test(`stale version exposes an explicit merge choice at ${viewport.width}px`, async ({
      page,
    }, testInfo) => {
      const invitation = `audit-stale-${viewport.width}-${Date.now()}-${testInfo.workerIndex}`;
      await openEditor(page, viewport.width, {
        fixture: "stale",
        invitation,
        section: "story",
      });
      const story = page.locator("#editor-story-body");
      const localStory = "Cerita pilihan lokal tetap dipertahankan.";
      await story.fill(localStory);
      await expect(
        page.getByRole("heading", { name: "Draf berubah di tempat lain" }),
      ).toBeVisible({
        timeout: 5_000,
      });
      await expect(
        page.getByRole("button", { name: "Pertahankan versi saya" }),
      ).toBeVisible();
      await page
        .getByRole("button", { name: "Pertahankan versi saya" })
        .click();
      await waitForSaved(page);
      await expect(story).toHaveValue(localStory);
      await assertNoSeriousA11yViolations(page);
      await capture(page, testInfo, `stale-${viewport.width}`);
      await assertRuntimeHealthy(page);
    });

    test(`valid and invalid image uploads at ${viewport.width}px`, async ({
      page,
    }, testInfo) => {
      const invitation = `audit-upload-${viewport.width}-${Date.now()}-${testInfo.workerIndex}`;
      await openEditor(page, viewport.width, {
        invitation,
        section: "cover",
      });
      const upload = page.locator("#editor-cover-file");
      await upload.setInputFiles({
        name: "foto-valid.png",
        mimeType: "image/png",
        buffer: Buffer.from("synthetic-valid-image"),
      });
      await expect(
        page.getByText("Sedang diproses", { exact: true }),
      ).toBeVisible();
      await expect(
        page.getByText("Siap digunakan", { exact: true }),
      ).toBeVisible({
        timeout: 5_000,
      });
      await upload.setInputFiles({
        name: "foto-tidak-valid.pdf",
        mimeType: "application/pdf",
        buffer: Buffer.from("synthetic-invalid-image"),
      });
      await expect(
        page.getByText("Media tidak dapat digunakan", { exact: true }),
      ).toBeVisible();
      await expect(
        page.getByText("Format file ini belum didukung.", { exact: true }),
      ).toBeVisible();
      await assertNoSeriousA11yViolations(page);
      await assertNoHorizontalOverflow(page);
      await capture(page, testInfo, `uploads-${viewport.width}`);
      await assertRuntimeHealthy(page);
    });

    test(`reduced motion and performance evidence at ${viewport.width}px`, async ({
      page,
    }, testInfo) => {
      const invitation = `audit-performance-${viewport.width}-${Date.now()}-${testInfo.workerIndex}`;
      await openEditor(page, viewport.width, {
        invitation,
        section: "couple",
        reducedMotion: true,
      });
      const motion = await page.evaluate(() => {
        const durationInMilliseconds = (value: string) => {
          if (value.endsWith("ms")) return Number.parseFloat(value);
          if (value.endsWith("s")) return Number.parseFloat(value) * 1_000;
          return Number.POSITIVE_INFINITY;
        };
        const elements = [
          document.querySelector(".ed-shell"),
          document.querySelector(".ed-header"),
          document.querySelector(".ed-form"),
        ].filter((element): element is Element => !!element);
        return elements.map((element) => {
          const style = getComputedStyle(element);
          return {
            animationDuration: durationInMilliseconds(style.animationDuration),
            transitionDuration: durationInMilliseconds(
              style.transitionDuration,
            ),
          };
        });
      });
      expect(motion.every((item) => item.animationDuration <= 0.001)).toBe(
        true,
      );
      expect(motion.every((item) => item.transitionDuration <= 0.001)).toBe(
        true,
      );
      await page.waitForTimeout(300);
      const metrics = await collectPageMetrics(page);
      expect(metrics.document.scrollWidth).toBeLessThanOrEqual(
        metrics.document.clientWidth,
      );
      if (metrics.performance.cls !== null) {
        expect(metrics.performance.cls).toBeLessThan(0.1);
      }
      await testInfo.attach("performance-metrics.json", {
        body: Buffer.from(JSON.stringify(metrics, null, 2)),
        contentType: "application/json",
      });
      await assertRuntimeHealthy(page);
      await capture(page, testInfo, `performance-${viewport.width}`);
    });
  }
});
