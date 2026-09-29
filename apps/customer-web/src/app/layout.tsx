import type { ReactNode } from "react";
import { Fraunces, Instrument_Sans } from "next/font/google";
import "@wedding/ui/tokens.css";
import "@wedding/ui/ui.css";
import "./template-preview.css";
import "./landing.css";

export const metadata = { title: "Undangania" };

/*
 * Self-hosted via next/font: no third-party font request at runtime, latin
 * subset only, and Next injects metric-matched fallbacks (size-adjust) so the
 * swap does not materially shift layout.
 *
 * The generated custom properties are declared on <html>, not <body>, because
 * `--font-display` / `--font-sans` in tokens.css substitute their `var()`
 * fallback on the element where they are declared (`:root` = <html>). A face
 * declared only on <body> would resolve too late and silently fall back to the
 * system stack.
 */
const display = Fraunces({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-display-face",
});

const sans = Instrument_Sans({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-sans-face",
});

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="id" className={`${display.variable} ${sans.variable}`}>
      <body>{children}</body>
    </html>
  );
}
