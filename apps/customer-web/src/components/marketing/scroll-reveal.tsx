"use client";

import { useEffect } from "react";

/**
 * Scroll reveal for the landing page.
 *
 * The landing page previously relied on `animation-timeline: view()`, which only
 * Chromium implements. Safari and Firefox ignored it silently, so most guests —
 * who open invitation links on an iPhone — saw no reveal at all. This component
 * drives the same effect with `IntersectionObserver`, which is available
 * everywhere the product supports.
 *
 * Two rules keep it safe:
 *
 *   1. Nothing is ever hidden without JavaScript. Sections are only marked
 *      `pending` (the hidden state) from inside the effect, so a failed bundle,
 *      a disabled script, or an unsupported observer leaves the page fully
 *      visible. The failure mode is "no animation", never "no content".
 *   2. Sections already on screen are marked `in` immediately rather than
 *      observed. Hiding them first would make above-the-fold content flash: the
 *      page paints, hydration runs, then everything below the fold blinks.
 *
 * `prefers-reduced-motion` short-circuits the whole thing, so a reader who asks
 * for less motion never has an element hidden from them in the first place.
 */

/** Attribute the stylesheet keys off. Kept in sync with `landing.css`. */
export const REVEAL_ATTRIBUTE = "reveal";
export const REVEAL_PENDING = "pending";
export const REVEAL_IN = "in";

/**
 * Fraction of the viewport an element's top must clear to count as "already
 * visible". Slightly under the full height so a section sitting just at the
 * fold animates on load instead of waiting for a scroll that may never come.
 */
export const REVEAL_VISIBLE_RATIO = 0.88;

export type RevealDecision = typeof REVEAL_PENDING | typeof REVEAL_IN;

/**
 * Decides whether an element should animate immediately or wait for scroll.
 * Extracted as a pure function so the boundary is testable without a DOM.
 */
export function decideReveal(input: {
  top: number;
  bottom: number;
  viewportHeight: number;
}): RevealDecision {
  if (input.bottom <= 0) return REVEAL_PENDING;
  return input.top < input.viewportHeight * REVEAL_VISIBLE_RATIO
    ? REVEAL_IN
    : REVEAL_PENDING;
}

function revealTargets(root: HTMLElement): HTMLElement[] {
  return Array.from(
    root.querySelectorAll<HTMLElement>(".lnd-section, .lnd-final"),
  );
}

export function ScrollReveal() {
  useEffect(() => {
    const root = document.querySelector<HTMLElement>(".lnd-shell");
    if (root === null) return;

    const targets = revealTargets(root);
    if (targets.length === 0) return;

    // Respect the reader's motion preference before touching the DOM: with
    // reduced motion the animation never runs, so hiding anything would just
    // leave it hidden. Guarded because `matchMedia` is absent in some embedded
    // webviews and in the test environment; a throw here would abort the reveal
    // entirely and leave every section hidden behind a stylesheet rule.
    const reduceMotion =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion) return;

    // Without an observer there is no way to know when to reveal, so show
    // everything rather than risk stranding content off-screen.
    if (typeof IntersectionObserver === "undefined") {
      for (const target of targets)
        target.dataset[REVEAL_ATTRIBUTE] = REVEAL_IN;
      return;
    }

    const viewportHeight = window.innerHeight;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const element = entry.target as HTMLElement;
          element.dataset[REVEAL_ATTRIBUTE] = REVEAL_IN;
          // One-shot: a section that has revealed must not re-hide when the
          // reader scrolls back up past it.
          observer.unobserve(element);
        }
      },
      {
        // Trigger a little before the section is fully in view so the motion
        // finishes as it settles rather than starting at the edge.
        rootMargin: "0px 0px -12% 0px",
        threshold: 0.01,
      },
    );

    for (const target of targets) {
      const rect = target.getBoundingClientRect();
      const decision = decideReveal({
        top: rect.top,
        bottom: rect.bottom,
        viewportHeight,
      });
      target.dataset[REVEAL_ATTRIBUTE] = decision;
      if (decision === REVEAL_PENDING) observer.observe(target);
    }

    return () => observer.disconnect();
  }, []);

  // Renders nothing; the stylesheet owns the motion. Server Components stay
  // Server Components — only this leaf is a Client Component.
  return null;
}
