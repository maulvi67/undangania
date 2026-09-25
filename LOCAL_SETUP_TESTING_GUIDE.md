# Panduan Menjalankan, Menguji, dan Memvalidasi Codebase Secara Lokal

Dokumen ini menjelaskan cara menyiapkan, menjalankan, menguji, dan memvalidasi `wedding-system-agentic-codebase` pada komputer lokal. Codebase adalah production-oriented skeleton, bukan aplikasi bisnis yang sudah selesai. Beberapa modul masih berupa kontrak, interface, dan placeholder yang harus diimplementasikan melalui task terkontrol.

## 1. Prasyarat

Gunakan versi minimum berikut:

- Node.js 20 atau lebih baru
- npm 10 atau lebih baru
- Git
- Docker Desktop atau Docker Engine dengan Compose
- Browser Chromium/Chrome
- Opsional: Claude Code untuk workflow agentic

Verifikasi:

```bash
node --version
npm --version
git --version
docker --version
docker compose version
```

Jika menggunakan Claude Code:

```bash
claude --version
```

## 2. Ekstrak dan buka repository

```bash
unzip wedding-system-agentic-codebase.zip
cd wedding-system-agentic-codebase
```

Periksa struktur utama:

```bash
ls -la
find apps services packages docs .agents .skills .ai -maxdepth 2 -type d | sort
```

Sebelum melakukan perubahan, baca:

```text
README.md
AGENTS.md
CLAUDE.md
PROJECT_CONTEXT.md
CODEBASE_MAP.md
DEVELOPMENT_GUIDE.md
```

## 3. Buat branch lokal

```bash
git init
git add .
git commit -m "chore: initialize wedding system codebase"
git branch -M main
git checkout -b develop
```

Untuk task baru:

```bash
git checkout -b feature/WS-001-foundation
```

## 4. Konfigurasi environment

Salin environment contoh:

```bash
cp .env.example .env
```

Nilai `.env.example` ditujukan untuk development lokal. Jangan menggunakan credential production.

Konfigurasi utama:

```dotenv
NODE_ENV=development
APP_URL=http://localhost:3000
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/wedding
DIRECT_URL=postgresql://postgres:postgres@localhost:5432/wedding
AUTH_SECRET=replace-with-a-local-random-secret
REDIS_URL=redis://localhost:6379
STORAGE_ENDPOINT=http://localhost:9000
STORAGE_BUCKET=wedding-local
STORAGE_ACCESS_KEY_ID=minio
STORAGE_SECRET_ACCESS_KEY=minio-secret
PAYMENT_PROVIDER=mock
EMAIL_PROVIDER=console
WHATSAPP_PROVIDER=console
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318
```

Untuk menguji Google OAuth secara lokal, buat OAuth client bertipe web di Google
Cloud dan daftarkan URI callback persis:

```dotenv
GOOGLE_CLIENT_ID=<client-id>
GOOGLE_CLIENT_SECRET=<server-only-client-secret>
GOOGLE_OAUTH_REDIRECT_URI=http://localhost:3000/api/auth/google/callback
```

Simpan secret hanya di `.env` lokal atau secret manager. Jangan gunakan variabel
`NEXT_PUBLIC_*` untuk client secret. Panduan konfigurasi dan batas akun ada di
`docs/security/google-oauth.md`. Migration OAuth bersifat additive dan belum
dijalankan; jangan jalankan pada staging atau production tanpa persetujuan
pemilik database serta backup terverifikasi.

Buat secret lokal acak:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Masukkan hasilnya ke `AUTH_SECRET` pada `.env`.

## 5. Menjalankan dependency infrastruktur lokal

Codebase menyediakan Docker Compose untuk:

- PostgreSQL pada port `5432`
- Redis pada port `6379`
- MinIO API pada port `9000`
- MinIO Console pada port `9001`
- Mailpit SMTP pada port `1025`
- Mailpit UI pada port `8025`

Jalankan:

```bash
docker compose up -d
```

Periksa container:

```bash
docker compose ps
```

Periksa log jika ada container gagal:

```bash
docker compose logs postgres
docker compose logs redis
docker compose logs minio
docker compose logs mailpit
```

Uji PostgreSQL:

```bash
docker compose exec postgres pg_isready -U postgres -d wedding
```

Uji Redis:

```bash
docker compose exec redis redis-cli ping
```

Hasil yang diharapkan:

```text
PONG
```

Buka layanan lokal:

```text
MinIO Console: http://localhost:9001
Mailpit UI:     http://localhost:8025
```

Gunakan kredensial MinIO dari `docker-compose.yml` hanya untuk development.

## 6. Instal dependency npm

Jalankan dari root repository:

```bash
npm install
```

Untuk instalasi deterministik setelah `package-lock.json` tersedia:

```bash
npm ci
```

Periksa workspace:

```bash
npm query .workspace
```

Periksa dependency bermasalah:

```bash
npm ls --all
```

Jika `npm ls --all` menampilkan optional peer dependency warning, bedakan warning dari error yang benar-benar memblokir build.

## 7. Validasi struktur repository sebelum build

Jalankan validator bawaan:

```bash
npm run validate:repo
```

Validator memeriksa:

- Dokumen dan file agentic wajib
- Struktur agent dan skill utama
- Seluruh file JSON dapat diparse
- Referensi workspace internal

Jalankan secret scan sederhana:

```bash
sh scripts/check-secrets.sh
```

Periksa file kosong:

```bash
find . -type f -empty \
  -not -path './node_modules/*' \
  -not -path './.git/*'
```

Output ideal tidak menampilkan file apa pun.

## 8. Menyiapkan database Prisma

Generate Prisma Client:

```bash
npm run db:generate
```

Validasi schema:

```bash
npm run db:validate
```

Format schema:

```bash
npx prisma format --schema packages/database/prisma/schema.prisma
```

Buat migration development pertama:

```bash
npm run db:migrate:dev -- --name init
```

Jika forwarding argument workspace tidak bekerja pada versi npm lokal, gunakan:

```bash
npm run migrate:dev -w @wedding/database -- --name init
```

Jangan menjalankan:

```text
prisma migrate reset
prisma db push --accept-data-loss
```

kecuali database disposable lokal, task secara eksplisit meminta tindakan tersebut, dan risiko sudah dipahami.

Periksa status migration:

```bash
npx prisma migrate status --schema packages/database/prisma/schema.prisma
```

Buka Prisma Studio untuk inspeksi manual:

```bash
npx prisma studio --schema packages/database/prisma/schema.prisma
```

## 9. Menyiapkan MinIO bucket

Masuk ke:

```text
http://localhost:9001
```

Buat bucket:

```text
wedding-local
```

Rekomendasi:

- Bucket tetap private
- Upload menggunakan signed URL
- Jangan mengaktifkan anonymous public write
- Gunakan object prefix berbasis tenant dan wedding

Contoh convention:

```text
tenants/{tenantId}/weddings/{weddingId}/media/{assetId}/original
```

## 10. Menjalankan aplikasi

Untuk menjalankan seluruh workspace yang memiliki script `dev`:

```bash
npm run dev
```

Untuk menjalankan satu aplikasi:

```bash
npm run dev -w @wedding/customer-web
npm run dev -w @wedding/admin-dashboard
```

Backend API skeleton:

```bash
npm run build -w @wedding/backend-api
node apps/backend-api/dist/server.js
```

Jika menjalankan backend langsung melalui TypeScript saat development, tambahkan runner yang disetujui seperti `tsx` melalui task terpisah. Jangan menambah dependency hanya untuk menghindari build tanpa review.

Endpoint health backend:

```bash
curl http://localhost:4000/health
```

Hasil:

```json
{"status":"ok"}
```

### Port aplikasi

Next.js memilih port `3000` secara default. Karena dua aplikasi tidak dapat menggunakan port yang sama, jalankan dengan port eksplisit ketika bersamaan:

```bash
npm run dev -w @wedding/customer-web -- --port 3000
npm run dev -w @wedding/admin-dashboard -- --port 3001
```

Rekomendasi lokal:

```text
Customer Web:     http://localhost:3000
Admin Dashboard:  http://localhost:3001
Backend API:      http://localhost:4000
Mailpit:          http://localhost:8025
MinIO Console:    http://localhost:9001
```

## 11. Quality gate dasar

Jalankan bertahap agar error mudah dilokalisasi:

```bash
npm run format:check
npm run lint
npm run typecheck
npm test
npm run build
```

Kemudian jalankan agregat:

```bash
npm run ci
```

### Urutan diagnosis

Jika quality gate gagal, perbaiki dalam urutan:

1. Instalasi dependency
2. Format
3. Syntax dan lint
4. TypeScript
5. Unit test
6. Integration test
7. Build
8. E2E
9. Accessibility dan visual checks

Jangan menonaktifkan rule, menggunakan `any`, menghapus test, atau menambah suppression hanya supaya pipeline hijau.

## 12. Unit test

Jalankan semua unit test:

```bash
npm test
```

Satu workspace:

```bash
npm test -w @wedding/domain
npm test -w @wedding/contracts
npm test -w @wedding/template-engine
```

Mode watch untuk workspace jika script tersedia:

```bash
npx vitest --watch
```

Unit test wajib mencakup:

- Money dan currency consistency
- Order total dan promotion rules
- RSVP pax dan deadline
- Invitation publication transition
- Printing proof gate
- Subscription transition
- Notification idempotency
- AI fact-preservation rule

## 13. Integration test

Jalankan:

```bash
npm run test:integration
```

Sebelum integration test, pastikan PostgreSQL dan Redis hidup:

```bash
docker compose ps
```

Integration test harus menggunakan database khusus, misalnya:

```dotenv
TEST_DATABASE_URL=postgresql://postgres:postgres@localhost:5432/wedding_test
```

Buat database test:

```bash
docker compose exec postgres createdb -U postgres wedding_test
```

Jangan menjalankan integration test terhadap database development utama atau production.

Coverage integration utama:

- Transaction dan rollback
- Tenant scoped repository
- Cross-tenant denial
- Publication snapshot
- Outbox atomicity
- Payment duplicate/out-of-order webhook
- RSVP concurrent update
- Printing status transition
- Notification retry dan suppression

## 14. End-to-end test dengan Playwright

Install browser:

```bash
npx playwright install --with-deps
```

Jalankan aplikasi dan backend terlebih dahulu, lalu:

```bash
npm run test:e2e
```

Jalankan satu browser:

```bash
npx playwright test --project=chromium
```

Jalankan mobile project:

```bash
npx playwright test --project=mobile
```

Jalankan dengan UI:

```bash
npx playwright test --ui
```

Lihat report:

```bash
npx playwright show-report
```

Critical journeys yang harus ditambahkan sebelum MVP release:

1. Browse template → checkout → payment test callback → entitlement
2. Create wedding → configure event → edit invitation → publish
3. Import household → open personalized link → RSVP
4. Submit and moderate guestbook
5. Create printing order → approve proof → production → shipment
6. Queue WhatsApp notification → process callback
7. Add custom domain → verify → activate

## 15. Accessibility test

Jalankan tag accessibility:

```bash
npm run test:a11y
```

Validasi manual wajib:

- Keyboard-only navigation
- Visible focus
- Heading hierarchy
- Form labels dan error association
- Dialog focus trap dan restore
- Icon-only control accessible name
- Color contrast
- Touch target mobile
- Reduced motion
- Public invitation tetap terbaca saat JavaScript gagal

Automated test membantu menemukan masalah, tetapi tidak menggantikan verifikasi manual.

## 16. Responsive dan browser compatibility

Viewport minimum:

```text
375 × 812
390 × 844
768 × 1024
1440 × 900
```

Browser minimum:

```text
Chromium
Firefox
WebKit
```

Periksa:

- Horizontal overflow
- Long couple names
- Multi-event invitation
- Missing optional sections
- Large gallery
- Slow image loading
- Keyboard and touch behavior
- Date/time locale Indonesia
- Layout shift
- Console errors

## 17. Validasi database dan multi-tenant

Setiap repository dan use case tenant-bound harus diuji menggunakan minimal dua tenant:

```text
Tenant A / Wedding A
Tenant B / Wedding B
```

Negative test wajib:

- User Tenant A membaca Wedding B
- User Tenant A mengubah Guest B
- Token Guest A digunakan pada slug Wedding B
- Vendor A mengubah Printing Order Vendor B
- Admin tanpa elevated permission mengekspor data tenant
- Payment event untuk Order A diterapkan ke Order B

Periksa indeks dan query plan setelah query nyata tersedia:

```sql
EXPLAIN (ANALYZE, BUFFERS)
SELECT ...;
```

Jangan menambah indeks tanpa pola query dan bukti.

## 18. Validasi payment lokal

Gunakan provider `mock` atau sandbox. Jangan memakai production key.

Skenario wajib:

- Payment success
- Payment pending
- Payment failed
- Expired transaction
- Invalid signature
- Duplicate event
- Out-of-order event
- Amount/currency mismatch
- Paid but entitlement creation initially fails
- Reconciliation repairs mismatch
- Refund and duplicate refund

Payment redirect browser tidak boleh menjadi sumber kebenaran. Hanya callback yang terverifikasi atau reconciliation yang boleh mengubah status final.

## 19. Validasi WhatsApp dan email

### Email

Dengan provider development, arahkan SMTP ke Mailpit. Buka:

```text
http://localhost:8025
```

Periksa:

- Subject dan recipient
- Template variables
- Idempotency
- Retry
- No sensitive data in logs
- Suppression handling

### WhatsApp

Gunakan adapter `console` atau provider sandbox.

Periksa:

- Consent dan message category
- Approved template code
- Recipient normalization
- Queue, retry, callback, and suppression
- Duplicate delivery protection
- Cost/usage ledger tanpa menyimpan isi sensitif di analytics

## 20. Validasi template engine

Sebelum template dapat dianggap production-ready:

- Source original atau lisensi komersial telah diverifikasi
- Manifest dan contract version valid
- Canonical `InvitationViewModel` valid
- Tidak ada arbitrary JavaScript/CSS dari pelanggan
- Renderer tidak mengakses database, payment, atau session
- Normal, long-content, missing-optional, multi-event, id-ID, dan reduced-motion fixtures tersedia
- Visual regression di mobile/tablet/desktop
- Asset license dan size budget terdokumentasi
- Accessibility dan performance review lulus

Template riset pihak ketiga tidak boleh masuk package production.

## 21. Validasi background worker dan outbox

Periksa setiap job memiliki:

```text
id
job type
payload version
tenant ID bila relevan
idempotency key
attempt count
correlation ID
```

Test wajib:

- Job sukses
- Job gagal sementara lalu retry
- Job gagal permanen ke DLQ
- Duplicate delivery
- Worker restart
- Outbox event tertunda
- Provider timeout
- PII tidak muncul di log

## 22. Validasi observability

Untuk setiap critical journey, pastikan tersedia:

- Correlation ID
- Trace antar request, use case, database, outbox, worker, provider
- Structured log
- Metric success/failure/duration
- Alert untuk failure penting
- Runbook link

Jangan memasukkan ke telemetry:

```text
Password
Session cookie
Guest token
Email/phone mentah
Guestbook message
Gift account
Alamat lengkap
Raw payment payload
AI prompt berisi data pribadi
```

## 23. Menggunakan AI agents secara lokal

Mulai Claude Code dari root:

```bash
claude
```

Prompt pembuka:

```text
Read AGENTS.md, PROJECT_CONTEXT.md, CODEBASE_MAP.md,
the active task in .ai/tasks, and only the relevant domain documents.

Use the understand-codebase, impact-analysis, and implementation-plan skills.
Do not modify files until the plan and high-risk approvals are complete.
Use npm only. Do not access production credentials or deploy production.
```

Buat task:

```bash
node scripts/create-task.mjs WS-001
```

Isi task pada:

```text
.ai/tasks/WS-001.md
```

Setelah implementasi, gunakan reviewer yang relevan dan isi:

```text
.ai/handoffs/HANDOFF_TEMPLATE.md
.ai/reports/VALIDATION_CHECKLIST.md
```

## 24. Validasi permission agent

Periksa `.ai/AGENT_SKILL_MAP.csv` dan `.ai/PERMISSIONS.md`.

Uji bahwa:

- Reviewer tidak dapat menulis source
- Frontend agent tidak mengubah database
- Database agent tidak mengubah UI
- Payment agent tidak memiliki production secret
- DevOps agent tidak melakukan production apply
- Orchestrator hanya mengubah coordination artifacts
- High-risk task meminta human approval

## 25. Final validation sebelum pull request

Jalankan:

```bash
npm run validate:repo
sh scripts/check-secrets.sh
npm run format:check
npm run lint
npm run typecheck
npm test
npm run test:integration
npm run build
npm run test:e2e
npm run test:a11y
```

Periksa Git diff:

```bash
git status
git diff --stat
git diff --check
```

Periksa accidental files:

```bash
git ls-files | grep -E '(^|/)(\.env|node_modules|coverage|playwright-report|test-results)(/|$)' || true
```

Periksa migration:

```bash
npm run db:validate
npx prisma migrate status --schema packages/database/prisma/schema.prisma
```

## 26. Kriteria validasi lokal berhasil

Repository dianggap lolos local validation apabila:

- Infrastruktur Docker sehat
- Dependency terinstal tanpa error yang memblokir
- Repository validator lulus
- Schema Prisma valid
- Migration development dapat diterapkan pada database disposable
- Format, lint, dan typecheck lulus
- Unit dan integration tests lulus
- Build seluruh workspace lulus
- E2E critical journey lulus pada browser wajib
- Accessibility checks dan verifikasi manual lulus
- Cross-tenant negative tests lulus
- Payment/notification/provider failure tests lulus
- Tidak ada secret atau data pelanggan dalam repository
- Dokumentasi, changelog, task, dan handoff diperbarui
- Migration, deployment, dan rollback plan tersedia untuk perubahan berisiko

## 27. Troubleshooting

### Port telah digunakan

```bash
lsof -i :3000
lsof -i :5432
lsof -i :6379
```

Hentikan proses yang salah atau gunakan port lain.

### PostgreSQL belum siap

```bash
docker compose restart postgres
docker compose logs -f postgres
```

### Prisma tidak membaca `.env`

Jalankan dari root repository dan pastikan `DATABASE_URL` tersedia:

```bash
set -a
. ./.env
set +a
npm run db:validate
```

Pada PowerShell:

```powershell
Get-Content .env | ForEach-Object {
  if ($_ -match '^(.*?)=(.*)$') { Set-Item -Path "Env:$($matches[1])" -Value $matches[2] }
}
```

### Workspace package tidak ditemukan

```bash
rm -rf node_modules package-lock.json
npm install
npm query .workspace
```

Jangan menghapus `package-lock.json` pada branch bersama tanpa memahami perubahan dependency yang dihasilkan.

### Turborepo tidak menjalankan task tertentu

Pastikan package workspace mempunyai script dengan nama yang sama. Turborepo hanya menjalankan task yang tersedia pada package tersebut.

### Playwright tidak menemukan browser

```bash
npx playwright install --with-deps
```

### Build gagal karena skeleton belum lengkap

Buka task foundation terpisah. Jangan menyamarkan kegagalan. Catat missing dependency, compiler error, atau contract mismatch; implementasikan secara kecil, tambahkan test, lalu ulangi gate.

## 28. Membersihkan environment lokal

Hentikan container tanpa menghapus data:

```bash
docker compose down
```

Hapus container dan volume development:

```bash
docker compose down -v
```

Perintah `-v` menghapus database dan object-storage lokal. Gunakan hanya jika data memang disposable.

Bersihkan build artifacts:

```bash
rm -rf .turbo
find apps packages services -type d -name .next -prune -exec rm -rf {} +
find apps packages services -type d -name dist -prune -exec rm -rf {} +
rm -rf coverage playwright-report test-results
```

## 29. Urutan yang direkomendasikan pada hari pertama

```text
1. Ekstrak ZIP
2. Baca AGENTS dan project context
3. Salin .env
4. Jalankan Docker Compose
5. npm install
6. npm run validate:repo
7. npm run db:generate
8. npm run db:validate
9. Buat development migration
10. Jalankan customer web
11. Jalankan health check backend
12. Jalankan format/lint/typecheck/test/build
13. Buat task foundation untuk error yang ditemukan
14. Isi handoff dan validation checklist
```

## 30. Catatan status skeleton

Repository menyediakan arsitektur, contracts, schema awal, agents, skills, workflows, tests, CI, dan operational documentation. Repository belum menjamin seluruh workspace langsung selesai sebagai aplikasi bisnis tanpa implementasi lanjutan. Setiap failure pertama setelah `npm install` harus diperlakukan sebagai foundation task yang dapat direproduksi, bukan ditutupi. Target awal adalah membuat baseline build hijau sebelum menambah fitur produk.
