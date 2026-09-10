import type { FeaturedPreview } from "./featured-templates-data";

/**
 * CSS-composed miniature invitation. Purely decorative: it illustrates the
 * design direction without implying a real template asset.
 */
export function InvitationPreviewCard({ variant }: { variant: FeaturedPreview }) {
  return (
    <div className={`lnd-tile__preview lnd-tile__preview--${variant}`} aria-hidden="true">
      <span className="lnd-tile__names">Rai &amp; Anisa</span>
      {variant === "klasik" ? (
        <>
          <span className="lnd-tile__eyebrow">Undangan Pernikahan</span>
          <span className="lnd-tile__rule" />
          <span className="lnd-tile__date">Sabtu, 12 September 2026</span>
        </>
      ) : null}
      {variant === "minimalis" ? (
        <>
          <span className="lnd-tile__eyebrow">Undangan</span>
          <span className="lnd-tile__date">12 . 09 . 2026</span>
        </>
      ) : null}
      {variant === "tradisional" ? (
        <>
          <span className="lnd-tile__eyebrow lnd-tile__eyebrow--clay">Walimatul Urs</span>
          <span className="lnd-tile__rule lnd-tile__rule--clay" />
          <span className="lnd-tile__date">Sabtu, 12 September 2026</span>
        </>
      ) : null}
    </div>
  );
}
