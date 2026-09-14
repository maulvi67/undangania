import { LoadingState } from "@wedding/ui";

export default function EditorLoading() {
  return (
    <main className="ed-page ed-page--state">
      <div className="ed-state-card">
        <LoadingState label="Memuat editor undangan" rows={5} />
      </div>
    </main>
  );
}
