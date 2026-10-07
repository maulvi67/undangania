/**
 * Mock data for the Undangania sales-dashboard prototype.
 *
 * Everything here is local and deterministic. No network calls, no
 * `Math.random()`, and no locale-dependent formatting, so the server and client
 * renders always agree (see `groupThousands` / `formatDate` below).
 *
 * This file is a prototype fixture, not a domain model. It intentionally does
 * not import from `@wedding/*` packages.
 */

/* -------------------------------------------------------------------------- */
/* Statuses                                                                    */
/* -------------------------------------------------------------------------- */

export type PaymentStatus =
  "Belum Dibayar" | "Menunggu Konfirmasi" | "Lunas" | "Gagal" | "Dikembalikan";

export type OrderStatus =
  | "Baru"
  | "Menunggu Data"
  | "Diproses"
  | "Siap Ditinjau"
  | "Selesai"
  | "Dibatalkan";

export const PAYMENT_STATUSES: readonly PaymentStatus[] = [
  "Belum Dibayar",
  "Menunggu Konfirmasi",
  "Lunas",
  "Gagal",
  "Dikembalikan",
];

export const ORDER_STATUSES: readonly OrderStatus[] = [
  "Baru",
  "Menunggu Data",
  "Diproses",
  "Siap Ditinjau",
  "Selesai",
  "Dibatalkan",
];

/* -------------------------------------------------------------------------- */
/* Formatting helpers                                                          */
/* -------------------------------------------------------------------------- */

/**
 * Groups an integer with Indonesian thousands separators (".").
 *
 * Implemented by hand rather than with `Intl.NumberFormat` so the output can
 * never differ between the Node render and the browser render.
 */
function groupThousands(value: number): string {
  return String(Math.round(Math.abs(value))).replace(
    /\B(?=(\d{3})+(?!\d))/g,
    ".",
  );
}

export function formatRupiah(value: number): string {
  return `${value < 0 ? "-" : ""}Rp${groupThousands(value)}`;
}

/** Groups a plain count with Indonesian thousands separators: `3269` → `3.269`. */
export function formatNumber(value: number): string {
  return groupThousands(value);
}

function trimDecimal(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded)
    ? String(rounded)
    : rounded.toFixed(1).replace(".", ",");
}

/** Compact currency for chart axes: "Rp25 jt", "Rp900 rb". */
export function formatCompactRupiah(value: number): string {
  if (value >= 1_000_000_000) {
    return `Rp${trimDecimal(value / 1_000_000_000)} M`;
  }
  if (value >= 1_000_000) {
    return `Rp${trimDecimal(value / 1_000_000)} jt`;
  }
  if (value >= 1_000) {
    return `Rp${trimDecimal(value / 1_000)} rb`;
  }
  return `Rp${groupThousands(value)}`;
}

const MONTHS_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "Mei",
  "Jun",
  "Jul",
  "Agu",
  "Sep",
  "Okt",
  "Nov",
  "Des",
];

/** Formats an ISO date (`2026-09-28`) as `28 Sep 2026` without using `Date`. */
export function formatDate(isoDate: string): string {
  const year = isoDate.slice(0, 4);
  const month = Number(isoDate.slice(5, 7));
  const day = Number(isoDate.slice(8, 10));
  const monthLabel = MONTHS_SHORT[month - 1] ?? "";
  return `${day} ${monthLabel} ${year}`;
}

/* -------------------------------------------------------------------------- */
/* Orders                                                                      */
/* -------------------------------------------------------------------------- */

export type Order = {
  id: string;
  customer: string;
  phone: string;
  /** Nama acara, mis. "Andi & Siska". */
  event: string;
  /** Tanggal acara pernikahan (ISO). */
  eventDate: string;
  template: string;
  /** Tanggal pesanan dibuat (ISO). */
  date: string;
  total: number;
  payment: PaymentStatus;
  status: OrderStatus;
};

export const ORDERS: Order[] = [
  {
    id: "#1028",
    customer: "Andi Pratama",
    phone: "0812-1188-2043",
    event: "Andi & Siska",
    eventDate: "2026-11-14",
    template: "Elegant Blush",
    date: "2026-09-28",
    total: 149000,
    payment: "Lunas",
    status: "Selesai",
  },
  {
    id: "#1027",
    customer: "Budi Santoso",
    phone: "0813-2244-7810",
    event: "Budi & Rina",
    eventDate: "2026-11-21",
    template: "Minimalist Love",
    date: "2026-09-27",
    total: 199000,
    payment: "Lunas",
    status: "Diproses",
  },
  {
    id: "#1026",
    customer: "Citra Lestari",
    phone: "0857-3390-1176",
    event: "Citra & Dimas",
    eventDate: "2026-12-05",
    template: "Rustic Garden",
    date: "2026-09-26",
    total: 149000,
    payment: "Menunggu Konfirmasi",
    status: "Menunggu Data",
  },
  {
    id: "#1025",
    customer: "Dewi Anggraini",
    phone: "0812-7745-3320",
    event: "Dewi & Fajar",
    eventDate: "2026-11-08",
    template: "Golden Heritage",
    date: "2026-09-25",
    total: 249000,
    payment: "Lunas",
    status: "Siap Ditinjau",
  },
  {
    id: "#1024",
    customer: "Eko Nugroho",
    phone: "0821-4412-9987",
    event: "Eko & Ayu",
    eventDate: "2026-12-12",
    template: "Javanese Classic",
    date: "2026-09-24",
    total: 279000,
    payment: "Menunggu Konfirmasi",
    status: "Baru",
  },
  {
    id: "#1023",
    customer: "Fitri Handayani",
    phone: "0838-6620-4415",
    event: "Fitri & Raka",
    eventDate: "2026-12-19",
    template: "Floral Romance",
    date: "2026-09-23",
    total: 179000,
    payment: "Belum Dibayar",
    status: "Baru",
  },
  {
    id: "#1022",
    customer: "Gilang Ramadhan",
    phone: "0811-2093-7764",
    event: "Gilang & Nia",
    eventDate: "2026-10-30",
    template: "Elegant Blush",
    date: "2026-09-22",
    total: 149000,
    payment: "Lunas",
    status: "Selesai",
  },
  {
    id: "#1021",
    customer: "Hesti Wulandari",
    phone: "0856-8812-3390",
    event: "Hesti & Bayu",
    eventDate: "2026-11-27",
    template: "Minimalist Love",
    date: "2026-09-21",
    total: 199000,
    payment: "Dikembalikan",
    status: "Dibatalkan",
  },
  {
    id: "#1020",
    customer: "Irfan Maulana",
    phone: "0812-5567-8812",
    event: "Irfan & Salma",
    eventDate: "2026-10-24",
    template: "Rustic Garden",
    date: "2026-09-20",
    total: 149000,
    payment: "Lunas",
    status: "Selesai",
  },
  {
    id: "#1019",
    customer: "Jihan Aulia",
    phone: "0877-3345-1128",
    event: "Jihan & Reza",
    eventDate: "2026-11-19",
    template: "Golden Heritage",
    date: "2026-09-19",
    total: 249000,
    payment: "Lunas",
    status: "Diproses",
  },
  {
    id: "#1018",
    customer: "Kurniawan Adi",
    phone: "0813-9902-4471",
    event: "Kurniawan & Wulan",
    eventDate: "2026-12-02",
    template: "Floral Romance",
    date: "2026-09-18",
    total: 179000,
    payment: "Gagal",
    status: "Dibatalkan",
  },
  {
    id: "#1017",
    customer: "Lestari Ningsih",
    phone: "0852-6614-9903",
    event: "Lestari & Hendra",
    eventDate: "2026-11-05",
    template: "Javanese Classic",
    date: "2026-09-17",
    total: 279000,
    payment: "Lunas",
    status: "Siap Ditinjau",
  },
  {
    id: "#1016",
    customer: "Miftahul Huda",
    phone: "0819-2276-5510",
    event: "Miftah & Zahra",
    eventDate: "2026-12-26",
    template: "Elegant Blush",
    date: "2026-09-16",
    total: 149000,
    payment: "Menunggu Konfirmasi",
    status: "Menunggu Data",
  },
  {
    id: "#1015",
    customer: "Nurul Hidayah",
    phone: "0812-3390-8827",
    event: "Nurul & Fikri",
    eventDate: "2026-10-17",
    template: "Minimalist Love",
    date: "2026-09-15",
    total: 199000,
    payment: "Lunas",
    status: "Selesai",
  },
  {
    id: "#1014",
    customer: "Okta Viana",
    phone: "0838-7712-6604",
    event: "Okta & Galih",
    eventDate: "2027-01-09",
    template: "Rustic Garden",
    date: "2026-09-14",
    total: 149000,
    payment: "Belum Dibayar",
    status: "Baru",
  },
  {
    id: "#1013",
    customer: "Putra Wibowo",
    phone: "0811-6640-2278",
    event: "Putra & Intan",
    eventDate: "2026-11-28",
    template: "Golden Heritage",
    date: "2026-09-13",
    total: 249000,
    payment: "Lunas",
    status: "Diproses",
  },
  {
    id: "#1012",
    customer: "Rahmawati Sari",
    phone: "0857-2288-4413",
    event: "Rahma & Yusuf",
    eventDate: "2026-10-11",
    template: "Floral Romance",
    date: "2026-09-12",
    total: 179000,
    payment: "Lunas",
    status: "Selesai",
  },
  {
    id: "#1011",
    customer: "Sigit Prasetyo",
    phone: "0812-8877-3390",
    event: "Sigit & Melati",
    eventDate: "2026-12-08",
    template: "Javanese Classic",
    date: "2026-09-11",
    total: 279000,
    payment: "Dikembalikan",
    status: "Dibatalkan",
  },
];

/* -------------------------------------------------------------------------- */
/* Dashboard aggregates                                                        */
/* -------------------------------------------------------------------------- */

export type Kpi = {
  key: "orders" | "revenue" | "users" | "templates";
  label: string;
  value: string;
  delta: number;
  caption: string;
};

export const KPIS: Kpi[] = [
  {
    key: "orders",
    label: "Total Pesanan",
    value: "248",
    delta: 12,
    caption: "bulan ini",
  },
  {
    key: "revenue",
    label: "Pendapatan",
    value: "Rp24.560.000",
    delta: 20,
    caption: "bulan ini",
  },
  {
    key: "users",
    label: "Pengguna Aktif",
    value: "1.842",
    delta: 18,
    caption: "bulan ini",
  },
  {
    key: "templates",
    label: "Template Aktif",
    value: "56",
    delta: 7,
    caption: "bulan ini",
  },
];

export type AttentionTone = "danger" | "warning" | "info";

export type AttentionItem = {
  key: "payments" | "newOrders" | "eventData" | "messages" | "expiring";
  label: string;
  detail: string;
  count: number;
  tone: AttentionTone;
};

export const ATTENTION_ITEMS: AttentionItem[] = [
  {
    key: "payments",
    label: "Pembayaran menunggu verifikasi",
    detail: "Cek bukti transfer sebelum undangan diproses.",
    count: 5,
    tone: "warning",
  },
  {
    key: "newOrders",
    label: "Pesanan belum diproses",
    detail: "Masuk lebih dari 24 jam tanpa tindakan.",
    count: 3,
    tone: "danger",
  },
  {
    key: "eventData",
    label: "Data acara belum lengkap",
    detail: "Nama pasangan, tanggal, atau lokasi masih kosong.",
    count: 2,
    tone: "warning",
  },
  {
    key: "messages",
    label: "Pesan pelanggan belum dibalas",
    detail: "Rata-rata sudah menunggu lebih dari 3 jam.",
    count: 4,
    tone: "info",
  },
  {
    key: "expiring",
    label: "Undangan akan kedaluwarsa",
    detail: "Masa aktif kurang dari 7 hari lagi.",
    count: 2,
    tone: "danger",
  },
];

export type CategorySlice = {
  name: string;
  percent: number;
  count: number;
  color: string;
};

/** Counts sum to 248 so the donut centre matches the KPI. */
export const CATEGORIES: CategorySlice[] = [
  { name: "Modern", percent: 28, count: 69, color: "#B95363" },
  { name: "Rustic", percent: 22, count: 55, color: "#D98E8A" },
  { name: "Minimalis", percent: 18, count: 45, color: "#C9A24B" },
  { name: "Tradisional", percent: 14, count: 35, color: "#7F9C78" },
  { name: "Floral", percent: 10, count: 25, color: "#D8A6A0" },
  { name: "Lainnya", percent: 8, count: 19, color: "#CBB9B1" },
];

export const TOTAL_CATEGORY_COUNT = CATEGORIES.reduce(
  (total, slice) => total + slice.count,
  0,
);

/** Counts sum to 248 as well. */
export const ORDER_STATUS_COUNTS: { status: OrderStatus; count: number }[] = [
  { status: "Selesai", count: 168 },
  { status: "Diproses", count: 34 },
  { status: "Baru", count: 18 },
  { status: "Menunggu Data", count: 12 },
  { status: "Siap Ditinjau", count: 9 },
  { status: "Dibatalkan", count: 7 },
];

export const TOTAL_ORDER_COUNT = ORDER_STATUS_COUNTS.reduce(
  (total, entry) => total + entry.count,
  0,
);

export type PopularTemplate = {
  id: string;
  name: string;
  category: string;
  sales: number;
  rating: number;
  trend: number;
};

export const POPULAR_TEMPLATES: PopularTemplate[] = [
  {
    id: "tpl-elegant-blush",
    name: "Elegant Blush",
    category: "Modern",
    sales: 42,
    rating: 4.9,
    trend: 14,
  },
  {
    id: "tpl-rustic-garden",
    name: "Rustic Garden",
    category: "Rustic",
    sales: 36,
    rating: 4.8,
    trend: 9,
  },
  {
    id: "tpl-minimalist-love",
    name: "Minimalist Love",
    category: "Minimalis",
    sales: 29,
    rating: 4.8,
    trend: 6,
  },
  {
    id: "tpl-golden-heritage",
    name: "Golden Heritage",
    category: "Tradisional",
    sales: 24,
    rating: 4.7,
    trend: 4,
  },
  {
    id: "tpl-floral-romance",
    name: "Floral Romance",
    category: "Floral",
    sales: 18,
    rating: 4.6,
    trend: -3,
  },
  {
    id: "tpl-javanese-classic",
    name: "Javanese Classic",
    category: "Tradisional",
    sales: 13,
    rating: 4.7,
    trend: 2,
  },
];

/**
 * Thumbnails are pure CSS gradients, per the "no external assets" rule.
 */
const TEMPLATE_GRADIENTS: Record<string, string> = {
  "Elegant Blush": "linear-gradient(135deg, #E8B4BC 0%, #B95363 100%)",
  "Minimalist Love": "linear-gradient(135deg, #F5EAE6 0%, #C9A9A0 100%)",
  "Rustic Garden": "linear-gradient(135deg, #A8BFA0 0%, #5F7A5A 100%)",
  "Golden Heritage": "linear-gradient(135deg, #E3C88A 0%, #A87C36 100%)",
  "Javanese Classic": "linear-gradient(135deg, #C9A24B 0%, #6E4B2A 100%)",
  "Floral Romance": "linear-gradient(135deg, #F0C4C8 0%, #A45C74 100%)",
  "Aurora Modern": "linear-gradient(135deg, #B8C7E0 0%, #5B6B8C 100%)",
  "Tuscany Wood": "linear-gradient(135deg, #D9B79A 0%, #8C5A3C 100%)",
  "Putih Bersih": "linear-gradient(135deg, #FBF8F5 0%, #D8CBC4 100%)",
  "Sunda Heritage": "linear-gradient(135deg, #C6B38A 0%, #7A5C3A 100%)",
  "Sakura Bloom": "linear-gradient(135deg, #F7D3DC 0%, #C97C93 100%)",
  "Midnight Elegance": "linear-gradient(135deg, #4A4A63 0%, #1F1F2E 100%)",
};

const FALLBACK_GRADIENT = "linear-gradient(135deg, #E8D7D2 0%, #B95363 100%)";

export function getTemplateGradient(name: string): string {
  return TEMPLATE_GRADIENTS[name] ?? FALLBACK_GRADIENT;
}

export type ActivityTone =
  "emerald" | "amber" | "sky" | "rose" | "violet" | "stone";

export type ActivityItem = {
  id: string;
  actor: string;
  action: string;
  target: string;
  time: string;
  tone: ActivityTone;
};

export const ACTIVITIES: ActivityItem[] = [
  {
    id: "act-1",
    actor: "Maulvi",
    action: "memverifikasi pembayaran",
    target: "Pesanan #1025",
    time: "8 menit lalu",
    tone: "emerald",
  },
  {
    id: "act-2",
    actor: "Sistem",
    action: "mengirim pengingat data acara",
    target: "Pesanan #1026",
    time: "26 menit lalu",
    tone: "amber",
  },
  {
    id: "act-3",
    actor: "Dewi Anggraini",
    action: "mengunggah bukti transfer",
    target: "Pesanan #1025",
    time: "1 jam lalu",
    tone: "sky",
  },
  {
    id: "act-4",
    actor: "Maulvi",
    action: "menerbitkan undangan",
    target: "Andi & Siska",
    time: "3 jam lalu",
    tone: "rose",
  },
  {
    id: "act-5",
    actor: "Rina Kartika",
    action: "menambahkan testimoni",
    target: "Template Elegant Blush",
    time: "5 jam lalu",
    tone: "violet",
  },
  {
    id: "act-6",
    actor: "Sistem",
    action: "menutup undangan kedaluwarsa",
    target: "Pasangan #1009",
    time: "Kemarin",
    tone: "stone",
  },
];

export type NotificationTone = "amber" | "sky" | "rose" | "emerald";

export type NotificationItem = {
  id: string;
  title: string;
  detail: string;
  time: string;
  tone: NotificationTone;
  unread: boolean;
};

export const NOTIFICATIONS: NotificationItem[] = [
  {
    id: "notif-1",
    title: "5 pembayaran menunggu verifikasi",
    detail: "Transfer BCA dan Mandiri perlu dicek manual.",
    time: "12 menit lalu",
    tone: "amber",
    unread: true,
  },
  {
    id: "notif-2",
    title: "Pesanan #1024 masuk",
    detail: "Eko & Ayu memilih template Javanese Classic.",
    time: "48 menit lalu",
    tone: "sky",
    unread: true,
  },
  {
    id: "notif-3",
    title: "2 undangan akan kedaluwarsa",
    detail: "Masa aktif berakhir dalam 3 hari.",
    time: "2 jam lalu",
    tone: "rose",
    unread: true,
  },
  {
    id: "notif-4",
    title: "4 pesan pelanggan belum dibalas",
    detail: "Rata-rata sudah menunggu lebih dari 3 jam.",
    time: "5 jam lalu",
    tone: "amber",
    unread: true,
  },
  {
    id: "notif-5",
    title: "Template Golden Heritage diperbarui",
    detail: "Revisi galeri foto dan tipografi nama.",
    time: "Kemarin",
    tone: "emerald",
    unread: false,
  },
];

export type QuickActionKey =
  "template" | "order" | "verify" | "broadcast" | "report" | "message";

export type QuickAction = {
  key: QuickActionKey;
  label: string;
  description: string;
};

export const QUICK_ACTIONS: QuickAction[] = [
  {
    key: "template",
    label: "Tambah Template",
    description: "Unggah desain baru",
  },
  {
    key: "order",
    label: "Pesanan Manual",
    description: "Catat pesanan offline",
  },
  { key: "verify", label: "Verifikasi Bayar", description: "5 menunggu" },
  { key: "broadcast", label: "Kirim Promo", description: "Ke pelanggan aktif" },
  { key: "report", label: "Unduh Laporan", description: "Rekap penjualan" },
  { key: "message", label: "Balas Pesan", description: "4 belum dibalas" },
];

/* -------------------------------------------------------------------------- */
/* Sales chart series                                                          */
/* -------------------------------------------------------------------------- */

export type ChartPeriod = "7h" | "30h" | "3b" | "1t";
export type ChartMetric = "income" | "orders";

export type SalesPoint = {
  label: string;
  income: number;
  orders: number;
};

export const PERIOD_OPTIONS: {
  value: ChartPeriod;
  label: string;
  longLabel: string;
}[] = [
  { value: "7h", label: "7 Hari", longLabel: "7 hari terakhir" },
  { value: "30h", label: "30 Hari", longLabel: "30 hari terakhir" },
  { value: "3b", label: "3 Bulan", longLabel: "3 bulan terakhir" },
  { value: "1t", label: "1 Tahun", longLabel: "12 bulan terakhir" },
];

export const METRIC_OPTIONS: { value: ChartMetric; label: string }[] = [
  { value: "income", label: "Pendapatan" },
  { value: "orders", label: "Pesanan" },
];

/** Small deterministic PRNG so the series never differ between renders. */
function mulberry32(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Builds a series whose average multiplier is ~1.0, so each period's total
 * stays in the same ballpark as the matching KPI.
 */
function buildSeries(
  labels: readonly string[],
  seed: number,
  baseIncome: number,
  baseOrders: number,
): SalesPoint[] {
  const random = mulberry32(seed);
  const lastIndex = Math.max(1, labels.length - 1);
  return labels.map((label, index) => {
    const growth = 0.88 + (index / lastIndex) * 0.24;
    const jitter = 0.9 + random() * 0.2;
    const factor = growth * jitter;
    return {
      label,
      income: Math.round((baseIncome * factor) / 1000) * 1000,
      orders: Math.max(1, Math.round(baseOrders * factor)),
    };
  });
}

const LABELS_7H: readonly string[] = [
  "Sen",
  "Sel",
  "Rab",
  "Kam",
  "Jum",
  "Sab",
  "Min",
];

const LABELS_30H: readonly string[] = Array.from(
  { length: 15 },
  (_, index) => `${index * 2 + 1}-${index * 2 + 2} Sep`,
);

const LABELS_3B: readonly string[] = [
  "1 Jul",
  "8 Jul",
  "15 Jul",
  "22 Jul",
  "29 Jul",
  "5 Agu",
  "12 Agu",
  "19 Agu",
  "26 Agu",
  "2 Sep",
  "9 Sep",
  "16 Sep",
];

const LABELS_1T: readonly string[] = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "Mei",
  "Jun",
  "Jul",
  "Agu",
  "Sep",
  "Okt",
  "Nov",
  "Des",
];

export const SALES_SERIES: Record<ChartPeriod, SalesPoint[]> = {
  "7h": buildSeries(LABELS_7H, 20260101, 1_030_000, 7.7),
  "30h": buildSeries(LABELS_30H, 20260202, 1_640_000, 16.5),
  "3b": buildSeries(LABELS_3B, 20260303, 6_100_000, 62),
  "1t": buildSeries(LABELS_1T, 20260404, 24_500_000, 248),
};

/** Total for the active period, shown next to the chart toggle. */
export function sumSeries(
  series: readonly SalesPoint[],
  metric: ChartMetric,
): number {
  return series.reduce((total, point) => total + point[metric], 0);
}

/* -------------------------------------------------------------------------- */
/* Template catalog                                                            */
/* -------------------------------------------------------------------------- */

export type TemplateStatus = "Aktif" | "Draf";

export type TemplateItem = {
  id: string;
  name: string;
  category: string;
  sales: number;
  rating: number;
  price: number;
  status: TemplateStatus;
};

export const TEMPLATES: TemplateItem[] = [
  {
    id: "tpl-elegant-blush",
    name: "Elegant Blush",
    category: "Modern",
    sales: 42,
    rating: 4.9,
    price: 199000,
    status: "Aktif",
  },
  {
    id: "tpl-rustic-garden",
    name: "Rustic Garden",
    category: "Rustic",
    sales: 36,
    rating: 4.8,
    price: 179000,
    status: "Aktif",
  },
  {
    id: "tpl-minimalist-love",
    name: "Minimalist Love",
    category: "Minimalis",
    sales: 29,
    rating: 4.7,
    price: 149000,
    status: "Aktif",
  },
  {
    id: "tpl-golden-heritage",
    name: "Golden Heritage",
    category: "Lainnya",
    sales: 24,
    rating: 4.8,
    price: 249000,
    status: "Aktif",
  },
  {
    id: "tpl-floral-romance",
    name: "Floral Romance",
    category: "Floral",
    sales: 18,
    rating: 4.6,
    price: 169000,
    status: "Aktif",
  },
  {
    id: "tpl-javanese-classic",
    name: "Javanese Classic",
    category: "Tradisional",
    sales: 13,
    rating: 4.7,
    price: 229000,
    status: "Aktif",
  },
  {
    id: "tpl-aurora-modern",
    name: "Aurora Modern",
    category: "Modern",
    sales: 11,
    rating: 4.5,
    price: 189000,
    status: "Aktif",
  },
  {
    id: "tpl-tuscany-wood",
    name: "Tuscany Wood",
    category: "Rustic",
    sales: 9,
    rating: 4.4,
    price: 179000,
    status: "Aktif",
  },
  {
    id: "tpl-sakura-bloom",
    name: "Sakura Bloom",
    category: "Floral",
    sales: 7,
    rating: 4.6,
    price: 169000,
    status: "Aktif",
  },
  {
    id: "tpl-sunda-heritage",
    name: "Sunda Heritage",
    category: "Tradisional",
    sales: 6,
    rating: 4.5,
    price: 219000,
    status: "Draf",
  },
  {
    id: "tpl-putih-bersih",
    name: "Putih Bersih",
    category: "Minimalis",
    sales: 0,
    rating: 4.3,
    price: 139000,
    status: "Draf",
  },
  {
    id: "tpl-midnight-elegance",
    name: "Midnight Elegance",
    category: "Lainnya",
    sales: 4,
    rating: 4.7,
    price: 259000,
    status: "Draf",
  },
];

/* -------------------------------------------------------------------------- */
/* Customers                                                                   */
/* -------------------------------------------------------------------------- */

export type CustomerStatus = "Aktif" | "Baru" | "Nonaktif";

export type Customer = {
  id: string;
  name: string;
  phone: string;
  email: string;
  city: string;
  joinedAt: string;
  orders: number;
  totalSpent: number;
  status: CustomerStatus;
};

export const CUSTOMERS: Customer[] = [
  {
    id: "cst-1028",
    name: "Andi Pratama",
    phone: "0812-1188-2043",
    email: "andi.pratama@mail.com",
    city: "Jakarta Selatan",
    joinedAt: "2025-11-02",
    orders: 3,
    totalSpent: 547000,
    status: "Aktif",
  },
  {
    id: "cst-1027",
    name: "Budi Santoso",
    phone: "0813-2277-8890",
    email: "budi.santoso@mail.com",
    city: "Bandung",
    joinedAt: "2026-01-18",
    orders: 2,
    totalSpent: 348000,
    status: "Aktif",
  },
  {
    id: "cst-1026",
    name: "Citra Lestari",
    phone: "0857-4491-1120",
    email: "citra.lestari@mail.com",
    city: "Surabaya",
    joinedAt: "2026-02-24",
    orders: 1,
    totalSpent: 149000,
    status: "Aktif",
  },
  {
    id: "cst-1025",
    name: "Dewi Anggraini",
    phone: "0821-8834-6612",
    email: "dewi.anggraini@mail.com",
    city: "Yogyakarta",
    joinedAt: "2026-03-09",
    orders: 4,
    totalSpent: 796000,
    status: "Aktif",
  },
  {
    id: "cst-1024",
    name: "Eko Nugroho",
    phone: "0838-1122-7745",
    email: "eko.nugroho@mail.com",
    city: "Semarang",
    joinedAt: "2026-04-14",
    orders: 1,
    totalSpent: 199000,
    status: "Baru",
  },
  {
    id: "cst-1023",
    name: "Fitri Handayani",
    phone: "0812-9087-3321",
    email: "fitri.handayani@mail.com",
    city: "Medan",
    joinedAt: "2026-05-21",
    orders: 2,
    totalSpent: 398000,
    status: "Aktif",
  },
  {
    id: "cst-1022",
    name: "Gilang Ramadhan",
    phone: "0856-3344-9902",
    email: "gilang.ramadhan@mail.com",
    city: "Denpasar",
    joinedAt: "2026-06-07",
    orders: 1,
    totalSpent: 279000,
    status: "Baru",
  },
  {
    id: "cst-1021",
    name: "Hesti Wulandari",
    phone: "0878-6612-4488",
    email: "hesti.wulandari@mail.com",
    city: "Malang",
    joinedAt: "2025-08-30",
    orders: 5,
    totalSpent: 1043000,
    status: "Aktif",
  },
  {
    id: "cst-1020",
    name: "Irfan Maulana",
    phone: "0819-7788-1200",
    email: "irfan.maulana@mail.com",
    city: "Bekasi",
    joinedAt: "2026-07-11",
    orders: 1,
    totalSpent: 149000,
    status: "Baru",
  },
  {
    id: "cst-1019",
    name: "Jihan Aulia",
    phone: "0812-4455-6677",
    email: "jihan.aulia@mail.com",
    city: "Tangerang",
    joinedAt: "2025-05-16",
    orders: 2,
    totalSpent: 428000,
    status: "Nonaktif",
  },
  {
    id: "cst-1018",
    name: "Kurniawan Adi",
    phone: "0852-1199-3344",
    email: "kurniawan.adi@mail.com",
    city: "Palembang",
    joinedAt: "2026-08-02",
    orders: 1,
    totalSpent: 179000,
    status: "Baru",
  },
  {
    id: "cst-1017",
    name: "Lestari Ningsih",
    phone: "0821-6677-8899",
    email: "lestari.ningsih@mail.com",
    city: "Makassar",
    joinedAt: "2025-02-27",
    orders: 3,
    totalSpent: 627000,
    status: "Nonaktif",
  },
];

/* -------------------------------------------------------------------------- */
/* Active invitations                                                          */
/* -------------------------------------------------------------------------- */

export type InvitationStatus =
  "Aktif" | "Akan Kedaluwarsa" | "Draf" | "Kedaluwarsa";

export type Invitation = {
  id: string;
  event: string;
  customer: string;
  template: string;
  publishedAt: string;
  expiresAt: string;
  views: number;
  status: InvitationStatus;
};

export const INVITATIONS: Invitation[] = [
  {
    id: "und-2041",
    event: "Andi & Siska",
    customer: "Andi Pratama",
    template: "Elegant Blush",
    publishedAt: "2026-09-28",
    expiresAt: "2026-12-28",
    views: 486,
    status: "Aktif",
  },
  {
    id: "und-2040",
    event: "Budi & Rina",
    customer: "Budi Santoso",
    template: "Minimalist Love",
    publishedAt: "2026-09-27",
    expiresAt: "2026-10-08",
    views: 312,
    status: "Akan Kedaluwarsa",
  },
  {
    id: "und-2039",
    event: "Citra & Dimas",
    customer: "Citra Lestari",
    template: "Rustic Garden",
    publishedAt: "2026-09-26",
    expiresAt: "2027-01-26",
    views: 208,
    status: "Aktif",
  },
  {
    id: "und-2038",
    event: "Dewi & Fajar",
    customer: "Dewi Anggraini",
    template: "Golden Heritage",
    publishedAt: "2026-09-25",
    expiresAt: "2026-10-05",
    views: 654,
    status: "Akan Kedaluwarsa",
  },
  {
    id: "und-2037",
    event: "Eko & Maya",
    customer: "Eko Nugroho",
    template: "Tuscany Wood",
    publishedAt: "2026-09-24",
    expiresAt: "2027-03-24",
    views: 143,
    status: "Aktif",
  },
  {
    id: "und-2036",
    event: "Fitri & Bayu",
    customer: "Fitri Handayani",
    template: "Sakura Bloom",
    publishedAt: "2026-09-23",
    expiresAt: "2027-02-23",
    views: 271,
    status: "Aktif",
  },
  {
    id: "und-2035",
    event: "Gilang & Nadia",
    customer: "Gilang Ramadhan",
    template: "Midnight Elegance",
    publishedAt: "2026-09-22",
    expiresAt: "2026-12-22",
    views: 97,
    status: "Draf",
  },
  {
    id: "und-2034",
    event: "Hesti & Rizal",
    customer: "Hesti Wulandari",
    template: "Floral Romance",
    publishedAt: "2026-09-21",
    expiresAt: "2027-01-21",
    views: 533,
    status: "Aktif",
  },
  {
    id: "und-2033",
    event: "Irfan & Sari",
    customer: "Irfan Maulana",
    template: "Aurora Modern",
    publishedAt: "2026-09-20",
    expiresAt: "2026-09-30",
    views: 389,
    status: "Kedaluwarsa",
  },
  {
    id: "und-2032",
    event: "Jihan & Reza",
    customer: "Jihan Aulia",
    template: "Javanese Classic",
    publishedAt: "2026-09-19",
    expiresAt: "2027-04-19",
    views: 176,
    status: "Draf",
  },
];

/* -------------------------------------------------------------------------- */
/* Event data                                                                  */
/* -------------------------------------------------------------------------- */

export type EventCompleteness = "Lengkap" | "Belum Lengkap";

export type EventRecord = {
  id: string;
  orderId: string;
  event: string;
  eventDate: string;
  city: string;
  venue: string;
  template: string;
  missing: string[];
  completeness: EventCompleteness;
};

export const EVENTS: EventRecord[] = [
  {
    id: "evt-2041",
    orderId: "#1028",
    event: "Andi & Siska",
    eventDate: "2026-11-14",
    city: "Jakarta Selatan",
    venue: "Balai Kartini",
    template: "Elegant Blush",
    missing: [],
    completeness: "Lengkap",
  },
  {
    id: "evt-2040",
    orderId: "#1027",
    event: "Budi & Rina",
    eventDate: "2026-10-24",
    city: "Bandung",
    venue: "The Trans Luxury Hotel",
    template: "Minimalist Love",
    missing: ["Rangkaian acara"],
    completeness: "Belum Lengkap",
  },
  {
    id: "evt-2039",
    orderId: "#1026",
    event: "Citra & Dimas",
    eventDate: "2026-12-05",
    city: "Surabaya",
    venue: "Grand City Convex",
    template: "Rustic Garden",
    missing: [],
    completeness: "Lengkap",
  },
  {
    id: "evt-2038",
    orderId: "#1025",
    event: "Dewi & Fajar",
    eventDate: "2026-10-18",
    city: "Yogyakarta",
    venue: "Pendopo Agung Royal Ambarrukmo",
    template: "Golden Heritage",
    missing: [],
    completeness: "Lengkap",
  },
  {
    id: "evt-2037",
    orderId: "#1024",
    event: "Eko & Maya",
    eventDate: "2027-01-09",
    city: "Semarang",
    venue: "Gedung Wisma Perdamaian",
    template: "Tuscany Wood",
    missing: ["Lokasi akad", "Rangkaian acara"],
    completeness: "Belum Lengkap",
  },
  {
    id: "evt-2036",
    orderId: "#1023",
    event: "Fitri & Bayu",
    eventDate: "2026-11-29",
    city: "Medan",
    venue: "Tiara Convention Center",
    template: "Sakura Bloom",
    missing: [],
    completeness: "Lengkap",
  },
  {
    id: "evt-2035",
    orderId: "#1022",
    event: "Gilang & Nadia",
    eventDate: "2026-12-19",
    city: "Denpasar",
    venue: "The Stones Hotel Legian",
    template: "Midnight Elegance",
    missing: [],
    completeness: "Lengkap",
  },
  {
    id: "evt-2034",
    orderId: "#1021",
    event: "Hesti & Rizal",
    eventDate: "2026-10-11",
    city: "Malang",
    venue: "Ijen Suites Resort",
    template: "Floral Romance",
    missing: [],
    completeness: "Lengkap",
  },
  {
    id: "evt-2033",
    orderId: "#1020",
    event: "Irfan & Sari",
    eventDate: "2026-10-03",
    city: "Bekasi",
    venue: "Gedung Graha Insan Cita",
    template: "Aurora Modern",
    missing: [],
    completeness: "Lengkap",
  },
  {
    id: "evt-2032",
    orderId: "#1019",
    event: "Jihan & Reza",
    eventDate: "2027-02-20",
    city: "Tangerang",
    venue: "Novotel Tangerang",
    template: "Javanese Classic",
    missing: [],
    completeness: "Lengkap",
  },
];

/* -------------------------------------------------------------------------- */
/* Testimonials                                                                */
/* -------------------------------------------------------------------------- */

export type TestimonialStatus = "Terbit" | "Menunggu";

export type Testimonial = {
  id: string;
  customer: string;
  template: string;
  rating: number;
  message: string;
  date: string;
  status: TestimonialStatus;
};

export const TESTIMONIALS: Testimonial[] = [
  {
    id: "tst-501",
    customer: "Dewi Anggraini",
    template: "Golden Heritage",
    rating: 5,
    message:
      "Prosesnya cepat, tinggal kirim data acara lalu undangan langsung jadi. Tamu banyak yang memuji desainnya.",
    date: "2026-09-26",
    status: "Terbit",
  },
  {
    id: "tst-500",
    customer: "Hesti Wulandari",
    template: "Floral Romance",
    rating: 5,
    message:
      "Fitur RSVP sangat membantu menghitung tamu. Saya tidak perlu rekap manual lagi.",
    date: "2026-09-24",
    status: "Terbit",
  },
  {
    id: "tst-499",
    customer: "Budi Santoso",
    template: "Minimalist Love",
    rating: 4,
    message:
      "Desainnya bersih dan elegan. Sempat minta revisi warna sekali, dibantu sampai cocok.",
    date: "2026-09-22",
    status: "Terbit",
  },
  {
    id: "tst-498",
    customer: "Citra Lestari",
    template: "Rustic Garden",
    rating: 5,
    message:
      "Pilihan template rustic-nya paling bagus dibanding layanan lain yang pernah saya coba.",
    date: "2026-09-21",
    status: "Terbit",
  },
  {
    id: "tst-497",
    customer: "Andi Pratama",
    template: "Elegant Blush",
    rating: 5,
    message:
      "Harga terjangkau, hasilnya rapi. Galeri foto bisa diganti sendiri tanpa bantuan admin.",
    date: "2026-09-19",
    status: "Terbit",
  },
  {
    id: "tst-496",
    customer: "Fitri Handayani",
    template: "Sakura Bloom",
    rating: 4,
    message:
      "Suka musik latarnya. Semoga ke depan bisa tambah lebih banyak pilihan lagu.",
    date: "2026-09-18",
    status: "Menunggu",
  },
  {
    id: "tst-495",
    customer: "Gilang Ramadhan",
    template: "Midnight Elegance",
    rating: 5,
    message:
      "Tema gelapnya mewah sekali. Banyak tamu bertanya saya pesan undangan di mana.",
    date: "2026-09-16",
    status: "Menunggu",
  },
  {
    id: "tst-494",
    customer: "Eko Nugroho",
    template: "Tuscany Wood",
    rating: 3,
    message:
      "Undangannya bagus, hanya saja proses verifikasi pembayaran agak lama karena akhir pekan.",
    date: "2026-09-14",
    status: "Menunggu",
  },
];

/* -------------------------------------------------------------------------- */
/* Inbox messages                                                              */
/* -------------------------------------------------------------------------- */

export type MessageChannel = "WhatsApp" | "Email" | "Instagram";

export type Message = {
  id: string;
  customer: string;
  subject: string;
  preview: string;
  receivedAt: string;
  channel: MessageChannel;
  unread: boolean;
};

export const MESSAGES: Message[] = [
  {
    id: "msg-812",
    customer: "Budi Santoso",
    subject: "Ubah jadwal acara",
    preview:
      "Selamat siang, apakah tanggal acara bisa diubah dari 24 Oktober ke 7 November? Mohon info biayanya.",
    receivedAt: "28 Sep 2026 · 09:24",
    channel: "WhatsApp",
    unread: true,
  },
  {
    id: "msg-811",
    customer: "Citra Lestari",
    subject: "Tambah galeri foto",
    preview:
      "Saya ingin menambah 20 foto lagi di galeri. Apakah masih muat di paket yang sekarang?",
    receivedAt: "28 Sep 2026 · 08:47",
    channel: "WhatsApp",
    unread: true,
  },
  {
    id: "msg-810",
    customer: "Eko Nugroho",
    subject: "Bukti transfer belum diverifikasi",
    preview:
      "Saya sudah transfer sejak kemarin sore, tapi status pesanan masih menunggu konfirmasi.",
    receivedAt: "28 Sep 2026 · 07:12",
    channel: "Email",
    unread: true,
  },
  {
    id: "msg-809",
    customer: "Fitri Handayani",
    subject: "Kesalahan nama tamu",
    preview:
      "Ada salah ketik nama tamu di undangan bagian keluarga mempelai wanita, mohon dibantu.",
    receivedAt: "27 Sep 2026 · 21:05",
    channel: "WhatsApp",
    unread: true,
  },
  {
    id: "msg-808",
    customer: "Dewi Anggraini",
    subject: "Terima kasih",
    preview:
      "Undangannya sudah selesai dan sangat memuaskan. Terima kasih untuk bantuannya.",
    receivedAt: "27 Sep 2026 · 18:33",
    channel: "Instagram",
    unread: false,
  },
  {
    id: "msg-807",
    customer: "Andi Pratama",
    subject: "Minta link undangan",
    preview:
      "Boleh dikirim ulang link undangan saya? Notifikasi di ponsel terhapus.",
    receivedAt: "27 Sep 2026 · 14:10",
    channel: "WhatsApp",
    unread: false,
  },
  {
    id: "msg-806",
    customer: "Hesti Wulandari",
    subject: "Invoice untuk kantor",
    preview:
      "Mohon dibuatkan invoice atas nama perusahaan untuk keperluan reimbursement.",
    receivedAt: "26 Sep 2026 · 11:58",
    channel: "Email",
    unread: false,
  },
  {
    id: "msg-805",
    customer: "Gilang Ramadhan",
    subject: "Uji coba tema gelap",
    preview:
      "Saya ingin lihat pratinjau tema Midnight Elegance sebelum memutuskan.",
    receivedAt: "26 Sep 2026 · 09:31",
    channel: "Instagram",
    unread: false,
  },
];

/* -------------------------------------------------------------------------- */
/* Promo codes                                                                 */
/* -------------------------------------------------------------------------- */

export type PromoStatus = "Aktif" | "Berakhir" | "Draf";

export type Promo = {
  id: string;
  code: string;
  kind: "Persentase" | "Potongan";
  value: string;
  period: string;
  used: number;
  quota: number;
  status: PromoStatus;
};

export const PROMOS: Promo[] = [
  {
    id: "prm-01",
    code: "CERITAABADI20",
    kind: "Persentase",
    value: "20%",
    period: "1 - 31 Okt 2026",
    used: 64,
    quota: 100,
    status: "Aktif",
  },
  {
    id: "prm-02",
    code: "HEMAT50RB",
    kind: "Potongan",
    value: "Rp50.000",
    period: "15 Sep - 15 Okt 2026",
    used: 38,
    quota: 80,
    status: "Aktif",
  },
  {
    id: "prm-03",
    code: "PASANGANKU15",
    kind: "Persentase",
    value: "15%",
    period: "1 Nov - 31 Des 2026",
    used: 0,
    quota: 150,
    status: "Draf",
  },
  {
    id: "prm-04",
    code: "RUSTICLOVE",
    kind: "Persentase",
    value: "10%",
    period: "1 - 30 Sep 2026",
    used: 92,
    quota: 100,
    status: "Berakhir",
  },
  {
    id: "prm-05",
    code: "UNDANGANBARU",
    kind: "Potongan",
    value: "Rp25.000",
    period: "1 Agu - 30 Sep 2026",
    used: 120,
    quota: 120,
    status: "Berakhir",
  },
  {
    id: "prm-06",
    code: "RESEPSI2027",
    kind: "Persentase",
    value: "25%",
    period: "1 Jan - 28 Feb 2027",
    used: 5,
    quota: 200,
    status: "Aktif",
  },
];

/* -------------------------------------------------------------------------- */
/* Payment helpers                                                             */
/* -------------------------------------------------------------------------- */

const PAYMENT_METHODS = [
  "Transfer BCA",
  "Transfer Mandiri",
  "QRIS",
  "Virtual Account BNI",
] as const;

/** Deterministic per-order method so the value never changes between renders. */
export function getPaymentMethod(order: Order): string {
  const digits = Number(order.id.replace("#", ""));
  return PAYMENT_METHODS[digits % PAYMENT_METHODS.length] ?? "Transfer bank";
}

export function getPaymentInvoice(order: Order): string {
  return `INV-${order.id.slice(1)}`;
}

export type PaymentRow = {
  id: string;
  invoice: string;
  orderId: string;
  customer: string;
  amount: number;
  method: string;
  submittedAt: string;
  status: PaymentStatus;
};

export function buildPaymentRows(orders: readonly Order[]): PaymentRow[] {
  return orders.map((order) => ({
    id: `pay-${order.id.slice(1)}`,
    invoice: getPaymentInvoice(order),
    orderId: order.id,
    customer: order.customer,
    amount: order.total,
    method: getPaymentMethod(order),
    submittedAt: order.date,
    status: order.payment,
  }));
}
