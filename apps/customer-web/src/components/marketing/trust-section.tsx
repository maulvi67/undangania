const TRUST_ITEMS = [
  {
    title: "Coba dulu sebelum membeli",
    body: "Demo undangan lengkap dapat Anda buka tanpa perlu membuat akun.",
  },
  {
    title: "Harga tampil di muka",
    body: "Harga setiap desain tertera di katalog. Tidak ada biaya yang muncul belakangan.",
  },
  {
    title: "Fitur inti tidak dikunci",
    body: "Semua desain memiliki fitur inti yang sama; pilihan Anda murni soal selera.",
  },
  {
    title: "Data tamu adalah milik Anda",
    body: "Selama masa aktif undangan, Anda dapat mengunduh data tamu dan ucapan.",
  },
] as const;

export function TrustSection() {
  return (
    <section className="lnd-section" aria-labelledby="kepercayaan-title">
      <div className="ui-container">
        <header className="lnd-section__head">
          <p className="lnd-eyebrow">Kepercayaan</p>
          <h2 className="lnd-section__title" id="kepercayaan-title">
            Transparansi yang bisa Anda periksa sendiri
          </h2>
          <p className="lnd-lede">
            Kami tidak memakai angka atau testimoni yang tidak bisa diverifikasi. Sebagai gantinya,
            berikut komitmen yang bisa Anda cek langsung.
          </p>
        </header>
        <ul className="lnd-trust">
          {TRUST_ITEMS.map((item) => (
            <li key={item.title} className="lnd-trust__item">
              <h3 className="lnd-trust__title">{item.title}</h3>
              <p className="lnd-trust__body">{item.body}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
