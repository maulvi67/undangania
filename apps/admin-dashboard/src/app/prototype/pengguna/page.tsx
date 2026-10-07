import type { Metadata } from "next";
import { PenggunaPage } from "../../../components/prototype/pages/pengguna";

export const metadata: Metadata = {
  title: "Pengguna — Prototype Undangania",
};

export default function PenggunaRoute() {
  return <PenggunaPage />;
}
