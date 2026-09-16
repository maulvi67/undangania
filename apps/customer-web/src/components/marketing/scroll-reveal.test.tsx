// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "@testing-library/react";
import * as React from "react";
import {
  decideReveal,
  REVEAL_ATTRIBUTE,
  REVEAL_IN,
  REVEAL_PENDING,
  ScrollReveal,
} from "./scroll-reveal";

afterEach(() => {
  cleanup();
  document.body.innerHTML = "";
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const VIEWPORT = 800;

describe("decideReveal", () => {
  it("reveals a section that is already within the fold", () => {
    // Above-the-fold content animates on load instead of flashing: hiding it
    // first and revealing on an observer callback would blink the page.
    expect(
      decideReveal({ top: 100, bottom: 500, viewportHeight: VIEWPORT }),
    ).toBe(REVEAL_IN);
  });

  it("waits for a section below the fold", () => {
    expect(
      decideReveal({ top: 740, bottom: 1400, viewportHeight: VIEWPORT }),
    ).toBe(REVEAL_PENDING);
  });

  it("reveals a tall section whose top is just past the fold", () => {
    // A section taller than the viewport is already legible at its top edge.
    expect(
      decideReveal({ top: 700, bottom: 2000, viewportHeight: VIEWPORT }),
    ).toBe(REVEAL_IN);
  });

  it("waits for a section that has not entered at all", () => {
    expect(
      decideReveal({ top: 900, bottom: 1800, viewportHeight: VIEWPORT }),
    ).toBe(REVEAL_PENDING);
  });

  it("waits for a section scrolled above the viewport", () => {
    // Scrolling back up must not re-hide a section that already revealed; the
    // component unobserves on reveal, and this is the reason it has to.
    expect(
      decideReveal({ top: -900, bottom: -100, viewportHeight: VIEWPORT }),
    ).toBe(REVEAL_PENDING);
  });

  it("uses the viewport ratio as the boundary", () => {
    const boundary = VIEWPORT * 0.88;
    expect(
      decideReveal({
        top: boundary - 1,
        bottom: boundary + 200,
        viewportHeight: VIEWPORT,
      }),
    ).toBe(REVEAL_IN);
    expect(
      decideReveal({
        top: boundary + 1,
        bottom: boundary + 200,
        viewportHeight: VIEWPORT,
      }),
    ).toBe(REVEAL_PENDING);
  });
});

/** Minimal observer so the component can be exercised without a real browser. */
function stubIntersectionObserver(): {
  observed: Element[];
  trigger: (element: Element) => void;
} {
  const observed: Element[] = [];
  const callbacks = new Map<Element, IntersectionObserverCallback>();

  class FakeObserver {
    public constructor(
      private readonly callback: IntersectionObserverCallback,
    ) {}

    public observe(element: Element): void {
      observed.push(element);
      callbacks.set(element, this.callback);
    }

    public unobserve(element: Element): void {
      callbacks.delete(element);
    }

    public disconnect(): void {
      callbacks.clear();
    }
  }

  vi.stubGlobal("IntersectionObserver", FakeObserver);

  return {
    observed,
    trigger: (element) => {
      const callback = callbacks.get(element);
      callback?.(
        [
          {
            target: element,
            isIntersecting: true,
          } as IntersectionObserverEntry,
        ],
        {} as IntersectionObserver,
      );
    },
  };
}

function mountLandingSections(): HTMLElement {
  const shell = document.createElement("div");
  shell.className = "lnd-shell";

  const first = document.createElement("section");
  first.className = "lnd-section";
  const second = document.createElement("section");
  second.className = "lnd-section";
  const final = document.createElement("section");
  final.className = "lnd-final";

  // The first section is at the top of the page, the rest are far below.
  vi.spyOn(first, "getBoundingClientRect").mockReturnValue({
    top: 40,
    bottom: 600,
  } as DOMRect);
  vi.spyOn(second, "getBoundingClientRect").mockReturnValue({
    top: 1200,
    bottom: 1900,
  } as DOMRect);
  vi.spyOn(final, "getBoundingClientRect").mockReturnValue({
    top: 2400,
    bottom: 3000,
  } as DOMRect);

  shell.append(first, second, final);
  document.body.append(shell);
  return shell;
}

function revealState(element: Element): string | undefined {
  return (element as HTMLElement).dataset[REVEAL_ATTRIBUTE];
}

describe("ScrollReveal", () => {
  it("leaves above-the-fold sections visible immediately", () => {
    stubIntersectionObserver();
    mountLandingSections();

    render(<ScrollReveal />);

    const first = document.querySelector(".lnd-section");
    expect(revealState(first as Element)).toBe(REVEAL_IN);
  });

  it("marks below-the-fold sections pending and observes them", () => {
    const observer = stubIntersectionObserver();
    mountLandingSections();

    render(<ScrollReveal />);

    const sections = document.querySelectorAll(".lnd-section");
    expect(revealState(sections[1] as Element)).toBe(REVEAL_PENDING);
    expect(observer.observed).toHaveLength(2);
  });

  it("reveals a section when the observer reports it in view", () => {
    const observer = stubIntersectionObserver();
    mountLandingSections();

    render(<ScrollReveal />);

    const second = document.querySelectorAll(".lnd-section")[1] as Element;
    observer.trigger(second);

    expect(revealState(second)).toBe(REVEAL_IN);
  });

  it("hides nothing when the reader prefers reduced motion", () => {
    stubIntersectionObserver();
    mountLandingSections();
    vi.stubGlobal(
      "matchMedia",
      vi.fn().mockReturnValue({
        matches: true,
        addEventListener() {},
        removeEventListener() {},
      }),
    );

    render(<ScrollReveal />);

    for (const element of document.querySelectorAll(
      ".lnd-section, .lnd-final",
    )) {
      // No attribute at all, so the stylesheet leaves the section visible. The
      // failure mode must be "no animation", never "no content".
      expect(revealState(element)).toBeUndefined();
    }
  });

  it("shows everything when IntersectionObserver is unavailable", () => {
    mountLandingSections();
    // jsdom has no observer; explicitly remove it for the unsupported case.
    vi.stubGlobal("IntersectionObserver", undefined);
    vi.stubGlobal(
      "matchMedia",
      vi.fn().mockReturnValue({
        matches: false,
        addEventListener() {},
        removeEventListener() {},
      }),
    );

    render(<ScrollReveal />);

    for (const element of document.querySelectorAll(
      ".lnd-section, .lnd-final",
    )) {
      expect(revealState(element)).toBe(REVEAL_IN);
    }
  });

  it("renders nothing of its own", () => {
    stubIntersectionObserver();
    mountLandingSections();

    const { container } = render(<ScrollReveal />);

    expect(container.innerHTML).toBe("");
  });

  it("does nothing when the landing shell is absent", () => {
    const observer = stubIntersectionObserver();

    render(<ScrollReveal />);

    expect(observer.observed).toHaveLength(0);
  });
});
