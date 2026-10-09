# Daftar URL Aplikasi Customer dan Admin

Dokumen ini mendaftar seluruh route yang tersedia pada aplikasi web MVP Undangania:

- `apps/customer-web` — aplikasi customer: marketing, katalog template, checkout, editor undangan, tamu, RSVP, buku tamu.
- `apps/admin-dashboard` — konsol operasi internal untuk role `ADMIN`.

Cara menjalankan aplikasi dan port lokal dijelaskan di `LOCAL_SETUP_TESTING_GUIDE.md` bagian 10. Ringkasnya:

```bash
npm run dev -w @wedding/customer-web -- --port 3000
npm run dev -w @wedding/admin-dashboard -- --port 3001
```

Semua route memakai data asli dari database; tidak ada data dummy. Halaman yang memerlukan login akan menampilkan ajakan masuk (bukan data contoh) bila sesi belum ada.

## Customer web (`apps/customer-web`)

### Halaman publik

| URL | Keterangan | Query parameter |
| --- | --- | --- |
| `/` | Landing page marketing | — |
| `/templates` | Katalog template undangan | `q` (kata kunci, maks 100), `kategori` (maks 40), `harga` (`sederhana`, `klasik-detail`, `eksklusif`), `urutkan` (`terbaru` default, `harga-terendah`, `harga-tertinggi`) |
| `/templates/{id}` | Detail template | ID tersedia: `seruni-klasik`, `nara-modern`, `kenanga-tradisi` |
| `/templates/{id}/demo` | Demo undangan tanpa login | ID yang sama seperti di atas |
| `/demo` | Redirect ke `/templates/seruni-klasik/demo` | — |
| `/invite/{slug}` | Undangan publik milik customer | `g={token}` tautan tamu personal, `guestbookCursor` paginasi buku tamu |
| `/masuk` | Halaman masuk | `next=` tujuan setelah masuk, `oauth=` pesan error OAuth |
| `/daftar` | Halaman registrasi | — |
| `/lupa-sandi` | Permintaan tautan reset kata sandi | — |
| `/reset-sandi` | Reset kata sandi | `token=` token dari email |
| `/verifikasi` | Verifikasi email (token dikonsumsi saat dibuka) | `token=` token dari email |
| `/sesi-berakhir` | Halaman sesi berakhir | — |

### Halaman yang memerlukan login

| URL | Keterangan | Query parameter |
| --- | --- | --- |
| `/dashboard` | Dashboard customer | — |
| `/mulai` | Alur mulai persiapan undangan | — |
| `/editor` | Editor undangan | — |
| `/tamu` | Daftar tamu | `q`, `tag`, `event`, `link` (`ACTIVE`/`DISABLED`), `sort` (`name` default, `updated`, `pax-desc`, `pax-asc`) |
| `/tamu/baru` | Form tambah tamu | — |
| `/tamu/impor` | Impor tamu dari CSV | — |
| `/tamu/{householdId}` | Detail rumah tangga tamu | ID rumah tangga dari daftar tamu |
| `/rsvp` | Daftar RSVP | — |
| `/buku-tamu` | Moderasi buku tamu | — |
| `/pesanan` | Riwayat pesanan | — |
| `/checkout` | Checkout pembelian template | `template={id}` (wajib), `state=` state desain (mis. `provider-unavailable`, `offline`) |
| `/checkout/status` | Status pembayaran pesanan | `order={nomorPesanan}` |

### API

| Endpoint | Keterangan |
| --- | --- |
| `GET /api/health` | Health check |
| `POST /api/editor` | API editor undangan |
| `GET /api/auth/google` | Mulai OAuth Google |
| `GET /api/auth/google/callback` | Callback OAuth Google |

## Admin dashboard (`apps/admin-dashboard`)

| URL | Keterangan |
| --- | --- |
| `GET /` | Konsol operasi admin. Memerlukan cookie sesi `ws_session` dengan user `ACTIVE` dan membership role `ADMIN`; tanpa itu halaman menampilkan status akses ditolak beserta tautan ke `/masuk`. |
| `GET /masuk` | Halaman login admin (email + password saja). Membuat sesi `ws_session` setelah kredensial dan membership `ADMIN` terbukti, lalu mengarahkan ke `/` (parameter `?next=` divalidasi dan hanya boleh menuju `/`). |
| `GET /api/health` | Health check |
| `POST /api/admin/mutations` | Endpoint mutasi admin (butuh sesi, role, MFA step-up, dan idempotency key). |

Section di dalam konsol (anchor pada `/`):

| Anchor | Bagian |
| --- | --- |
| `#ringkasan` | Ringkasan operasi / antrian perhatian |
| `#pembayaran` | Rekonsiliasi pembayaran |
| `#publikasi` | Kegagalan publikasi |
| `#template` | Status template |
| `#dukungan` | Kasus dukungan |
| `#pekerjaan-gagal` | Pekerjaan gagal (background jobs) |
| `#audit` | Akses audit |
| `#pengecualian` | Pengecualian lifecycle |
| `#pesanan-cetak` | Status pesanan cetak |

## Catatan

- Dua aplikasi Next.js memakai port `3000` secara default; jalankan dengan `--port` eksplisit bila dijalankan bersamaan.
- Konsol admin memakai login email + password di `/masuk`. Buat akun admin lokal dengan `npm run admin:create -w @wedding/database -- --email <email> --password <min-8-karakter>` (lihat `LOCAL_SETUP_TESTING_GUIDE.md` §8). Akses konsol hanya memerlukan sesi `ADMIN`; mutasi tetap memerlukan MFA step-up saat eksekusi. Pembuatan akun admin termasuk perubahan berisiko tinggi dan memerlukan persetujuan manusia.
- `?state=` pada `/checkout` hanya memilih state desain untuk keperluan tampilan; ia tidak pernah memilih state pembayaran berbayar.
- Keluar (logout) tidak memakai route tersendiri. Customer memakai server action `signOutAction` (menu akun di top bar dan tombol di dasar sidebar) yang merevoke sesi lalu mengarahkan ke `/masuk`; admin memakai `adminSignOutAction` (popover konteks akses di toolbar) dengan perilaku sama menuju `/masuk`. Revocation bersifat best-effort — cookie sesi selalu dihapus meski database sedang tidak tersedia.
