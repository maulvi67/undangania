const CORE_FEATURES = [
  {
    title: "Halaman acara",
    body: "Akad dan resepsi dengan tanggal, waktu, dan lokasi yang jelas.",
  },
  {
    title: "RSVP",
    body: "Tamu dapat mengonfirmasi kehadiran langsung dari undangan.",
  },
  {
    title: "Buku tamu",
    body: "Kumpulkan ucapan dan doa tamu di satu tempat.",
  },
  {
    title: "Galeri foto",
    body: "Tampilkan foto pra-pernikahan Anda dalam galeri yang rapi.",
  },
  {
    title: "Informasi kado",
    body: "Sampaikan informasi kado atau pengiriman hadiah dengan sopan.",
  },
  {
    title: "Manajemen tamu",
    body: "Atur daftar tamu dan pantau konfirmasi kehadiran mereka.",
  },
] as const;

export function CoreFeatures() {
  return (
    <section className="lnd-section" aria-labelledby="fitur-title" id="fitur">
      <div className="ui-container">
        <header className="lnd-section__head">
          <p className="lnd-eyebrow">Fitur</p>
          <h2 className="lnd-section__title" id="fitur-title">
            Semua desain termasuk fitur undangan lengkap
          </h2>
          <p className="lnd-lede">
            Setiap desain dilengkapi inti undangan digital yang sama. Desain yang lebih mahal tidak
            menambah fitur — karakter visualnya yang berbeda.
          </p>
        </header>
        <ul className="lnd-cards">
          {CORE_FEATURES.map((feature) => (
            <li key={feature.title} className="lnd-card">
              <h3 className="lnd-card__title">{feature.title}</h3>
              <p className="lnd-card__body">{feature.body}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
