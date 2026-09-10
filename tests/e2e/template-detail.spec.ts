import { test, expect } from "@playwright/test";

const TEMPLATE_ID = "seruni-klasik";
const DETAIL_URL = `/templates/${TEMPLATE_ID}`;

test.describe("template detail page", () => {
  test("answers the seven primary customer questions", async ({ page }) => {
    await page.goto(DETAIL_URL);
    // 1. What does the design look like — large preview present.
    await expect(page.locator(".tpl-preview")).toBeVisible();
    // 2. Smartphone view — device switch defaults to phone frame.
    await expect(page.locator("#tpl-device-ponsel")).toBeChecked();
    // 3. Supported sections.
    await expect(
      page.getByRole("heading", { name: "Bagian undangan yang didukung" }),
    ).toBeVisible();
    await expect(page.getByText("RSVP / konfirmasi kehadiran")).toBeVisible();
    // 4. Price.
    await expect(page.getByText("Rp 349.000").first()).toBeVisible();
    // 5. What is included — core features.
    await expect(page.getByText("Semua fitur inti undangan digital")).toBeVisible();
    // 6. What happens after purchase.
    await expect(page.getByRole("heading", { name: "Setelah memilih desain ini" })).toBeVisible();
    // 7. Active period.
    await expect(page.getByText("hingga 30 hari setelah tanggal acara").first()).toBeVisible();
  });

  test("device preview switch toggles frame width without JavaScript APIs", async ({ page }) => {
    await page.goto(DETAIL_URL);
    const frame = page.locator(".tpl-device__frame");
    await page.locator("label[for='tpl-device-desktop']").click();
    await expect(page.locator("#tpl-device-desktop")).toBeChecked();
    // Aspect ratio change is viewport-independent (width alone is not:
    // narrow viewports constrain the phone frame to the same column width).
    const ratio = await frame.evaluate((el) => getComputedStyle(el).aspectRatio);
    expect(ratio).toBe("16 / 10");
    // Switch back via keyboard (radio group arrow keys).
    await page.locator("#tpl-device-desktop").focus();
    await page.keyboard.press("ArrowUp");
    await expect(page.locator("#tpl-device-ponsel")).toBeChecked();
    const phoneRatio = await frame.evaluate((el) => getComputedStyle(el).aspectRatio);
    expect(phoneRatio).toBe("9 / 18");
  });

  test("CTAs target demo and signup; back link returns to catalog", async ({ page }) => {
    await page.goto(DETAIL_URL);
    await expect(page.getByRole("link", { name: "Lihat demo undangan" })).toHaveAttribute(
      "href",
      `${DETAIL_URL}/demo`,
    );
    await expect(page.getByRole("link", { name: "Pilih desain" }).first()).toHaveAttribute(
      "href",
      "/daftar",
    );
    await expect(page.getByRole("link", { name: "Kembali ke katalog desain" })).toHaveAttribute(
      "href",
      "/templates",
    );
  });

  test("mobile sticky bar shows price and select CTA without hiding focused content", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto(DETAIL_URL);
    const bar = page.locator(".tpl-sticky");
    await expect(bar).toBeVisible();
    await expect(bar.getByText("Rp 349.000")).toBeVisible();
    await expect(bar.getByRole("link", { name: "Pilih desain" })).toBeVisible();
    // Focus-driven scrolling must keep the focused element clear of the bar
    // (elements inside the bar itself are fine).
    for (let i = 0; i < 30; i++) {
      await page.keyboard.press("Tab");
      // Overlap test: the element is obscured only if it sits behind the
      // pinned bar (vertical intersection), not merely below it in flow.
      const clear = await page.evaluate(() => {
        const bar = document.querySelector(".tpl-sticky");
        const el = document.activeElement;
        if (!bar || !el || el === document.body || bar.contains(el)) return true;
        const barBox = bar.getBoundingClientRect();
        const elBox = el.getBoundingClientRect();
        const overlaps = elBox.top < barBox.bottom && elBox.bottom > barBox.top;
        return !overlaps;
      });
      expect(clear).toBe(true);
    }
  });

  test("retired or unknown template shows safe recovery", async ({ page }) => {
    await page.goto("/templates/cempaka-lama");
    await expect(page.getByRole("heading", { name: "Desain ini tidak ditemukan" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Lihat katalog desain" })).toHaveAttribute(
      "href",
      "/templates",
    );
    await expect(page.getByRole("link", { name: "Kembali ke halaman utama" })).toHaveAttribute(
      "href",
      "/",
    );
    await page.goto("/templates/tidak-ada");
    await expect(page.getByRole("heading", { name: "Desain ini tidak ditemukan" })).toBeVisible();
  });

  test("no console or network failures while loading", async ({ page }) => {
    const consoleErrors: string[] = [];
    const failedRequests: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") consoleErrors.push(message.text());
    });
    page.on("requestfailed", (request) => {
      failedRequests.push(`${request.method()} ${request.url()} ${request.failure()?.errorText ?? ""}`);
    });
    page.on("response", (response) => {
      if (response.status() >= 400) failedRequests.push(`${response.status()} ${response.url()}`);
    });
    await page.goto(DETAIL_URL, { waitUntil: "networkidle" });
    expect(consoleErrors).toEqual([]);
    expect(failedRequests).toEqual([]);
  });
});

test.describe("interactive demo", () => {
  test("demo route renders synthetic full invitation with clear demo labeling", async ({
    page,
  }) => {
    await page.goto(`${DETAIL_URL}/demo`);
    await expect(page.getByText("data contoh", { exact: false }).first()).toBeVisible();
    await expect(page.getByRole("heading", { name: "Rai & Anisa" }).first()).toBeVisible();
    await expect(page.getByRole("heading", { name: "Rangkaian acara" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Konfirmasi kehadiran" })).toBeVisible();
    await expect(page.getByText("Pratinjau demo — isian pada formulir ini tidak dikirim ke mana pun.")).toBeVisible();
    await expect(page.getByRole("link", { name: "Kembali ke detail desain" })).toHaveAttribute(
      "href",
      DETAIL_URL,
    );
  });

  test("RSVP demo form validates and confirms locally", async ({ page }) => {
    await page.goto(`${DETAIL_URL}/demo`);
    await page.getByRole("button", { name: "Kirim konfirmasi" }).click();
    await expect(page.getByText("Mohon isi nama Anda.")).toBeVisible();
    await page.getByLabel("Nama Anda").fill("Sinta");
    await page.getByRole("button", { name: "Kirim konfirmasi" }).click();
    await expect(page.getByText("Terima kasih, Sinta!")).toBeVisible();
  });

  test("/demo redirects to the default template demo", async ({ page }) => {
    await page.goto("/demo");
    await expect(page).toHaveURL(new RegExp(`/templates/${TEMPLATE_ID}/demo$`));
    await expect(page.getByText("data contoh", { exact: false }).first()).toBeVisible();
  });

  test("demo has no console or network failures", async ({ page }) => {
    const consoleErrors: string[] = [];
    const failedRequests: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") consoleErrors.push(message.text());
    });
    page.on("requestfailed", (request) => {
      failedRequests.push(`${request.method()} ${request.url()} ${request.failure()?.errorText ?? ""}`);
    });
    page.on("response", (response) => {
      if (response.status() >= 400) failedRequests.push(`${response.status()} ${response.url()}`);
    });
    await page.goto(`${DETAIL_URL}/demo`, { waitUntil: "networkidle" });
    expect(consoleErrors).toEqual([]);
    expect(failedRequests).toEqual([]);
  });
});

test.describe("template detail without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("content and device switch (CSS radios) work without JavaScript", async ({ page }) => {
    await page.goto(DETAIL_URL);
    await expect(page.getByRole("heading", { name: "Seruni", level: 1 })).toBeVisible();
    await expect(page.getByText("Rp 349.000").first()).toBeVisible();
    // Radio group is operable without JS: the label is a native toggle.
    await page.locator("label[for='tpl-device-desktop']").click();
    expect(await page.locator("#tpl-device-desktop").isChecked()).toBe(true);
  });
});
