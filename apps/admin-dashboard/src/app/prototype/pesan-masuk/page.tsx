import type { Metadata } from "next";
import { PesanMasukPage } from "../../../components/prototype/pages/pesan-masuk";

export const metadata: Metadata = {
  title: "Pesan Masuk — Prototype Undangania",
};

export default function PesanMasukRoute() {
  return <PesanMasukPage />;
}
