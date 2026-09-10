import { Skeleton } from "@wedding/ui";
import "../catalog.css";

/** Route-level loading UI for full-page GET navigations between queries. */
export default function CatalogLoading() {
  return (
    <div className="ui-shell">
      <main id="konten-utama" tabIndex={-1}>
        <div className="ui-container ctlg-page">
          <span className="ui-visually-hidden" role="status">
            Memuat katalog desain…
          </span>
          <header className="ctlg-header" aria-hidden="true">
            <Skeleton height="2.5rem" width="70%" />
            <Skeleton height="1rem" width="90%" />
          </header>
          <Skeleton className="ctlg-skeleton-search" height="3.5rem" />
          <ul className="ctlg-grid">
            {Array.from({ length: 6 }, (_, index) => (
              <li className="ctlg-card ctlg-card--skeleton" key={index} aria-hidden="true">
                <Skeleton className="ctlg-card__preview" />
                <div className="ctlg-card__body">
                  <Skeleton height="0.75rem" width="40%" />
                  <Skeleton height="1.25rem" width="60%" />
                  <Skeleton height="0.75rem" width="90%" />
                  <Skeleton height="1rem" width="50%" />
                </div>
              </li>
            ))}
          </ul>
        </div>
      </main>
    </div>
  );
}
