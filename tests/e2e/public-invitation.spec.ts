import { expect, test } from "@playwright/test";

const URL = "/invite/rani-bima";

test.describe("golden public invitation", () => {
  test("opens the invitation and exposes the complete Indonesian journey", async ({
    page,
  }) => {
    await page.goto(URL);
    await expect(page.getByText("Buka undangan")).toBeVisible();
    await page.getByText("Buka undangan").click();
    await expect(
      page.getByRole("heading", { name: "Rani & Bima" }).first(),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Rangkaian acara" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Kisah kami" }),
    ).toBeVisible();
    await expect(page.getByRole("heading", { name: "Galeri" })).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Konfirmasi kehadiran" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Tanda kasih" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Buku tamu" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Sampai jumpa" }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: /Buka peta/ }).first(),
    ).toHaveAttribute("href", /https:\/\/maps\.google\.com\//);
  });

  test("renders the required content fixtures", async ({ page }) => {
    await page.goto("/invite/rani-bima-long-content");
    await page.getByText("Buka undangan").click();
    await expect(
      page.getByRole("heading", { name: /Raden Mas Aditya/ }).first(),
    ).toBeVisible();
    await expect(
      page.getByText(/Pendopo Agung Puspa Negara/).first(),
    ).toBeVisible();

    await page.goto("/invite/rani-bima-three-events");
    await page.getByText("Buka undangan").click();
    await expect(page.locator(".gld-event")).toHaveCount(3);

    await page.goto("/invite/rani-bima-large-gallery");
    await page.getByText("Buka undangan").click();
    await expect(page.locator(".gld-gallery__tile")).toHaveCount(30);

    await page.goto("/invite/rani-bima-missing-optional");
    await page.getByText("Buka undangan").click();
    await expect(page.getByRole("heading", { name: "Kisah kami" })).toHaveCount(
      0,
    );
    await expect(
      page.getByRole("heading", { name: "Tanda kasih" }),
    ).toHaveCount(0);
  });

  test("keeps RSVP as an accessible in-page action", async ({ page }) => {
    await page.goto(URL);
    await page.getByText("Buka undangan").click();
    const rsvp = page.getByRole("link", { name: /Konfirmasi kehadiran/ });
    await expect(rsvp).toHaveAttribute("href", "#rsvp");
    await rsvp.focus();
    await expect(rsvp).toBeFocused();
  });

  test("has no console or network failures", async ({ page }) => {
    const consoleErrors: string[] = [];
    const failedRequests: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") consoleErrors.push(message.text());
    });
    page.on("requestfailed", (request) => {
      failedRequests.push(`${request.method()} ${request.url()}`);
    });
    page.on("response", (response) => {
      if (response.status() >= 400)
        failedRequests.push(`${response.status()} ${response.url()}`);
    });
    await page.goto(URL, { waitUntil: "networkidle" });
    expect(consoleErrors).toEqual([]);
    expect(failedRequests).toEqual([]);
  });
});
