const VALUE_PROPS = [
  {
    title: "Tanpa keahlian desain",
    body: "Editor terpandu menuntun Anda mengisi setiap bagian undangan. Anda cukup menyiapkan data acara.",
  },
  {
    title: "Fitur inti sama di semua desain",
    body: "RSVP, buku tamu, galeri foto, dan informasi kado tersedia di setiap desain, tanpa kecuali.",
  },
  {
    title: "Siap dibagikan dalam hitungan menit",
    body: "Setelah dipublikasikan, undangan siap dibagikan kepada tamu melalui tautan.",
  },
] as const;

export function ValueProps() {
  return (
    <section className="lnd-section" aria-labelledby="nilai-title">
      <div className="ui-container">
        <header className="lnd-section__head">
          <p className="lnd-eyebrow">Nilai</p>
          <h2 className="lnd-section__title" id="nilai-title">
            Undangan yang mewakili hari bahagia Anda, tanpa membebani Anda
          </h2>
          <p className="lnd-lede">
            Kami menyiapkan bagian yang teknis; Anda tinggal fokus pada momen yang ingin Anda
            rayakan.
          </p>
        </header>
        <ul className="lnd-points">
          {VALUE_PROPS.map((item) => (
            <li key={item.title} className="lnd-point">
              <h3 className="lnd-point__title">{item.title}</h3>
              <p className="lnd-point__body">{item.body}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
