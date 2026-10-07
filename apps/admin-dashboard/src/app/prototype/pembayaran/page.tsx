import type { Metadata } from "next";
import { PembayaranPage } from "../../../components/prototype/pages/pembayaran";

export const metadata: Metadata = {
  title: "Pembayaran — Prototype Undangania",
};

export default function PembayaranRoute() {
  return <PembayaranPage />;
}
