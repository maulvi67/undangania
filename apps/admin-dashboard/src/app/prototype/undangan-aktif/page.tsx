import type { Metadata } from "next";
import { UndanganAktifPage } from "../../../components/prototype/pages/undangan-aktif";

export const metadata: Metadata = {
  title: "Undangan Aktif — Prototype Undangania",
};

export default function UndanganAktifRoute() {
  return <UndanganAktifPage />;
}
