import { Skeleton } from "../components/ui/skeleton";
import "./admin.css";

export default function AdminLoading() {
  return (
    <main className="mx-auto grid min-h-[100dvh] w-full max-w-6xl content-center gap-4 px-4 py-8 sm:px-6" role="status" aria-live="polite">
      <span className="ui-visually-hidden">Memuat konsol operasi…</span>
      <Skeleton className="h-16 w-full" />
      <Skeleton className="h-32 w-full" />
      <div className="grid gap-4 md:grid-cols-2"><Skeleton className="h-80 w-full" /><Skeleton className="h-80 w-full" /></div>
      <Skeleton className="h-72 w-full" />
    </main>
  );
}
