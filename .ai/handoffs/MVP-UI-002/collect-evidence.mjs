// Evidence collector for MVP-UI-002 landing page validation.
// Run with: node .ai/handoffs/MVP-UI-002/collect-evidence.mjs (server must be on :3000)
import { chromium } from "playwright";
import { writeFileSync } from "node:fs";

const BASE = "http://localhost:3000";
const OUT = new URL(".", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
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

// 1. Screenshots at required widths (fullPage)
const viewports = [
  [320, 568],
  [375, 667],
  [390, 844],
  [768, 1024],
  [1024, 768],
  [1440, 900],
];
log("== Screenshots ==");
for (const [w, h] of viewports) {
  await page.setViewportSize({ width: w, height: h });
  await page.goto(BASE, { waitUntil: "networkidle" });
  await page.screenshot({ path: `${OUT}landing-${w}x${h}.png`, fullPage: true });
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  log(`${w}x${h}: saved, horizontal-overflow=${overflow}px`);
}

// 2. 200%-zoom-equivalent overflow check (320px content in 640px window)
await page.setViewportSize({ width: 640, height: 360 });
await page.goto(BASE, { waitUntil: "networkidle" });
const zoomOverflow = await page.evaluate(
  () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
);
log(`\n== 200% zoom equivalent (640px viewport) ==\nhorizontal-overflow=${zoomOverflow}px`);

// 3. Reduced motion
await page.emulateMedia({ reducedMotion: "reduce" });
await page.goto(BASE, { waitUntil: "networkidle" });
await page.locator("details summary").first().click();
await page.waitForTimeout(200);
const chevronDuration = await page
  .locator(".lnd-faq__chevron")
  .first()
  .evaluate((el) => getComputedStyle(el).transitionDuration);
const detailsOpen = await page.locator("details").first().evaluate((d) => d.open);
log(`\n== Reduced motion ==\n.lnd-faq__chevron transitionDuration=${chevronDuration} (expect 0s)`);
log(`first details open after click=${detailsOpen}`);
await page.emulateMedia({ reducedMotion: null });

// 4. Keyboard tab order (desktop)
await page.setViewportSize({ width: 1440, height: 900 });
await page.goto(BASE, { waitUntil: "networkidle" });
log("\n== Keyboard tab order (1440px) ==");
for (let i = 0; i < 14; i++) {
  await page.keyboard.press("Tab");
  const info = await page.evaluate(() => {
    const el = document.activeElement;
    if (!el || el === document.body) return "(body)";
    const tag = el.tagName.toLowerCase();
    const label =
      el.getAttribute("aria-label") ??
      el.textContent?.trim().split("\n")[0].slice(0, 60) ??
      "";
    const href = el.getAttribute("href") ? ` -> ${el.getAttribute("href")}` : "";
    return `<${tag}> "${label}"${href}`;
  });
  log(`Tab ${i + 1}: ${info}`);
  if (info === "(body)") break;
}

// 5. Mobile drawer focus trap (375px)
await page.setViewportSize({ width: 375, height: 667 });
await page.goto(BASE, { waitUntil: "networkidle" });
const menuBtn = page.getByRole("button", { name: "Menu" });
if (await menuBtn.isVisible()) {
  await menuBtn.click();
  await page.waitForTimeout(200);
  const focusInDialog = await page.evaluate(() => {
    const dlg = document.querySelector("dialog[open]");
    return dlg ? dlg.contains(document.activeElement) : false;
  });
  log(`\n== Mobile drawer (375px) ==\nfocus inside dialog after open=${focusInDialog}`);
  await page.screenshot({ path: `${OUT}landing-375x667-drawer.png` });
  await page.keyboard.press("Escape");
  await page.waitForTimeout(200);
  const drawerClosed = await page.evaluate(() => !document.querySelector("dialog[open]"));
  const focusReturned = await page.evaluate(() => {
    const btn = [...document.querySelectorAll("button")].find(
      (b) => b.textContent?.trim() === "Menu",
    );
    return document.activeElement === btn;
  });
  log(`drawer closed after Escape=${drawerClosed}`);
  log(`focus returned to Menu trigger=${focusReturned}`);
} else {
  log("\n== Mobile drawer ==\nMenu button not visible at 375px");
}

// 6. Console / network
log(`\n== Console errors ==\n${consoleErrors.length ? consoleErrors.join("\n") : "none"}`);
log(`\n== Network failures ==\n${networkFailures.length ? networkFailures.join("\n") : "none"}`);

writeFileSync(`${OUT}evidence.txt`, lines.join("\n"));
await browser.close();
log(`\nEvidence written to ${OUT}evidence.txt`);
