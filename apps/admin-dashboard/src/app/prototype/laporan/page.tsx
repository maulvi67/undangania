import type { Metadata } from "next";
import { LaporanPage } from "../../../components/prototype/pages/laporan";

export const metadata: Metadata = {
  title: "Laporan — Prototype Undangania",
};

export default function LaporanRoute() {
  return <LaporanPage />;
}
