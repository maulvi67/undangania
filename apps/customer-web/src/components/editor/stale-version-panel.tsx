import { Button } from "@wedding/ui";
import type { StaleConflict } from "../../lib/editor/stale-merge";

export function StaleVersionPanel({
  conflicts,
  onKeepLocal,
  onUseServer,
  onDiscardLocal,
}: {
  conflicts: ReadonlyArray<StaleConflict>;
  onKeepLocal: (key: StaleConflict["key"]) => void;
  onUseServer: (key: StaleConflict["key"]) => void;
  onDiscardLocal: () => void;
}) {
  return (
    <section className="ed-conflict" aria-labelledby="ed-conflict-title">
      <div>
        <p className="ed-panel__eyebrow">Perlu keputusan Anda</p>
        <h2 id="ed-conflict-title">Draf berubah di tempat lain</h2>
        <p>
          Versi terbaru dari server tidak boleh ditimpa otomatis. Pilih versi
          untuk setiap bagian yang berbeda.
        </p>
      </div>
      <div className="ed-conflict__actions">
        <Button variant="secondary" size="sm" onClick={onDiscardLocal}>
          Gunakan versi terbaru untuk semua
        </Button>
      </div>
      {conflicts.length > 0 ? (
        <ul className="ed-conflict__list">
          {conflicts.map((conflict) => (
            <li key={conflict.key} className="ed-conflict__item">
              <div>
                <strong>{conflict.label}</strong>
                <p>
                  Bagian ini memiliki perubahan di perangkat Anda dan versi
                  terbaru.
                </p>
              </div>
              <div className="ed-conflict__item-actions">
                <Button
                  variant="tertiary"
                  size="sm"
                  onClick={() => onKeepLocal(conflict.key)}
                >
                  Pertahankan versi saya
                </Button>
                <Button
                  variant="tertiary"
                  size="sm"
                  onClick={() => onUseServer(conflict.key)}
                >
                  Gunakan versi terbaru
                </Button>
              </div>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
