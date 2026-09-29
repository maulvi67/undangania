import { describe, expect, it } from "vitest";
import { dashboardNavigation } from "./dashboard-shell";

function flatten(role: "OWNER" | "EDITOR") {
  return dashboardNavigation(role).flatMap((group) => group.items);
}

describe("customer dashboard navigation", () => {
  it("maps supported menu items to existing workspace flows", () => {
    const items = flatten("OWNER");
    const linkFor = (label: string) =>
      items.find((item) => item.label === label && item.kind === "link");

    expect(linkFor("Beranda")).toMatchObject({ href: "/dashboard" });
    expect(linkFor("Profil pernikahan")).toMatchObject({ href: "/mulai" });
    expect(linkFor("Checklist")).toMatchObject({
      href: "/dashboard#checklist",
    });
    expect(linkFor("Daftar tamu")).toMatchObject({ href: "/tamu" });
    expect(linkFor("RSVP")).toMatchObject({ href: "/rsvp" });
    expect(linkFor("Pilih template")).toMatchObject({ href: "/templates" });
    expect(linkFor("Kustomisasi")).toMatchObject({ href: "/editor" });
    expect(linkFor("Pratinjau")).toMatchObject({ href: "/editor" });
    expect(linkFor("Terbitkan")).toMatchObject({
      href: "/editor#ed-readiness-title",
    });
    expect(linkFor("Tautan tamu")).toMatchObject({
      href: "/tamu?link=ACTIVE",
    });
    expect(linkFor("Riwayat pesanan")).toMatchObject({ href: "/pesanan" });
  });

  it("marks unsupported flows honestly instead of linking to empty pages", () => {
    const items = flatten("OWNER");
    expect(items.find((item) => item.label === "Anggaran")).toMatchObject({
      kind: "unavailable",
      availability: "Segera hadir",
    });
    expect(
      items.find((item) => item.label === "Berbagi WhatsApp"),
    ).toMatchObject({ kind: "unavailable", availability: "Segera hadir" });
  });

  it("hides billing navigation from editors", () => {
    expect(
      flatten("EDITOR").some(
        (item) => item.kind === "link" && item.href === "/pesanan",
      ),
    ).toBe(false);
    expect(
      flatten("OWNER").some(
        (item) => item.kind === "link" && item.href === "/pesanan",
      ),
    ).toBe(true);
  });
});
