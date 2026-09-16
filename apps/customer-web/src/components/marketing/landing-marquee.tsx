/**
 * Kinetic capability strip beneath the hero.
 *
 * Purely decorative reinforcement: the same six capabilities are listed
 * semantically in the "Fitur inti" section further down, so this layer is
 * `aria-hidden` and stays out of the accessibility tree. A screen reader hears
 * each feature exactly once, from the real section.
 *
 * The loop is seamless without measuring anything in JavaScript: the list is
 * rendered twice and the track translates by exactly half its own width, which
 * is one full copy. Both copies are identical, so there is no seam to hide.
 *
 * `lnd-marquee__group--clone` is what the stylesheet hides under
 * `prefers-reduced-motion: reduce`, where the strip stops looping, unwraps, and
 * shows a single copy so nothing is clipped at the right edge.
 */

const CAPABILITIES = [
  "Halaman acara",
  "RSVP tamu",
  "Buku tamu",
  "Galeri foto",
  "Informasi kado",
  "Manajemen tamu",
] as const;

function MarqueeGroup({ clone }: { clone?: boolean }) {
  return (
    <ul
      className={
        clone
          ? "lnd-marquee__group lnd-marquee__group--clone"
          : "lnd-marquee__group"
      }
    >
      {CAPABILITIES.map((label) => (
        <li className="lnd-marquee__item" key={label}>
          {label}
        </li>
      ))}
    </ul>
  );
}

export function LandingMarquee() {
  return (
    <div className="lnd-marquee">
      <div className="lnd-marquee__track" aria-hidden="true">
        <MarqueeGroup />
        <MarqueeGroup clone />
      </div>
    </div>
  );
}
