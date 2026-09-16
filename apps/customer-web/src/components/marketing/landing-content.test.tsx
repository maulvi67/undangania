// @vitest-environment jsdom

import * as React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { FeaturedTemplates } from "./featured-templates";
import { Hero } from "./hero";
import { LandingMarquee } from "./landing-marquee";
import {
  PricingExplanation,
  INVITATION_ACTIVE_PERIOD,
} from "./pricing-explanation";
import { TrustSection } from "./trust-section";
import { FaqSection } from "./faq-section";
import { formatIdr, TIER_LABELS } from "../templates/template-contract";
import { getActiveTemplates } from "../templates/template-data";

afterEach(cleanup);

const active = getActiveTemplates();
const featured = active.slice(0, 3);

/**
 * `Intl.NumberFormat("id-ID", { style: "currency" })` separates the amount with
 * a non-breaking space, which Testing Library's default normalizer does not
 * collapse — so currency assertions match on a normalised comparison instead.
 */
function textWithAmount(amount: string): string {
  return amount.replace(/\u00a0/g, " ");
}

function bodyText(): string {
  return (document.body.textContent ?? "").replace(/\u00a0/g, " ");
}

describe("landing featured templates", () => {
  it("shows the real catalog designs instead of a landing-only sample", () => {
    render(<FeaturedTemplates />);

    for (const template of featured) {
      expect(
        screen.getByRole("heading", { level: 3, name: template.name }),
      ).toBeTruthy();
      expect(screen.getByText(template.designCharacter)).toBeTruthy();
    }
  });

  it("gives every featured design an onward link to its detail route", () => {
    render(<FeaturedTemplates />);

    for (const template of featured) {
      const links = screen
        .getAllByRole("link")
        .filter(
          (link) => link.getAttribute("href") === `/templates/${template.id}`,
        );
      // Title link plus the explicit action, so the tile is never a dead end.
      expect(links.length).toBeGreaterThanOrEqual(2);
    }
  });

  it("renders the catalog price and tier, and never invents a figure", () => {
    const priced = featured.filter((template) => template.priceIdr !== null);
    expect(priced.length).toBeGreaterThan(0);

    render(<FeaturedTemplates />);

    for (const template of priced) {
      const price = template.priceIdr as number;
      // The exact catalog figure appears; nothing is rounded or embellished.
      expect(bodyText()).toContain(textWithAmount(formatIdr(price)));
      expect(bodyText()).toContain(TIER_LABELS[template.tier]);
    }
  });
});

describe("landing pricing explanation", () => {
  it("states the price range from the shared constant's policy, not a rounded claim", () => {
    const prices = active
      .map((template) => template.priceIdr)
      .filter((price): price is number => price !== null);
    const min = Math.min(...prices);
    const max = Math.max(...prices);

    render(<PricingExplanation />);

    const range = document.querySelector(".lnd-pricing__range-value");
    expect(range?.textContent).toBe(`${formatIdr(min)}\u2013${formatIdr(max)}`);
  });

  it("states the invitation active period from the shared constant", () => {
    render(<PricingExplanation />);

    expect(screen.getByText(INVITATION_ACTIVE_PERIOD)).toBeTruthy();
  });

  it("explains that price tracks design, not features", () => {
    render(<PricingExplanation />);

    expect(screen.getByRole("heading", { level: 2 }).textContent).toBe(
      "Harga mencerminkan desain, bukan fitur",
    );
  });
});

describe("landing trust and FAQ copy", () => {
  const FABRICATED_PROOF = [
    /\b\d[\d.,]*\s*(pasangan|pelanggan|pengguna|customer|user)\b/i,
    /\b\d(?:[.,]\d)?\s*(dari\s*5|bintang)\b/i,
    /\b(rating|ulasan|testimoni)\s+\d/i,
    /\bterbaik\s+di\s+indonesia\b/i,
    /\baward|penghargaan\b/i,
  ];

  it("renders no invented social proof", () => {
    render(
      <>
        <TrustSection />
        <FaqSection />
        <PricingExplanation />
        <FeaturedTemplates />
      </>,
    );

    const text = bodyText();
    for (const pattern of FABRICATED_PROOF) {
      expect(text, `unexpected social proof matching ${pattern}`).not.toMatch(
        pattern,
      );
    }
  });

  it("says explicitly that unverifiable proof is not used", () => {
    render(<TrustSection />);

    expect(screen.getByText(/tidak bisa diverifikasi/i)).toBeTruthy();
  });
});

describe("landing hero", () => {
  it("labels its sample invitation as sample data", () => {
    render(<Hero />);

    // The hero shows an illustrative couple, so the page must say so rather
    // than let it read as a real customer or a real wedding date.
    expect(screen.getByText(/data contoh/i)).toBeTruthy();
  });

  it("hides the decorative depth layers from assistive technology", () => {
    const { container } = render(<Hero />);

    // Halo, bokeh, aurora, and the two empty backing cards exist only to give
    // the front card physical depth. None of them carries meaning.
    for (const selector of [
      ".lnd-hero__aurora",
      ".lnd-hero__bokeh",
      ".lnd-stack",
    ]) {
      expect(
        container.querySelector(selector)?.getAttribute("aria-hidden"),
        `${selector} must be aria-hidden`,
      ).toBe("true");
    }
  });

  it("renders the sample names only inside the aria-hidden deck", () => {
    const { container } = render(<Hero />);

    // The names must still render — the layered card is the hero's visual — but
    // they belong to a decorative sample, not to the page's content. Asserting
    // both halves keeps this from passing vacuously if the deck is ever
    // emptied, and keeps a screen reader from hearing a fake couple as if they
    // were real customers.
    const names = container.querySelector(".lnd-invite__names");
    expect(names?.textContent).toContain("Rai");
    expect(names?.closest("[aria-hidden='true']")).not.toBeNull();
  });
});

describe("landing capability marquee", () => {
  it("stays out of the accessibility tree so features are not announced twice", () => {
    render(<LandingMarquee />);

    // The same six capabilities are listed semantically under "Fitur inti".
    // The strip is decorative reinforcement, so it must contribute no roles to
    // the accessibility tree — otherwise a screen reader reads the list twice.
    //
    // Role queries are the right probe here: unlike `queryByText`, they respect
    // `aria-hidden` and therefore describe what a screen reader actually sees.
    expect(screen.queryAllByRole("list")).toHaveLength(0);
    expect(screen.queryAllByRole("listitem")).toHaveLength(0);
  });

  it("marks the whole track aria-hidden", () => {
    const { container } = render(<LandingMarquee />);

    expect(
      container
        .querySelector(".lnd-marquee__track")
        ?.getAttribute("aria-hidden"),
    ).toBe("true");
  });

  it("renders exactly two identical copies for the seamless loop", () => {
    const { container } = render(<LandingMarquee />);

    // The track translates by half its own width, which is one full copy. Two
    // groups of equal length is what makes that valid without measuring in JS.
    const groups = container.querySelectorAll(".lnd-marquee__group");
    expect(groups).toHaveLength(2);
    expect(groups[0]?.textContent).toBe(groups[1]?.textContent);

    // Exactly one is flagged as the clone, which is what the reduced-motion
    // rule hides once the strip stops looping.
    expect(
      container.querySelectorAll(".lnd-marquee__group--clone"),
    ).toHaveLength(1);
  });
});

describe("landing template core-feature parity", () => {
  it("never presents a design as having extra invitation functionality", () => {
    render(<FeaturedTemplates />);

    const text = bodyText();

    // Feature parity is stated once at section level, never as per-card
    // feature claims. The tier label is craft language describing visual
    // complexity and must not be paired with a functional promise.
    expect(text).not.toMatch(/premium/i);
    expect(text).not.toMatch(/rsvp\s+(lebih|tanpa batas|unlimited)/i);
    expect(text).not.toMatch(
      /(fitur|fungsi)\w*\s+(lebih|lengkap|tambahan)\s+(di|pada)/i,
    );
  });

  it("uses only an approved craft tier label, never a functional tier name", () => {
    render(<FeaturedTemplates />);

    const text = document.querySelector(".lnd-tiles")?.textContent ?? "";
    const approved = Object.values(TIER_LABELS).filter((label) =>
      text.includes(label),
    );

    // Every tier word shown on a tile is one the template contract allows.
    expect(approved.length).toBeGreaterThan(0);
    expect(text).not.toMatch(/basic|premium|pro\b/i);
  });

  it("confirms every featured design is publicly listable", () => {
    for (const template of featured) {
      expect(template.status).toBe("ACTIVE");
      expect(template.sections.length).toBeGreaterThan(0);
    }
  });
});
