import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("@a11y customer dashboard shell has no serious or critical violations", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/dashboard", { waitUntil: "networkidle" });
  await expect(
    page.getByRole("heading", { name: "Anda belum masuk" }),
  ).toBeVisible();

  const result = await new AxeBuilder({ page }).analyze();
  const serious = result.violations.filter((violation) =>
    ["critical", "serious"].includes(violation.impact ?? ""),
  );
  expect(serious, JSON.stringify(serious, null, 2)).toEqual([]);
});
