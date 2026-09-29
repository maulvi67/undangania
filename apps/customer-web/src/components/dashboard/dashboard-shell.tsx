import Link from "next/link";
import type { ReactNode } from "react";
import { Drawer } from "@wedding/ui";
import type { DashboardRole } from "../../lib/dashboard/contract";

type DashboardIconName =
  | "home"
  | "profile"
  | "checklist"
  | "guests"
  | "rsvp"
  | "template"
  | "edit"
  | "preview"
  | "publish"
  | "link"
  | "message"
  | "budget"
  | "orders";

type DashboardNavItem =
  | {
      kind: "link";
      label: string;
      href: string;
      icon: DashboardIconName;
      current?: boolean;
    }
  | {
      kind: "unavailable";
      label: string;
      icon: DashboardIconName;
      availability: string;
    };

type DashboardNavGroup = {
  label: string | null;
  items: readonly DashboardNavItem[];
};

export function dashboardNavigation(
  role?: DashboardRole,
): readonly DashboardNavGroup[] {
  const groups: DashboardNavGroup[] = [
    {
      label: null,
      items: [
        {
          kind: "link",
          label: "Beranda",
          href: "/dashboard",
          icon: "home",
          current: true,
        },
      ],
    },
    {
      label: "Pernikahan",
      items: [
        {
          kind: "link",
          label: "Profil pernikahan",
          href: "/mulai",
          icon: "profile",
        },
        {
          kind: "link",
          label: "Checklist",
          href: "/dashboard#checklist",
          icon: "checklist",
        },
      ],
    },
    {
      label: "Tamu",
      items: [
        {
          kind: "link",
          label: "Daftar tamu",
          href: "/tamu",
          icon: "guests",
        },
        { kind: "link", label: "RSVP", href: "/rsvp", icon: "rsvp" },
      ],
    },
    {
      label: "Undangan digital",
      items: [
        {
          kind: "link",
          label: "Pilih template",
          href: "/templates",
          icon: "template",
        },
        {
          kind: "link",
          label: "Kustomisasi",
          href: "/editor",
          icon: "edit",
        },
        {
          kind: "link",
          label: "Pratinjau",
          href: "/editor",
          icon: "preview",
        },
        {
          kind: "link",
          label: "Terbitkan",
          href: "/editor#ed-readiness-title",
          icon: "publish",
        },
      ],
    },
    {
      label: "Distribusi",
      items: [
        {
          kind: "link",
          label: "Tautan tamu",
          href: "/tamu?link=ACTIVE",
          icon: "link",
        },
        {
          kind: "unavailable",
          label: "Berbagi WhatsApp",
          icon: "message",
          availability: "Segera hadir",
        },
      ],
    },
    {
      label: "Keuangan",
      items: [
        {
          kind: "unavailable",
          label: "Anggaran",
          icon: "budget",
          availability: "Segera hadir",
        },
      ],
    },
  ];

  if (role === "OWNER") {
    groups.push({
      label: "Akun & tagihan",
      items: [
        {
          kind: "link",
          label: "Riwayat pesanan",
          href: "/pesanan",
          icon: "orders",
        },
      ],
    });
  }

  return groups;
}

function NavigationIcon({ name }: { name: DashboardIconName }) {
  const paths: Record<DashboardIconName, ReactNode> = {
    home: <path d="m3.5 10 8.5-7 8.5 7v10.5h-6v-6h-5v6h-6z" />,
    profile: (
      <>
        <circle cx="12" cy="8" r="3.25" />
        <path d="M4.5 20a7.5 7.5 0 0 1 15 0" />
      </>
    ),
    checklist: (
      <>
        <path d="m4 7 1.5 1.5L8 6M11 7h9M4 14l1.5 1.5L8 13M11 14h9M4 21l1.5 1.5L8 20M11 21h9" />
      </>
    ),
    guests: (
      <>
        <circle cx="9" cy="8" r="3" />
        <path d="M3.5 20a5.5 5.5 0 0 1 11 0M16 5.5a3 3 0 0 1 0 5.8M17.5 14a5 5 0 0 1 3 4.5" />
      </>
    ),
    rsvp: (
      <>
        <path d="M4 5.5h16v11H9l-5 3z" />
        <path d="m8 11 2.5 2.5L16 8" />
      </>
    ),
    template: (
      <>
        <rect x="4" y="3.5" width="16" height="17" rx="1.5" />
        <path d="M8 8h8M8 12h5M8 16h8" />
      </>
    ),
    edit: (
      <>
        <path d="M4 20h4l11-11a2.1 2.1 0 0 0-4-4L4 16z" />
        <path d="m13.5 6.5 4 4" />
      </>
    ),
    preview: (
      <>
        <path d="M2.5 12s3.4-6 9.5-6 9.5 6 9.5 6-3.4 6-9.5 6-9.5-6-9.5-6z" />
        <circle cx="12" cy="12" r="2.5" />
      </>
    ),
    publish: (
      <>
        <path d="M12 16V3M7.5 7.5 12 3l4.5 4.5M4 14v6h16v-6" />
      </>
    ),
    link: (
      <>
        <path d="M10 13.5 8.5 15a4 4 0 0 1-5.5-5.8l3-3a4 4 0 0 1 5.7 0M14 10.5l1.5-1.5a4 4 0 0 1 5.5 5.8l-3 3a4 4 0 0 1-5.7 0M8.5 12h7" />
      </>
    ),
    message: (
      <>
        <path d="M4 5.5h16v11H9l-5 3z" />
        <path d="M8 10h8M8 13.5h5" />
      </>
    ),
    budget: (
      <>
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <path d="M3 9h18M16 14h2" />
      </>
    ),
    orders: (
      <>
        <path d="M6 3.5h12v17l-2-1.5-2 1.5-2-1.5-2 1.5-2-1.5-2 1.5z" />
        <path d="M9 8h6M9 12h6M9 16h3" />
      </>
    ),
  };

  return (
    <svg
      className="dsh-nav__icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {paths[name]}
    </svg>
  );
}

function DashboardNavigation({ role }: { role: DashboardRole | undefined }) {
  const groups = dashboardNavigation(role);

  return (
    <nav className="dsh-nav" aria-label="Menu workspace">
      {groups.map((group, index) => (
        <div className="dsh-nav__group" key={group.label ?? `utama-${index}`}>
          {group.label !== null ? (
            <p className="dsh-nav__heading">{group.label}</p>
          ) : null}
          <ul className="dsh-nav__list">
            {group.items.map((item) => (
              <li className="dsh-nav__item" key={item.label}>
                {item.kind === "link" ? (
                  <Link
                    className="dsh-nav__link"
                    href={item.href}
                    aria-current={item.current ? "page" : undefined}
                  >
                    <NavigationIcon name={item.icon} />
                    <span className="dsh-nav__label">{item.label}</span>
                  </Link>
                ) : (
                  <span className="dsh-nav__link dsh-nav__link--unavailable">
                    <NavigationIcon name={item.icon} />
                    <span className="dsh-nav__label">{item.label}</span>
                    <span className="dsh-nav__availability">
                      {item.availability}
                    </span>
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );
}

function Brand() {
  return (
    <Link className="dsh-brand" href="/dashboard">
      <span className="dsh-brand__mark" aria-hidden="true">
        U
      </span>
      <span className="dsh-brand__copy">
        <span className="dsh-brand__name">Undangania</span>
        <span className="dsh-brand__caption">Ruang persiapan Anda</span>
      </span>
    </Link>
  );
}

function RoleCaption({ role }: { role: DashboardRole | undefined }) {
  if (role === undefined) return null;
  return (
    <p className="dsh-role">
      <span className="dsh-role__dot" aria-hidden="true" />
      {role === "OWNER" ? "Pemilik workspace" : "Editor workspace"}
    </p>
  );
}

export function DashboardShell({
  children,
  role,
  coupleNames,
}: {
  children: ReactNode;
  role?: DashboardRole;
  coupleNames?: string | null;
}) {
  const workspaceName = coupleNames ?? "Workspace pernikahan";

  return (
    <div className="dsh-shell">
      <a className="ui-skip-link" href="#konten-utama">
        Langsung ke konten utama
      </a>

      <aside className="dsh-sidebar" aria-label="Navigasi dashboard">
        <Brand />
        <div className="dsh-workspace">
          <p className="dsh-workspace__eyebrow">Workspace Anda</p>
          <p className="dsh-workspace__name">{workspaceName}</p>
        </div>
        <DashboardNavigation role={role} />
        <div className="dsh-sidebar__bottom">
          <RoleCaption role={role} />
          <Link className="dsh-support" href="/#faq">
            <span className="dsh-support__mark" aria-hidden="true">
              ?
            </span>
            <span>
              <span className="dsh-support__title">Butuh bantuan?</span>
              <span className="dsh-support__caption">
                Kunjungi pusat bantuan
              </span>
            </span>
          </Link>
        </div>
      </aside>

      <div className="dsh-main-column">
        <header className="dsh-mobile-header">
          <Brand />
          <Drawer
            triggerLabel="Menu"
            triggerVariant="secondary"
            title="Menu workspace"
            side="left"
          >
            <div className="dsh-mobile-drawer">
              <div className="dsh-workspace dsh-workspace--drawer">
                <p className="dsh-workspace__eyebrow">Workspace Anda</p>
                <p className="dsh-workspace__name">{workspaceName}</p>
              </div>
              <DashboardNavigation role={role} />
              <RoleCaption role={role} />
              <Link className="dsh-support" href="/#faq">
                <span className="dsh-support__mark" aria-hidden="true">
                  ?
                </span>
                <span>
                  <span className="dsh-support__title">Butuh bantuan?</span>
                  <span className="dsh-support__caption">
                    Kunjungi pusat bantuan
                  </span>
                </span>
              </Link>
            </div>
          </Drawer>
        </header>

        <main className="dsh-main" id="konten-utama">
          <div className="dsh-main__inner">{children}</div>
        </main>

        <footer className="dsh-footer">
          <p>Persiapan pernikahan, satu langkah setiap kali.</p>
          <Link href="/#faq">Pusat bantuan</Link>
        </footer>
      </div>
    </div>
  );
}
