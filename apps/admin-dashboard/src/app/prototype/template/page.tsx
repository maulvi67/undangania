import type { Metadata } from "next";
import { TemplatePage } from "../../../components/prototype/pages/template";

export const metadata: Metadata = {
  title: "Template — Prototype Undangania",
};

export default function TemplateRoute() {
  return <TemplatePage />;
}
