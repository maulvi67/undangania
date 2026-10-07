import type { Metadata } from "next";
import { DataAcaraPage } from "../../../components/prototype/pages/data-acara";

export const metadata: Metadata = {
  title: "Data Acara — Prototype Undangania",
};

export default function DataAcaraRoute() {
  return <DataAcaraPage />;
}
