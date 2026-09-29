import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const URL = "/invite/rani-bima";

test.describe("golden public invitation accessibility", () => {
  test("has no critical or serious axe violations before opening", async ({
    page,
  }) => {
    await page.goto(URL);
    const result = await new AxeBuilder({ page }).analyze();
    expect(
      result.violations.filter((item) =>
        ["critical", "serious"].includes(item.impact ?? ""),
      ),
    ).toEqual([]);
  });

  test("has no critical or serious axe violations after opening and FAQ expansion", async ({
    page,
  }) => {
    await page.goto(URL);
    await page.getByText("Buka undangan").click();
    await page.getByRole("button", { name: /Tidak ada/ }).count();
    const faq = page.locator(".gld-faq summary").first();
    await faq.click();
    const result = await new AxeBuilder({ page }).analyze();
    expect(
      result.violations.filter((item) =>
        ["critical", "serious"].includes(item.impact ?? ""),
      ),
    ).toEqual([]);
  });

  test("has a logical keyboard path and visible focus targets", async ({
    page,
    browserName,
  }) => {
    await page.goto(URL);
    if (browserName === "webkit") {
      await page.locator(".ui-skip-link").focus();
    } else {
      await page.keyboard.press("Tab");
    }
    await expect(page.locator(".ui-skip-link")).toBeFocused();
    if (browserName === "webkit") {
      await page.getByRole("link", { name: "Undangania" }).focus();
    } else {
      await page.keyboard.press("Tab");
    }
    await expect(
      page.getByRole("link", { name: "Undangania" }),
    ).toBeFocused();
    if (browserName === "webkit") {
      await page.locator(".gld-opening > summary").focus();
    } else {
      await page.keyboard.press("Tab");
    }
    await expect(page.locator(".gld-opening > summary")).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.locator(".gld-opening")).toHaveAttribute("open", "");
  });

  test("opens without JavaScript through native details behavior", async ({
    browser,
  }) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();
    await page.goto(URL);
    await page.getByText("Buka undangan").click();
    await expect(
      page.getByRole("heading", { name: "Rangkaian acara" }),
    ).toBeVisible();
    await context.close();
  });
});
