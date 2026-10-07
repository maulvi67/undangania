import { expect, test } from "@playwright/test";

/**
 * The E2E environment has no session fixture, so these tests cover the
 * unauthenticated dashboard shell: real navigation targets, unavailable
 * entries, responsive layout, and the mobile drawer. Authenticated flows
 * (share dialog, RSVP, guestbook moderation, orders) require a seeded
 * session and are exercised manually until an auth fixture exists.
 */

const SIDEBAR_LINKS = [
  ["Dashboard", "/dashboard"],
  ["Pesanan Saya", "/pesanan"],
  ["Undangan Saya", "/editor"],
  ["Pilih Template", "/templates"],
  ["Data Acara", "/editor?section=events"],
  ["Galeri Foto", "/editor?section=gallery"],
  ["Musik", "/editor?section=music"],
  ["Tamu & RSVP", "/tamu"],
  ["Buku Tamu", "/buku-tamu"],
  ["Bantuan", "/#faq"],
] as const;

test.describe("customer dashboard", () => {
  test("shows the unauthenticated state with real navigation", async ({
    page,
  }) => {
    await page.goto("/dashboard", { waitUntil: "networkidle" });

    await expect(
      page.getByRole("heading", { name: "Anda belum masuk" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Masuk ke Undangania" }),
    ).toBeVisible();

    const topbar = page.locator(".prototype-topbar");
    await expect(topbar.getByRole("link", { name: "Masuk" })).toHaveAttribute(
      "href",
      "/masuk?next=%2Fdashboard",
    );
    await expect(
      topbar.getByRole("link", { name: "Buat akun" }),
    ).toHaveAttribute("href", "/daftar?next=%2Fdashboard");

    const navigation = page.locator(".prototype-sidebar-nav");
    await expect(
      navigation.getByRole("link", { name: "Dashboard" }),
    ).toHaveAttribute("aria-current", "page");

    for (const [label, href] of SIDEBAR_LINKS) {
      await expect(navigation.getByRole("link", { name: label })).toHaveAttribute(
        "href",
        href,
      );
    }

    for (const label of ["Pesan Masuk", "Pengaturan Akun"]) {
      await expect(
        navigation
          .locator(".prototype-sidebar-link.is-unavailable")
          .filter({ hasText: label }),
      ).toContainText("Segera hadir");
    }
  });

  test("keeps the mobile dashboard within the viewport and opens its drawer", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 320, height: 720 });
    await page.goto("/dashboard", { waitUntil: "networkidle" });

    for (const width of [320, 360, 375, 390, 412, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 820 });
      await expect
        .poll(() =>
          page.evaluate(
            () => document.documentElement.scrollWidth <= window.innerWidth,
          ),
        )
        .toBe(true);
    }

    await page.setViewportSize({ width: 375, height: 812 });
    const bottomNav = page.getByRole("navigation", { name: "Navigasi bawah" });
    await expect(bottomNav).toBeVisible();
    await expect(bottomNav.getByRole("link", { name: "Beranda" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    await expect(
      bottomNav.getByRole("button", { name: "Buka menu akun" }),
    ).toBeVisible();

    await page.getByRole("button", { name: "Buka navigasi" }).click();
    const drawer = page.locator(".prototype-drawer");
    await expect(drawer).toBeVisible();
    await expect(
      drawer.getByRole("link", { name: "Tamu & RSVP" }),
    ).toHaveAttribute("href", "/tamu");

    await drawer.getByRole("button", { name: "Tutup navigasi" }).click();
    await expect(drawer).toBeHidden();
  });
});
