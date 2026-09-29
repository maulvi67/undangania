"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ChartNoAxesCombined } from "lucide-react";
import { Card, CardContent, CardHeader } from "../ui/card";
import type { OperationsSummary } from "../../lib/admin/operations-summary";

export function OperationsBreakdownChart({
  page,
  summary,
}: {
  page: number;
  summary: OperationsSummary;
}) {
  return (
    <Card
      className="admin-section admin-chart"
      aria-labelledby="operations-chart-title"
    >
      <CardHeader className="admin-section__heading">
        <div>
          <p className="admin-eyebrow">Beban operasi</p>
          <h2 id="operations-chart-title" className="mt-1 text-base font-bold">
            Baris per bagian
          </h2>
          <p className="admin-section__description">
            Jumlah pada halaman aktif, bukan tren atau total platform.
          </p>
        </div>
        <span
          className="admin-chart__context"
          aria-label={`Data sesuai filter pada halaman ${page}`}
        >
          Halaman {page}
        </span>
      </CardHeader>
      <CardContent>
        {summary.visibleRowCount === 0 ? (
          <div className="admin-chart__empty" role="status">
            <ChartNoAxesCombined className="size-5" aria-hidden="true" />
            <p>
              {summary.unavailableSectionCount > 0
                ? "Belum ada bagian yang menyediakan baris untuk divisualisasikan."
                : "Belum ada baris pada halaman aktif."}
            </p>
            {summary.unavailableSectionCount > 0 ? (
              <span>
                {summary.unavailableSectionCount} bagian tidak tersedia atau
                dibatasi.
              </span>
            ) : null}
          </div>
        ) : (
          <>
            <p className="ui-visually-hidden" id="operations-chart-description">
              Grafik batang horizontal menampilkan {summary.visibleRowCount}{" "}
              baris yang tersedia pada halaman aktif di{" "}
              {summary.chartData.length} bagian. Bagian yang tidak tersedia atau
              dibatasi tidak dihitung sebagai nol.
            </p>
            <div
              className="admin-chart__plot"
              role="group"
              aria-label="Visualisasi jumlah baris menurut bagian"
              aria-describedby="operations-chart-description"
            >
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={summary.chartData}
                  layout="vertical"
                  margin={{ top: 4, right: 16, bottom: 4, left: 0 }}
                  accessibilityLayer
                  aria-label="Baris operasi menurut bagian pada halaman aktif"
                >
                  <CartesianGrid
                    horizontal={false}
                    stroke="var(--color-line)"
                  />
                  <XAxis
                    type="number"
                    allowDecimals={false}
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "var(--color-ink-soft)", fontSize: 11 }}
                  />
                  <YAxis
                    type="category"
                    dataKey="label"
                    width={128}
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "var(--color-ink-soft)", fontSize: 11 }}
                  />
                  <Tooltip
                    cursor={{ fill: "var(--color-panel-muted)" }}
                    contentStyle={{
                      borderColor: "var(--color-line)",
                      borderRadius: "0.6rem",
                      backgroundColor: "var(--color-panel)",
                      color: "var(--color-ink)",
                    }}
                    formatter={(value) => [
                      typeof value === "number" ? value : String(value ?? ""),
                      "Baris",
                    ]}
                  />
                  <Bar
                    dataKey="count"
                    name="Baris"
                    fill="var(--color-accent)"
                    radius={[0, 5, 5, 0]}
                    isAnimationActive={false}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="admin-chart__footnote">
              <span>{summary.visibleRowCount} baris tersedia</span>
              {summary.unavailableSectionCount > 0 ? (
                <span>
                  {summary.unavailableSectionCount} bagian dikecualikan karena
                  tidak tersedia atau dibatasi
                </span>
              ) : null}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
