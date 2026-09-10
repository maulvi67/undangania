// Evidence collector for MVP-UI-003 template catalog validation.
// Run with: node .ai/handoffs/MVP-UI-003/collect-evidence.mjs (server on :3000)
import { chromium } from "playwright";
import { writeFileSync } from "node:fs";

const BASE = "http://localhost:3000";
const OUT = new URL(".", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const CATALOG = `${BASE}/templates`;
const lines = [];
const log = (s = "") => {
  lines.push(s);
  console.log(s);
};
const consoleErrors = [];
const networkFailures = [];

const browser = await chromium.launch();
const ctx = await browser.newContext();
const page = await ctx.newPage();
page.on("console", (m) => {
  if (m.type() === "error") consoleErrors.push(m.text());
});
page.on("requestfailed", (r) => {
  networkFailures.push(`${r.method()} ${r.url()} — ${r.failure()?.errorText ?? "?"}`);
});
page.on("response", (r) => {
  if (r.status() >= 400) networkFailures.push(`HTTP ${r.status()} ${r.url()}`);
});

// 1. Catalog screenshots across widths (default + filtered + empty states)
log("== Catalog screenshots (default) ==");
for (const [w, h] of [
  [320, 568],
  [375, 667],
  [390, 844],
  [768, 1024],
  [1024, 768],
  [1440, 900],
]) {
  await page.setViewportSize({ width: w, height: h });
  await page.goto(CATALOG, { waitUntil: "networkidle" });
  await page.screenshot({ path: `${OUT}catalog-${w}x${h}.png`, fullPage: true });
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  log(`${w}x${h}: saved, overflow=${overflow}px`);
}

log("\n== Filtered state (q=klasik&harga=eksklusif&urutkan=harga-terendah) ==");
await page.setViewportSize({ width: 375, height: 667 });
await page.goto(`${CATALOG}?q=klasik&harga=eksklusif&urutkan=harga-terendah`, {
  waitUntil: "networkidle",
});
await page.screenshot({ path: `${OUT}catalog-375x667-filtered.png`, fullPage: true });
const tokenCount = await page.locator(".ctlg-tokens__token").count();
const resultText = await page.locator(".ctlg-count").textContent();
log(`tokens=${tokenCount}, count text="${resultText?.trim()}"`);

log("\n== Empty search state ==");
await page.goto(`${CATALOG}?q=tidakada`, { waitUntil: "networkidle" });
await page.screenshot({ path: `${OUT}catalog-375x667-empty.png`, fullPage: true });
const emptyHeading = await page
  .getByRole("heading", { name: "Tidak ada desain yang cocok" })
  .isVisible();
log(`empty state shown=${emptyHeading}`);

log("\n== Collapsed filter panel (320px) ==");
await page.setViewportSize({ width: 320, height: 568 });
await page.goto(CATALOG, { waitUntil: "networkidle" });
await page
  .locator("details.ctlg-filters")
  .evaluate((el) => el.removeAttribute("open"));
await page.screenshot({ path: `${OUT}catalog-320x568-collapsed.png`, fullPage: true });
const overflowCollapsed = await page.evaluate(
  () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
);
log(`collapsed overflow=${overflowCollapsed}px`);

// 2. 200% zoom equivalent (640px viewport = 1280/2)
await page.setViewportSize({ width: 640, height: 640 });
await page.goto(CATALOG, { waitUntil: "networkidle" });
const overflowZoom = await page.evaluate(
  () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
);
log(`\n== 200% zoom equivalent (640px) ==\noverflow=${overflowZoom}px`);

// 3. Search interaction (keyboard path): fill + submit → URL + count
await page.setViewportSize({ width: 1440, height: 900 });
await page.goto(CATALOG, { waitUntil: "networkidle" });
await page.fill("#ctlg-q", "nara");
await page.getByRole("button", { name: "Cari" }).click();
await page.waitForURL(/q=nara/);
await page.waitForLoadState("networkidle");
const afterSearchUrl = page.url().replace(BASE, "");
const afterSearchCount = (await page.locator(".ctlg-count").textContent())?.trim();
log(`\n== Search interaction ==\nurl=${afterSearchUrl}, count="${afterSearchCount}"`);
await page.screenshot({ path: `${OUT}catalog-1440x900-search-nara.png`, fullPage: true });

// 4. Filter interaction: tier radio + apply → URL + parity hint visible
await page.goto(CATALOG, { waitUntil: "networkidle" });
await page.getByLabel("Eksklusif", { exact: true }).check();
await page.getByRole("button", { name: "Terapkan filter" }).click();
await page.waitForURL(/harga=eksklusif/);
const tierUrl = page.url().replace(BASE, "");
const tierCount = (await page.locator(".ctlg-count").textContent())?.trim();
const parityHint = await page
  .getByText("Semua level harga memiliki fitur inti yang sama")
  .first()
  .isVisible();
log(`\n== Tier filter ==\nurl=${tierUrl}, count="${tierCount}", parity hint visible=${parityHint}`);

// 5. Reduced motion
await page.emulateMedia({ reducedMotion: "reduce" });
await page.goto(CATALOG, { waitUntil: "networkidle" });
const chipTransition = await page
  .locator(".ctlg-chips .ui-choice__label")
  .first()
  .evaluate((el) => getComputedStyle(el).transitionDuration);
log(`\n== Reduced motion ==\nchip transitionDuration=${chipTransition} (expect 0s)`);
await page.emulateMedia({ reducedMotion: null });

// 6. Keyboard tab order (desktop 1440)
await page.setViewportSize({ width: 1440, height: 900 });
await page.goto(CATALOG, { waitUntil: "networkidle" });
log("\n== Keyboard tab order (1440px) ==");
for (let i = 0; i < 18; i++) {
  await page.keyboard.press("Tab");
  const info = await page.evaluate(() => {
    const el = document.activeElement;
    if (!el || el === document.body) return "(body)";
    const tag = el.tagName.toLowerCase();
    const label =
      el.getAttribute("aria-label") ??
      el.textContent?.trim().split("\n")[0].slice(0, 60) ??
      "";
    return `<${tag}> "${label}"`;
  });
  log(`Tab ${i + 1}: ${info}`);
  if (info === "(body)") break;
}

// 7. Keyboard operability of collapsed <details> (mobile)
await page.setViewportSize({ width: 375, height: 667 });
await page.goto(CATALOG, { waitUntil: "networkidle" });
await page
  .locator("details.ctlg-filters")
  .evaluate((el) => el.removeAttribute("open"));
await page.keyboard.press("Tab");
await page.keyboard.press("Tab");
await page.keyboard.press("Tab");
const summaryFocused = await page.evaluate(
  () => document.activeElement?.tagName?.toLowerCase() === "summary",
);
log(`\n== Collapsed details keyboard ==\nsummary reachable via Tab=${summaryFocused}`);

// 8. Console / network
log(`\n== Console errors ==\n${consoleErrors.length ? consoleErrors.join("\n") : "none"}`);
log(`\n== Network failures ==\n${networkFailures.length ? networkFailures.join("\n") : "none"}`);

writeFileSync(`${OUT}evidence.txt`, lines.join("\n"));
await browser.close();
log(`\nEvidence written to ${OUT}evidence.txt`);
