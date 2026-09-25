import type { Metadata } from "next";
import type { ReactNode } from "react";
import "@wedding/ui/tokens.css";
import "@wedding/ui/ui.css";
import "./globals.css";
import "./admin.css";

export const metadata: Metadata = {
  title: "Operasi Admin — Wedding System",
  description: "Konsol internal untuk operasi Wedding System.",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}
