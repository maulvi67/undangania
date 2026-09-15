import { test, expect } from "@playwright/test";
test("@smoke landing exposes product purpose", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading")).toBeVisible();
});
// Add seeded purchase, publication, RSVP, print, and notification journeys before release.
