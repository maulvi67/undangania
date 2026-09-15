const STEPS = [
  {
    title: "Pilih desain",
    body: "Jelajahi koleksi dan temukan desain yang paling mewakili Anda berdua.",
  },
  {
    title: "Isi detail acara",
    body: "Masukkan nama, tanggal, dan lokasi sesuai rangkaian acara Anda.",
  },
  {
    title: "Sesuaikan dan pratinjau",
    body: "Teliti tampilan undangan dan pastikan setiap detail sudah sesuai sebelum dibagikan.",
  },
  {
    title: "Publikasikan dan bagikan",
    body: "Terbitkan undangan lalu bagikan tautannya kepada keluarga dan tamu.",
  },
] as const;

export function HowItWorks() {
  return (
    <section
      className="lnd-section"
      aria-labelledby="cara-kerja-title"
      id="cara-kerja"
    >
      <div className="ui-container">
        <header className="lnd-head">
          <p className="lnd-eyebrow">Cara kerja</p>
          <h2 className="lnd-head__title" id="cara-kerja-title">
            Cara kerjanya sederhana
          </h2>
          <p className="lnd-lede">
            Empat langkah dari memilih desain hingga undangan sampai ke tangan
            tamu Anda.
          </p>
        </header>
        <ol className="lnd-steps">
          {STEPS.map((step, index) => (
            <li key={step.title} className="lnd-step">
              <span className="lnd-step__num" aria-hidden="true">
                {String(index + 1).padStart(2, "0")}
              </span>
              <h3 className="lnd-step__title">{step.title}</h3>
              <p className="lnd-step__body">{step.body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
