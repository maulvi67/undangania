import { IconCheck } from "@wedding/ui";
import { LinkButton } from "./link-button";

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
      <div className="ui-container lnd-split">
        <header className="lnd-split__head lnd-head">
          <p className="lnd-eyebrow">Kepercayaan</p>
          <h2 className="lnd-head__title" id="kepercayaan-title">
            Transparansi yang bisa Anda periksa sendiri
          </h2>
          <p className="lnd-lede">
            Kami tidak memakai angka, ulasan, atau testimoni yang tidak bisa
            diverifikasi. Sebagai gantinya, berikut komitmen yang bisa Anda cek
            langsung.
          </p>
        </header>
        <div className="lnd-panel">
          <ul className="lnd-panel__list">
            {TRUST_ITEMS.map((item) => (
              <li key={item.title} className="lnd-panel__row">
                <IconCheck className="lnd-panel__mark" />
                <span>
                  <span className="lnd-panel__label">{item.title}</span>
                  <span className="lnd-panel__body">{item.body}</span>
                </span>
              </li>
            ))}
          </ul>
          <p className="lnd-section__tail">
            <LinkButton href="/demo" variant="secondary" size="sm">
              Buka demo undangan lengkap
            </LinkButton>
          </p>
        </div>
      </div>
    </section>
  );
}
