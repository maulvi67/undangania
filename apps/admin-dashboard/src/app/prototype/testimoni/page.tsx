import type { Metadata } from "next";
import { TestimoniPage } from "../../../components/prototype/pages/testimoni";

export const metadata: Metadata = {
  title: "Testimoni — Prototype Undangania",
};

export default function TestimoniRoute() {
  return <TestimoniPage />;
}
