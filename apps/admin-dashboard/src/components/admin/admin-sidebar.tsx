import Link from "next/link";

const NAV_ITEMS = [
  { href: "#ringkasan", label: "Ringkasan" },
  { href: "#pembayaran", label: "Pembayaran" },
  { href: "#pekerjaan-gagal", label: "Pekerjaan gagal" },
  { href: "#publikasi", label: "Publikasi" },
  { href: "#pesanan-cetak", label: "Pesanan cetak" },
  { href: "#dukungan", label: "Dukungan" },
  { href: "#template", label: "Template" },
  { href: "#pengecualian", label: "Pengecualian lifecycle" },
  { href: "#audit", label: "Audit" },
] as const;

function NavigationList() {
  return (
    <ul className="admin-sidebar__list">
      {NAV_ITEMS.map((item, index) => (
        <li key={item.href}>
          <Link
            className={
              index === 0
                ? "admin-sidebar__link admin-sidebar__link--current"
                : "admin-sidebar__link"
            }
            href={item.href}
            aria-current={index === 0 ? "page" : undefined}
          >
            <span className="admin-sidebar__index" aria-hidden="true">
              {String(index + 1).padStart(2, "0")}
            </span>
            {item.label}
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function AdminSidebar() {
  return (
    <>
      <nav className="admin-sidebar" aria-label="Navigasi operasi">
        <p className="admin-sidebar__eyebrow">Workspace internal</p>
        <NavigationList />
        <p className="admin-sidebar__note">
          Data pelanggan ditampilkan seperlunya dan tetap disamarkan.
        </p>
      </nav>
      <details className="admin-mobile-nav">
        <summary>Menu operasi</summary>
        <nav aria-label="Navigasi operasi mobile">
          <NavigationList />
        </nav>
      </details>
    </>
  );
}
