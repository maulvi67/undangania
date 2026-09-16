import { IconCheck } from "@wedding/ui";

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
    <section
      className="lnd-section lnd-stagger-host"
      aria-labelledby="fitur-title"
      id="fitur"
    >
      <div className="ui-container lnd-split lnd-stagger">
        <header className="lnd-split__head lnd-head">
          <p className="lnd-eyebrow">Fitur</p>
          <h2 className="lnd-head__title" id="fitur-title">
            Semua desain termasuk fitur undangan lengkap
          </h2>
          <p className="lnd-lede">
            Setiap desain memakai inti undangan digital yang sama. Desain yang
            lebih mahal tidak menambah fitur — karakter visualnya yang berbeda.
          </p>
        </header>
        <ul className="lnd-features lnd-cascade">
          {CORE_FEATURES.map((feature) => (
            <li key={feature.title} className="lnd-feature">
              <h3 className="lnd-feature__title">
                <IconCheck className="lnd-feature__mark" />
                {feature.title}
              </h3>
              <p className="lnd-feature__body">{feature.body}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
