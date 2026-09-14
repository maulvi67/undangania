import Link from "next/link";

export default function PublicInvitationNotFound() {
  return (
    <main className="gld-not-found">
      <p className="gld-kicker">Undangan digital</p>
      <h1>Undangan tidak ditemukan</h1>
      <p>Tautan ini mungkin belum aktif atau sudah tidak tersedia.</p>
      <Link className="gld-button" href="/">
        Kembali ke Wedding System
      </Link>
    </main>
  );
}
