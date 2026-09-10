import { Skeleton } from "@wedding/ui";

export default function TemplateDetailLoading() {
  return (
    <div className="ui-shell">
      <main id="konten-utama" tabIndex={-1}>
        <div className="ui-container tpl-page" aria-busy="true">
          <Skeleton width="12rem" height="1rem" />
          <div className="tpl-page__preview-col">
            <Skeleton width="6rem" height="2rem" />
            <Skeleton className="tpl-device__frame" width="100%" height="auto" />
          </div>
          <div className="tpl-info">
            <Skeleton width="8rem" height="0.875rem" />
            <Skeleton width="60%" height="2.5rem" />
            <Skeleton width="100%" height="1.125rem" />
            <Skeleton width="100%" height="6rem" />
            <Skeleton width="100%" height="4rem" />
          </div>
        </div>
      </main>
    </div>
  );
}
