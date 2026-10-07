import "../dashboard-app.css";

/**
 * Route-level loading state. The dashboard waits on four session-scoped reads,
 * so a first paint skeleton keeps the layout stable instead of flashing the
 * empty shell.
 */
export default function DashboardLoading() {
  return (
    <div className="prototype-app min-h-dvh">
      <div className="prototype-main-column">
        <main className="prototype-main">
          <div className="prototype-main__inner">
            <div
              className="prototype-skeleton"
              role="status"
              aria-live="polite"
              aria-busy="true"
            >
              <span className="prototype-visually-hidden">
                Memuat data undangan
              </span>
              <div className="prototype-skeleton__title" />
              <div className="prototype-skeleton__lead" />
              <div className="prototype-skeleton__grid">
                <div className="prototype-skeleton__block prototype-skeleton__block--large" />
                <div className="prototype-skeleton__block" />
                <div className="prototype-skeleton__block" />
                <div className="prototype-skeleton__block" />
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
