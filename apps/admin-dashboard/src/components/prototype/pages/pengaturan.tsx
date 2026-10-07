"use client";

import { useState } from "react";
import { Bell, Landmark, Save, ShieldCheck } from "lucide-react";
import { usePrototype } from "../store";
import { PageHeader, ProtoButton, ProtoCard, SectionHeading } from "../ui";

/* -------------------------------------------------------------------------- */
/* Pengaturan                                                                  */
/* -------------------------------------------------------------------------- */

export function PengaturanPage() {
  const { notify } = usePrototype();

  const [profile, setProfile] = useState({
    name: "Maulvi",
    email: "maulvi@undangania.id",
    phone: "0812-9000-4417",
  });

  const [store, setStore] = useState({
    name: "Undangania",
    tagline: "Undangan Digital, Cerita Abadi",
    email: "halo@undangania.id",
    city: "Yogyakarta",
  });

  const [payment, setPayment] = useState({
    bank: "Bank Mandiri",
    account: "1370-0099-4417",
    holder: "PT Undangania Digital",
  });

  const [notifications, setNotifications] = useState({
    newOrder: true,
    payment: true,
    message: true,
    weekly: false,
  });

  const toggleNotification = (key: keyof typeof notifications) => {
    setNotifications((previous) => ({
      ...previous,
      [key]: !previous[key],
    }));
  };

  return (
    <div className="space-y-4 md:space-y-5">
      <PageHeader
        title="Pengaturan"
        description="Kelola profil admin, identitas toko, notifikasi, dan rekening penerimaan pembayaran."
        actions={
          <ProtoButton
            variant="primary"
            onClick={() => notify("Pengaturan disimpan")}
          >
            <Save className="h-4 w-4" aria-hidden="true" />
            Simpan Perubahan
          </ProtoButton>
        }
      />

      <div className="grid gap-4 md:gap-5 lg:grid-cols-2">
        {/* Profil admin ------------------------------------------------------ */}
        <ProtoCard className="p-5">
          <SectionHeading
            title="Profil Admin"
            description="Data akun yang dipakai untuk masuk ke dashboard."
          />
          <div className="mt-4 space-y-4">
            <Field
              id="proto-profile-name"
              label="Nama lengkap"
              value={profile.name}
              onChange={(value) =>
                setProfile((previous) => ({ ...previous, name: value }))
              }
              hint="Tampil pada header dan riwayat aktivitas."
            />
            <Field
              id="proto-profile-email"
              label="Email"
              type="email"
              value={profile.email}
              onChange={(value) =>
                setProfile((previous) => ({ ...previous, email: value }))
              }
            />
            <Field
              id="proto-profile-phone"
              label="Nomor WhatsApp"
              value={profile.phone}
              onChange={(value) =>
                setProfile((previous) => ({ ...previous, phone: value }))
              }
              hint="Dipakai pelanggan untuk menghubungi admin."
            />
            <div className="flex items-center gap-2 rounded-2xl border border-[var(--p-line)] bg-[var(--p-canvas)] p-3">
              <ShieldCheck
                className="h-4 w-4 shrink-0 text-[var(--p-rose-strong)]"
                aria-hidden="true"
              />
              <p className="text-[11px] text-[var(--p-ink-soft)]">
                Peran akun:{" "}
                <strong className="font-semibold text-[var(--p-ink)]">
                  Super Admin
                </strong>{" "}
                · akses penuh ke seluruh modul.
              </p>
            </div>
          </div>
        </ProtoCard>

        {/* Informasi toko --------------------------------------------------- */}
        <ProtoCard className="p-5">
          <SectionHeading
            title="Informasi Toko"
            description="Identitas Undangania yang tampil di undangan dan invoice."
          />
          <div className="mt-4 space-y-4">
            <Field
              id="proto-store-name"
              label="Nama toko"
              value={store.name}
              onChange={(value) =>
                setStore((previous) => ({ ...previous, name: value }))
              }
            />
            <Field
              id="proto-store-tagline"
              label="Tagline"
              value={store.tagline}
              onChange={(value) =>
                setStore((previous) => ({ ...previous, tagline: value }))
              }
              hint="Muncul di sidebar dan halaman publik."
            />
            <Field
              id="proto-store-email"
              label="Email publik"
              type="email"
              value={store.email}
              onChange={(value) =>
                setStore((previous) => ({ ...previous, email: value }))
              }
            />
            <Field
              id="proto-store-city"
              label="Kota operasional"
              value={store.city}
              onChange={(value) =>
                setStore((previous) => ({ ...previous, city: value }))
              }
            />
          </div>
        </ProtoCard>

        {/* Notifikasi -------------------------------------------------------- */}
        <ProtoCard className="p-5">
          <SectionHeading
            title="Notifikasi"
            description="Pilih kabar yang ingin dikirim ke email admin."
          />
          <ul className="mt-4 space-y-2">
            <ToggleRow
              label="Pesanan baru masuk"
              description="Setiap ada pesanan undangan baru."
              checked={notifications.newOrder}
              onToggle={() => toggleNotification("newOrder")}
            />
            <ToggleRow
              label="Pembayaran menunggu verifikasi"
              description="Saat pelanggan mengunggah bukti transfer."
              checked={notifications.payment}
              onToggle={() => toggleNotification("payment")}
            />
            <ToggleRow
              label="Pesan pelanggan"
              description="Pesan dari WhatsApp, email, dan Instagram."
              checked={notifications.message}
              onToggle={() => toggleNotification("message")}
            />
            <ToggleRow
              label="Ringkasan mingguan"
              description="Rekap penjualan setiap Senin pagi."
              checked={notifications.weekly}
              onToggle={() => toggleNotification("weekly")}
            />
          </ul>
        </ProtoCard>

        {/* Rekening ---------------------------------------------------------- */}
        <ProtoCard className="p-5">
          <SectionHeading
            title="Rekening Pembayaran"
            description="Rekening yang ditampilkan ke pelanggan saat checkout."
          />
          <div className="mt-4 space-y-4">
            <Field
              id="proto-bank-name"
              label="Bank"
              value={payment.bank}
              onChange={(value) =>
                setPayment((previous) => ({ ...previous, bank: value }))
              }
            />
            <Field
              id="proto-bank-account"
              label="Nomor rekening"
              value={payment.account}
              onChange={(value) =>
                setPayment((previous) => ({ ...previous, account: value }))
              }
              hint="Periksa kembali sebelum menyimpan."
            />
            <Field
              id="proto-bank-holder"
              label="Atas nama"
              value={payment.holder}
              onChange={(value) =>
                setPayment((previous) => ({ ...previous, holder: value }))
              }
            />
            <div className="flex items-start gap-2 rounded-2xl border border-[var(--p-line)] bg-[var(--p-canvas)] p-3">
              <Landmark
                className="mt-0.5 h-4 w-4 shrink-0 text-[var(--p-rose-strong)]"
                aria-hidden="true"
              />
              <p className="text-[11px] text-[var(--p-ink-soft)]">
                Perubahan rekening adalah tindakan sensitif dan memerlukan
                verifikasi ulang oleh pemilik akun.
              </p>
            </div>
          </div>
        </ProtoCard>
      </div>

      <p className="flex items-center gap-1.5 px-1 text-[11px] text-[var(--p-ink-soft)]">
        <Bell className="h-3.5 w-3.5" aria-hidden="true" />
        Prototype ini menyimpan pengaturan hanya di memori dan tidak mengirim
        data ke server.
      </p>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Local form primitives                                                       */
/* -------------------------------------------------------------------------- */

function Field({
  id,
  label,
  value,
  onChange,
  hint,
  type = "text",
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  hint?: string | undefined;
  type?: "text" | "email";
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label
        htmlFor={id}
        className="text-[11px] font-semibold text-[var(--p-ink-soft)]"
      >
        {label}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-10 w-full rounded-xl border border-[var(--p-line)] bg-white px-3 text-[13px] text-[var(--p-ink)] outline-none focus:border-[var(--p-rose)]"
      />
      {hint ? (
        <p className="text-[11px] text-[var(--p-ink-soft)]">{hint}</p>
      ) : null}
    </div>
  );
}

function ToggleRow({
  label,
  description,
  checked,
  onToggle,
}: {
  label: string;
  description: string;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={onToggle}
        className="flex w-full items-center gap-3 rounded-2xl border border-[var(--p-line)] p-3 text-left transition hover:bg-[var(--p-rose-soft)]/50"
      >
        <span className="min-w-0 flex-1">
          <span className="block text-[13px] font-semibold text-[var(--p-ink)]">
            {label}
          </span>
          <span className="block text-[11px] text-[var(--p-ink-soft)]">
            {description}
          </span>
        </span>
        <span
          aria-hidden="true"
          className={
            checked
              ? "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full bg-[var(--p-rose)] transition"
              : "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full bg-[#DCCFCB] transition"
          }
        >
          <span
            className={
              checked
                ? "absolute left-[24px] h-[18px] w-[18px] rounded-full bg-white shadow transition-all"
                : "absolute left-[3px] h-[18px] w-[18px] rounded-full bg-white shadow transition-all"
            }
          />
        </span>
      </button>
    </li>
  );
}
