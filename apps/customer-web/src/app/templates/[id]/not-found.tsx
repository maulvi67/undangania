import { LinkButton } from "../../../components/marketing/link-button";

/** Recovery for unknown or retired templates. Never reveals why. */
export default function TemplateNotFound() {
  return (
    <div className="ui-shell">
      <main id="konten-utama" tabIndex={-1}>
        <div className="ui-container tpl-page">
          <div className="tpl-notfound">
            <p className="tpl-info__eyebrow">Desain tidak tersedia</p>
            <h1 className="tpl-info__title">Desain ini tidak ditemukan</h1>
            <p className="tpl-info__character">
              Desain yang Anda cari mungkin telah dipensiunkan dari koleksi.
              Silakan jelajahi koleksi desain lain yang tersedia.
            </p>
            <div className="tpl-ctas">
              <LinkButton href="/templates" variant="primary">
                Lihat katalog desain
              </LinkButton>
              <LinkButton href="/" variant="tertiary">
                Kembali ke halaman utama
              </LinkButton>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
