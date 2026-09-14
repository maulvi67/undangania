import type { GuestContext } from "../../lib/public-invitation/guest-context";

const STATE_COPY = {
  "invalid-token": {
    title: "Tautan undangan tidak dapat digunakan",
    body: "Tautan ini mungkin sudah tidak berlaku. Minta tautan undangan terbaru kepada pasangan.",
  },
  paused: {
    title: "Undangan sedang dijeda",
    body: "Konfirmasi kehadiran belum tersedia untuk sementara. Silakan coba lagi nanti.",
  },
  expired: {
    title: "Undangan sudah berakhir",
    body: "Masa aktif undangan ini telah selesai sehingga jawaban tidak dapat diperbarui.",
  },
  "rate-limited": {
    title: "Silakan coba lagi nanti",
    body: "Tautan ini sedang menerima terlalu banyak permintaan. Tidak ada data yang berubah.",
  },
  "provider-unavailable": {
    title: "Layanan sedang mengalami kendala",
    body: "Kami belum dapat memuat bagian konfirmasi. Silakan coba lagi beberapa saat lagi.",
  },
} as const;

export function GuestAccessStateMessage({
  context,
}: {
  context: GuestContext;
}) {
  if (context.state === "ready" || context.state === "locked") return null;

  if (context.state === "deadline-approaching") {
    return (
      <div className="gld-guest-alert gld-guest-alert--warning" role="status">
        <strong>Konfirmasi segera ditutup</strong>
        <span>
          Mohon kirim jawaban paling lambat{" "}
          {context.rsvpDeadlineLabel ?? "sebelum batas waktu"}.
        </span>
      </div>
    );
  }

  const copy = STATE_COPY[context.state];
  return (
    <div className="gld-guest-alert" role="status">
      <strong>{copy.title}</strong>
      <span>{copy.body}</span>
    </div>
  );
}

export function LockedRsvpMessage() {
  return (
    <div className="gld-guest-alert" role="status">
      <strong>Konfirmasi sudah ditutup</strong>
      <span>
        Jawaban yang tersimpan tetap ditampilkan, tetapi tidak dapat diubah
        lagi.
      </span>
    </div>
  );
}
