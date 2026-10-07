import type { Metadata } from "next";
import { PengaturanPage } from "../../../components/prototype/pages/pengaturan";

export const metadata: Metadata = {
  title: "Pengaturan — Prototype Undangania",
};

export default function PengaturanRoute() {
  return <PengaturanPage />;
}
