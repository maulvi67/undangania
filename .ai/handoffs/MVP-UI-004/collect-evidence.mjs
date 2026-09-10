// Evidence collector for MVP-UI-004 template detail + demo validation.
// Run with: node .ai/handoffs/MVP-UI-004/collect-evidence.mjs (server on :3000)
import { chromium } from "playwright";
import { writeFileSync } from "node:fs";

const BASE = "http://localhost:3000";
const OUT = new URL(".", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const DETAIL = `${BASE}/templates/seruni-klasik`;
const DEMO = `${DETAIL}/demo`;
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

// 1. Detail screenshots across widths
log("== Detail screenshots ==");
for (const [w, h] of [
  [320, 568],
  [375, 667],
  [390, 844],
  [768, 1024],
  [1024, 768],
  [1440, 900],
]) {
  await page.setViewportSize({ width: w, height: h });
  await page.goto(DETAIL, { waitUntil: "networkidle" });
  await page.screenshot({ path: `${OUT}detail-${w}x${h}.png`, fullPage: true });
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  log(`${w}x${h}: saved, overflow=${overflow}px`);
}

// 2. Device switch (desktop) screenshot
await page.setViewportSize({ width: 1024, height: 768 });
await page.goto(DETAIL, { waitUntil: "networkidle" });
await page.locator("label[for='tpl-device-desktop']").click();
await page.waitForTimeout(300);
const frameWidth = await page
  .locator(".tpl-device__frame")
  .evaluate((el) => el.getBoundingClientRect().width);
log(`\n== Device switch ==\ndesktop frame width=${frameWidth.toFixed(0)}px (phone max is 360px)`);
await page.screenshot({ path: `${OUT}detail-1024x768-desktop.png`, fullPage: true });

// 3. Demo screenshots + RSVP interaction
log("\n== Demo ==");
await page.setViewportSize({ width: 375, height: 667 });
await page.goto(DEMO, { waitUntil: "networkidle" });
await page.screenshot({ path: `${OUT}demo-375x667.png`, fullPage: true });
await page.setViewportSize({ width: 1440, height: 900 });
await page.goto(DEMO, { waitUntil: "networkidle" });
await page.screenshot({ path: `${OUT}demo-1440x900.png`, fullPage: true });
await page.setViewportSize({ width: 375, height: 667 });
await page.goto(DEMO, { waitUntil: "networkidle" });
await page.getByRole("button", { name: "Kirim konfirmasi" }).click();
const validationVisible = await page.getByText("Mohon isi nama Anda.").isVisible();
await page.getByLabel("Nama Anda").fill("Sinta");
await page.getByRole("button", { name: "Kirim konfirmasi" }).click();
const successVisible = await page.getByText("Terima kasih, Sinta!").isVisible();
log(`RSVP validation shown=${validationVisible}, success shown=${successVisible}`);
await page.screenshot({ path: `${OUT}demo-375x667-rsvp-success.png`, fullPage: true });

// 4. Retired/unknown template recovery
await page.goto(`${BASE}/templates/cempaka-lama`);
const notFoundVisible = await page
  .getByRole("heading", { name: "Desain ini tidak ditemukan" })
  .isVisible();
log(`\n== Retired template ==\nrecovery page shown=${notFoundVisible}`);
await page.screenshot({ path: `${OUT}retired-375x667.png`, fullPage: true });

// 5. /demo redirect
await page.goto(`${BASE}/demo`, { waitUntil: "commit" });
log(`\n== /demo redirect ==\nlanded on ${page.url().replace(BASE, "")}`);

// 6. Reduced motion
await page.emulateMedia({ reducedMotion: "reduce" });
await page.goto(DETAIL, { waitUntil: "networkidle" });
const frameTransition = await page
  .locator(".tpl-device__frame")
  .evaluate((el) => getComputedStyle(el).transitionDuration);
log(`\n== Reduced motion ==\n.tpl-device__frame transitionDuration=${frameTransition} (expect 0s)`);
await page.emulateMedia({ reducedMotion: null });

// 7. Keyboard tab order (desktop 1440)
await page.setViewportSize({ width: 1440, height: 900 });
await page.goto(DETAIL, { waitUntil: "networkidle" });
log("\n== Keyboard tab order (1440px, detail) ==");
for (let i = 0; i < 16; i++) {
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

// 8. Sticky bar focus clearance (mobile)
await page.setViewportSize({ width: 375, height: 667 });
await page.goto(DETAIL, { waitUntil: "networkidle" });
const stickyVisible = await page.locator(".tpl-sticky").isVisible();
let allClear = true;
for (let i = 0; i < 25; i++) {
  await page.keyboard.press("Tab");
  const clear = await page.evaluate(() => {
    const bar = document.querySelector(".tpl-sticky");
    const el = document.activeElement;
    if (!bar || !el || el === document.body || bar.contains(el)) return true;
    const barBox = bar.getBoundingClientRect();
    const elBox = el.getBoundingClientRect();
    return !(elBox.top < barBox.bottom && elBox.bottom > barBox.top);
  });
  if (!clear) allClear = false;
}
log(`\n== Sticky bar (375px) ==\nbar visible=${stickyVisible}, focus always clear of bar=${allClear}`);

// 9. Console / network
log(`\n== Console errors ==\n${consoleErrors.length ? consoleErrors.join("\n") : "none"}`);
log(`\n== Network failures ==\n${networkFailures.length ? networkFailures.join("\n") : "none"}`);

writeFileSync(`${OUT}evidence.txt`, lines.join("\n"));
await browser.close();
log(`\nEvidence written to ${OUT}evidence.txt`);
