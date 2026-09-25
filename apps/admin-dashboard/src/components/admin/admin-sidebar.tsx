import Link from "next/link";
import {
  IconAlert,
  IconCheck,
  IconInbox,
  IconInfo,
  IconShield,
} from "@wedding/ui";

type NavigationItem = {
  label: string;
  href?: string;
  available: boolean;
  icon: "alert" | "check" | "inbox" | "info" | "shield";
};

type NavigationGroup = {
  label: string;
  items: readonly NavigationItem[];
};

const available = (
  label: string,
  href: string,
  icon: NavigationItem["icon"],
): NavigationItem => ({ label, href, available: true, icon });
const planned = (
  label: string,
  icon: NavigationItem["icon"] = "info",
): NavigationItem => ({ label, available: false, icon });

const NAVIGATION: readonly NavigationGroup[] = [
  {
    label: "Dashboard",
    items: [
      available("Platform overview", "#ringkasan", "inbox"),
      available("Live activity", "#ringkasan", "info"),
      available("Operational alerts", "#ringkasan", "alert"),
    ],
  },
  {
    label: "Customers",
    items: [
      planned("All customers"),
      planned("Couples"),
      planned("Wedding planners"),
      planned("Suspended accounts"),
      planned("Customer segments"),
    ],
  },
  {
    label: "Weddings",
    items: [
      planned("All weddings"),
      planned("Active weddings"),
      planned("Upcoming weddings"),
      planned("Completed weddings"),
      planned("Archived weddings"),
      planned("Wedding details"),
    ],
  },
  {
    label: "Digital invitations",
    items: [
      planned("Invitation projects"),
      available("Template library", "#template", "check"),
      planned("Template categories"),
      planned("Template builder"),
      available("Template versions", "#publikasi", "info"),
      planned("Custom domains"),
      planned("Invitation analytics"),
      available("Moderation queue", "#template", "shield"),
    ],
  },
  {
    label: "Orders & payments",
    items: [
      planned("All orders"),
      available("Transactions", "#pembayaran", "check"),
      available("Payment attempts", "#pembayaran", "info"),
      available("Pending payments", "#pembayaran", "info"),
      available("Failed payments", "#pembayaran", "alert"),
      planned("Refunds"),
      planned("Invoices"),
      planned("Promo codes"),
      planned("Payment settings"),
    ],
  },
  {
    label: "Subscriptions & plans",
    items: [
      planned("Plans"),
      planned("Active subscriptions"),
      planned("Expiring subscriptions"),
      planned("Feature entitlements"),
      planned("Usage limits"),
      planned("Plan comparison"),
    ],
  },
  {
    label: "Vendors",
    items: [
      planned("All vendors"),
      planned("Vendor categories"),
      planned("Vendor applications"),
      planned("Verified vendors"),
      planned("Vendor packages"),
      planned("Vendor reviews"),
      planned("Commissions"),
      planned("Vendor payouts"),
    ],
  },
  {
    label: "Content management",
    items: [
      planned("Landing pages"),
      planned("Blog & articles"),
      planned("FAQs"),
      planned("Email templates"),
      planned("WhatsApp templates"),
      planned("Notification templates"),
      planned("Terms & policies"),
      planned("Media library"),
    ],
  },
  {
    label: "Customer support",
    items: [
      available("Support tickets", "#dukungan", "info"),
      available("Open tickets", "#dukungan", "info"),
      planned("Assigned to me"),
      planned("Complaints"),
      planned("Refund requests"),
      planned("Customer conversations"),
      planned("Help center"),
    ],
  },
  {
    label: "Reports & analytics",
    items: [
      planned("Revenue report"),
      planned("Customer growth"),
      planned("Wedding statistics"),
      planned("Invitation performance"),
      planned("Template performance"),
      planned("RSVP statistics"),
      planned("Vendor performance"),
      planned("Payment conversion"),
      planned("Export center"),
    ],
  },
  {
    label: "System management",
    items: [
      planned("Administrators"),
      planned("Roles & permissions"),
      planned("Feature flags"),
      planned("Integrations"),
      planned("Webhooks"),
      available("Background jobs", "#pekerjaan-gagal", "alert"),
      planned("Scheduled tasks"),
      available("Audit logs", "#audit", "shield"),
      planned("Error logs"),
      planned("System health"),
    ],
  },
  {
    label: "Configuration",
    items: [
      planned("General settings"),
      planned("Branding"),
      planned("Localization"),
      planned("Currency & taxes"),
      planned("Payment gateways"),
      planned("Email configuration"),
      planned("Storage configuration"),
      planned("Security settings"),
      planned("Maintenance mode"),
    ],
  },
];

function NavigationIcon({ icon }: { icon: NavigationItem["icon"] }) {
  if (icon === "alert") return <IconAlert className="size-4" aria-hidden="true" />;
  if (icon === "check") return <IconCheck className="size-4" aria-hidden="true" />;
  if (icon === "info") return <IconInfo className="size-4" aria-hidden="true" />;
  if (icon === "shield") return <IconShield className="size-4" aria-hidden="true" />;
  return <IconInbox className="size-4" aria-hidden="true" />;
}

function NavigationList() {
  return (
    <div className="admin-nav-list">
      {NAVIGATION.map((group) => {
        const openByDefault =
          group.label === "Dashboard" ||
          group.label === "Orders & payments" ||
          group.label === "System management";

        return (
          <details className="admin-nav-group" key={group.label} open={openByDefault}>
            <summary className="admin-nav-group__summary">
              <span>{group.label}</span>
              <span className="admin-nav-group__chevron" aria-hidden="true">
                +
              </span>
            </summary>
            <ul className="admin-nav-group__items">
              {group.items.map((item) => (
                <li key={item.label}>
                  {item.available && item.href ? (
                    <Link className="admin-nav-link" href={item.href}>
                      <span className="admin-nav-link__icon">
                        <NavigationIcon icon={item.icon} />
                      </span>
                      <span className="min-w-0 truncate">{item.label}</span>
                    </Link>
                  ) : (
                    <span className="admin-nav-link admin-nav-link--disabled" aria-disabled="true" title="Modul belum tersedia">
                      <span className="admin-nav-link__icon">
                        <NavigationIcon icon={item.icon} />
                      </span>
                      <span className="min-w-0 truncate">{item.label}</span>
                      <span className="admin-nav-link__soon">Segera</span>
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </details>
        );
      })}
    </div>
  );
}

export function AdminSidebar({ mobile = false }: { mobile?: boolean }) {
  if (mobile) {
    return (
      <details className="admin-mobile-nav">
        <summary>
          <span className="admin-mobile-nav__dot" aria-hidden="true" />
          <span>Buka menu admin</span>
          <span className="admin-nav-group__chevron" aria-hidden="true">+</span>
        </summary>
        <nav className="admin-mobile-nav__content" aria-label="Navigasi admin mobile">
          <NavigationList />
        </nav>
      </details>
    );
  }

  return (
    <nav className="admin-sidebar" aria-label="Navigasi admin">
      <div className="admin-sidebar__intro">
        <span className="admin-sidebar__eyebrow">Workspace internal</span>
        <span className="admin-sidebar__hint">Operasi platform</span>
      </div>
      <NavigationList />
      <p className="admin-sidebar__privacy">Data pelanggan ditampilkan seperlunya dan tetap disamarkan.</p>
    </nav>
  );
}
