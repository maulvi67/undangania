import type { Metadata } from "next";
import { KategoriPage } from "../../../components/prototype/pages/kategori";

export const metadata: Metadata = {
  title: "Kategori — Prototype Undangania",
};

export default function KategoriRoute() {
  return <KategoriPage />;
}
