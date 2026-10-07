import type { Metadata } from "next";
import { PesananPage } from "../../../components/prototype/pages/pesanan";

export const metadata: Metadata = {
  title: "Pesanan — Prototype Undangania",
};

export default function PesananRoute() {
  return <PesananPage />;
}
