import { Skeleton } from "@wedding/ui";
import "./admin.css";

export default function AdminLoading() {
  return (
    <main className="admin-loading" role="status" aria-live="polite">
      <span className="ui-visually-hidden">Memuat konsol operasi…</span>
      <Skeleton height="4rem" />
      <Skeleton height="8rem" />
      <div className="admin-loading__grid">
        <Skeleton height="20rem" />
        <Skeleton height="20rem" />
      </div>
      <Skeleton height="18rem" />
    </main>
  );
}
