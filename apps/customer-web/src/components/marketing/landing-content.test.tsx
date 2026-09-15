// @vitest-environment jsdom

import * as React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { FeaturedTemplates } from "./featured-templates";
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
