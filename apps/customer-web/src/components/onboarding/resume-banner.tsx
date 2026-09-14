import { useState } from "react";
import { Button } from "@wedding/ui";

type ResumeBannerProps = {
  savedAt: number;
  /** Menutup spanduk; pengguna tetap di langkah yang dipulihkan. */
  onContinue: () => void;
  /** Menghapus draf dan memulai dari langkah 1. */
  onRestart: () => void;
};

function relativeSavedAt(savedAt: number): string {
  const minutes = Math.floor((Date.now() - savedAt) / 60_000);
  if (minutes < 1) return "baru saja";
  if (minutes < 60) return `${minutes} menit yang lalu`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} jam yang lalu`;
  return `${Math.floor(hours / 24)} hari yang lalu`;
}

/**
 * Spanduk resume (rencana §6): muncul saat draf lokal dipulihkan.
 * Awal di urutan tab, tidak pernah autofokus; konfirmasi "Mulai baru"
 * inline — bukan dialog.
 */
export function ResumeBanner({ savedAt, onContinue, onRestart }: ResumeBannerProps) {
  const [confirming, setConfirming] = useState(false);

  return (
    <section className="onb-resume" aria-label="Lanjutkan persiapan">
      <p className="onb-resume__text">
        Lanjutkan persiapan Anda — terakhir disimpan {relativeSavedAt(savedAt)}.
      </p>
      {confirming ? (
        <div className="onb-resume__confirm">
          <p className="onb-resume__warning">Mulai baru menghapus draf saat ini.</p>
          <div className="onb-resume__row">
            <Button variant="secondary" size="sm" onClick={() => setConfirming(false)}>
              Batal
            </Button>
            <Button variant="danger" size="sm" onClick={onRestart}>
              Ya, mulai baru
            </Button>
          </div>
        </div>
      ) : (
        <div className="onb-resume__row">
          <Button size="sm" onClick={onContinue}>
            Lanjutkan
          </Button>
          <Button variant="tertiary" size="sm" onClick={() => setConfirming(true)}>
            Mulai baru
          </Button>
        </div>
      )}
    </section>
  );
}
