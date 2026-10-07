import type { Metadata } from "next";
import { PromoPage } from "../../../components/prototype/pages/promo";

export const metadata: Metadata = {
  title: "Promo — Prototype Undangania",
};

export default function PromoRoute() {
  return <PromoPage />;
}
