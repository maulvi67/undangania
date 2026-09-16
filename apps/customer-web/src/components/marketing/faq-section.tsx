import { IconChevronDown } from "@wedding/ui";
import { LinkButton } from "./link-button";
import { INVITATION_ACTIVE_PERIOD } from "./pricing-explanation";

const FAQ_ITEMS = [
  {
    q: "Apakah semua desain punya fitur yang sama?",
    a: "Ya. Setiap desain dilengkapi fitur inti yang sama: halaman acara, RSVP, buku tamu, galeri foto, informasi kado, dan manajemen tamu. Perbedaan antar desain hanya pada karakter visualnya.",
  },
  {
    q: "Mengapa harga antar desain berbeda?",
    a: "Harga mencerminkan kompleksitas visual, aset, dan lisensi desain — bukan kelengkapan fitur. Desain yang lebih sederhana bekerja sama baiknya dengan yang paling detail.",
  },
  {
    q: "Berapa lama undangan saya aktif?",
    a: INVITATION_ACTIVE_PERIOD,
  },
  {
    q: "Apakah saya perlu keahlian desain?",
    a: "Tidak perlu. Editor terpandu menuntun Anda mengisi setiap bagian, dan Anda dapat melihat hasilnya sebelum dipublikasikan.",
  },
  {
    q: "Bisakah saya mencoba dulu tanpa membuat akun?",
    a: "Ya. Buka demo undangan lengkap untuk melihat hasil akhir dari sudut pandang tamu.",
  },
  {
    q: "Bagaimana cara membagikan undangan ke tamu?",
    a: "Setelah dipublikasikan, undangan memiliki tautan yang dapat Anda bagikan kepada keluarga dan tamu.",
  },
] as const;

const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: FAQ_ITEMS.map((item) => ({
    "@type": "Question",
    name: item.q,
    acceptedAnswer: { "@type": "Answer", text: item.a },
  })),
};

export function FaqSection() {
  return (
    <section
      className="lnd-section lnd-stagger-host"
      aria-labelledby="faq-title"
      id="faq"
    >
      <div className="ui-container lnd-split lnd-stagger">
        <header className="lnd-split__head lnd-head">
          <p className="lnd-eyebrow">Bantuan</p>
          <h2 className="lnd-head__title" id="faq-title">
            Pertanyaan umum
          </h2>
          <p className="lnd-lede">
            Pertanyaan yang paling sering muncul sebelum pasangan memilih
            desain.
          </p>
          <p className="lnd-faq__aside">
            Belum menemukan jawabannya? Buka demo undangan lengkap untuk melihat
            sendiri cara kerjanya.
          </p>
          <LinkButton href="/demo" variant="secondary" size="sm">
            Buka demo undangan
          </LinkButton>
        </header>
        <div className="lnd-faq lnd-cascade">
          {FAQ_ITEMS.map((item) => (
            <details key={item.q} className="lnd-faq__item">
              <summary className="lnd-faq__question">
                <span>{item.q}</span>
                <IconChevronDown className="lnd-faq__chevron" />
              </summary>
              <p className="lnd-faq__answer">{item.a}</p>
            </details>
          ))}
        </div>
      </div>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
    </section>
  );
}
