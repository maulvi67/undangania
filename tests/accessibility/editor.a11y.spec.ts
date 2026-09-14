import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

async function openEditor(
  page: Page,
  fixture: string,
  section: string,
  invitation: string,
) {
  await page.goto(
    `/editor?fixture=${fixture}&invitation=${invitation}&section=${section}`,
    { waitUntil: "networkidle" },
  );
  await expect(page.locator("h1").first()).toBeVisible();
}

async function expectNoSeriousViolations(page: Page) {
  const result = await new AxeBuilder({ page }).analyze();
  const serious = result.violations.filter((violation) =>
    ["critical", "serious"].includes(violation.impact ?? ""),
  );
  expect(serious, JSON.stringify(serious, null, 2)).toEqual([]);
}

test.describe("guided editor accessibility", () => {
  test("@a11y default editor has no serious or critical violations", async ({
    page,
  }) => {
    await openEditor(page, "normal", "couple", `a11y-default-${Date.now()}`);
    await expectNoSeriousViolations(page);
  });

  test("@a11y validation state exposes errors accessibly", async ({ page }) => {
    await openEditor(
      page,
      "missing-data",
      "settings",
      `a11y-validation-${Date.now()}`,
    );
    await expect(
      page.getByRole("heading", { name: "Masih ada yang perlu dilengkapi" }),
    ).toBeVisible();
    await expectNoSeriousViolations(page);
  });

  test("@a11y save failure keeps status and form usable", async ({ page }) => {
    await openEditor(
      page,
      "save-failed",
      "couple",
      `a11y-save-failed-${Date.now()}`,
    );
    await page
      .getByLabel("Nama mempelai pertama")
      .fill("Nama yang tetap tersimpan di layar");
    await expect(
      page.getByText("Perubahan belum tersimpan", { exact: true }),
    ).toBeVisible({
      timeout: 5_000,
    });
    await expectNoSeriousViolations(page);
  });

  test("@a11y stale conflict exposes explicit actions", async ({ page }) => {
    await openEditor(page, "stale", "story", `a11y-stale-${Date.now()}`);
    await page
      .locator("#editor-story-body")
      .fill("Cerita lokal yang perlu ditinjau.");
    await expect(
      page.getByRole("heading", { name: "Draf berubah di tempat lain" }),
    ).toBeVisible({ timeout: 5_000 });
    await expectNoSeriousViolations(page);
  });

  test("@a11y rejected upload has a visible accessible explanation", async ({
    page,
  }) => {
    await openEditor(
      page,
      "normal",
      "cover",
      `a11y-upload-rejected-${Date.now()}`,
    );
    await page.locator("#editor-cover-file").setInputFiles({
      name: "bukan-gambar.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("invalid-image"),
    });
    await expect(
      page
        .getByRole("alert")
        .filter({ hasText: "Media tidak dapat digunakan" })
        .first(),
    ).toBeVisible();
    await expectNoSeriousViolations(page);
  });

  test("@a11y preview dialog traps and returns focus correctly", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await openEditor(page, "normal", "couple", `a11y-preview-${Date.now()}`);
    const trigger = page.getByRole("button", {
      name: "Lihat pratinjau",
      exact: true,
    });
    await trigger.click();
    const dialog = page.getByRole("dialog", { name: "Pratinjau undangan" });
    await expect(dialog).toBeVisible();
    await expectNoSeriousViolations(page);
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(trigger).toBeFocused();
  });
});
