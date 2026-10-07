import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Fraunces, Instrument_Sans } from "next/font/google";
import { PrototypeShell } from "../../components/prototype/shell";
import { PrototypeProvider } from "../../components/prototype/store";
import "./prototype.css";

/**
 * Prototype-only layout. Fonts are loaded here rather than in the app root so
 * the existing admin console keeps its current typography.
 *
 * Every route below `/prototype` shares one shell and one store, so the global
 * search, the order dialog, and the toast survive client-side navigation.
 */
const display = Fraunces({
  subsets: ["latin"],
  display: "swap",
  variable: "--proto-display-face",
});

const sans = Instrument_Sans({
  subsets: ["latin"],
  display: "swap",
  variable: "--proto-sans-face",
});

export const metadata: Metadata = {
  title: "Prototype Dashboard Penjualan — Undangania",
  description:
    "Prototype internal untuk penjualan dan pengelolaan undangan digital Undangania.",
  robots: { index: false, follow: false },
};

export default function PrototypeLayout({ children }: { children: ReactNode }) {
  return (
    <div
      className={`${display.variable} ${sans.variable} undangania-proto min-h-[100dvh]`}
    >
      <PrototypeProvider>
        <PrototypeShell>{children}</PrototypeShell>
      </PrototypeProvider>
    </div>
  );
}
