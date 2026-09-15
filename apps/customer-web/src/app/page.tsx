import type { Metadata } from "next";
import { MarketingHeader } from "../components/marketing/marketing-header";
import { MarketingFooter } from "../components/marketing/marketing-footer";
import { Hero } from "../components/marketing/hero";
import { ValueProps } from "../components/marketing/value-props";
import { HowItWorks } from "../components/marketing/how-it-works";
import { FeaturedTemplates } from "../components/marketing/featured-templates";
import { CoreFeatures } from "../components/marketing/core-features";
import { PricingExplanation } from "../components/marketing/pricing-explanation";
import { TrustSection } from "../components/marketing/trust-section";
import { FaqSection } from "../components/marketing/faq-section";
import { FinalCta } from "../components/marketing/final-cta";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

const title = "Wedding System — Undangan Pernikahan Digital";
const description =
  "Buat undangan pernikahan digital yang elegan tanpa perlu keahlian desain. Pilih desain, isi detail acara, dan bagikan ke tamu — semua desain termasuk fitur undangan lengkap.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title,
  description,
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "id_ID",
    url: "/",
    title,
    description,
    siteName: "Wedding System",
  },
  twitter: { card: "summary" },
};

const websiteJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "Wedding System",
  inLanguage: "id-ID",
};

export default function LandingPage() {
  return (
    <div className="ui-shell lnd-shell">
      <a className="ui-skip-link" href="#konten-utama">
        Langsung ke konten utama
      </a>
      <MarketingHeader />
      <main id="konten-utama" tabIndex={-1}>
        <Hero />
        <ValueProps />
        <HowItWorks />
        <FeaturedTemplates />
        <CoreFeatures />
        <PricingExplanation />
        <TrustSection />
        <FaqSection />
        <FinalCta />
      </main>
      <MarketingFooter />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd) }}
      />
    </div>
  );
}
