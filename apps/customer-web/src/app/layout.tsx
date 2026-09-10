import type { ReactNode } from "react";
import "@wedding/ui/tokens.css";
import "@wedding/ui/ui.css";
import "./landing.css";

export const metadata = { title: "Wedding System" };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}
