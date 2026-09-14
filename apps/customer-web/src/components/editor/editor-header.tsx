import Link from "next/link";
import type { EditorSaveState } from "../../lib/editor/contract";
import { SaveStatus } from "./save-status";

export function EditorHeader({
  invitationTitle,
  saveState,
  onRetry,
}: {
  invitationTitle: string;
  saveState: EditorSaveState;
  onRetry: () => void;
}) {
  return (
    <header className="ed-header">
      <div className="ed-header__inner">
        <div className="ed-header__identity">
          <Link className="ed-header__brand" href="/">
            Wedding System
          </Link>
          <span className="ed-header__separator" aria-hidden="true">
            /
          </span>
          <span className="ed-header__context">Editor undangan</span>
        </div>
        <div className="ed-header__actions">
          <SaveStatus state={saveState} onRetry={onRetry} />
          <Link className="ed-header__back" href="/dashboard">
            Kembali ke dasbor
          </Link>
        </div>
      </div>
      <div className="ed-header__title-row">
        <div className="ui-container">
          <p className="ed-header__eyebrow">Workspace pernikahan</p>
          <h1>{invitationTitle || "Undangan baru"}</h1>
        </div>
      </div>
    </header>
  );
}
