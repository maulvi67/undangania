"use client";

import { useReducedMotion } from "motion/react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  CATEGORIES,
  formatCompactRupiah,
  formatRupiah,
  SALES_SERIES,
  TOTAL_CATEGORY_COUNT,
  type ChartMetric,
  type SalesPoint,
} from "./data";

const AXIS_TICK = { fill: "#8A7671", fontSize: 11 } as const;

/* -------------------------------------------------------------------------- */
/* Sales area chart                                                            */
/* -------------------------------------------------------------------------- */

export function SalesChart({
  metric,
  period,
}: {
  metric: ChartMetric;
  period: keyof typeof SALES_SERIES;
}) {
  const reduceMotion = useReducedMotion();
  const series = SALES_SERIES[period];
  const isIncome = metric === "income";

  return (
    // Explicit height is required: ResponsiveContainer with height="100%"
    // collapses to 0 inside an auto-height parent.
    <div className="h-[240px] w-full sm:h-[280px]">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={series}
          margin={{ top: 8, right: 8, bottom: 0, left: 0 }}
          accessibilityLayer
        >
          <defs>
            <linearGradient id="proto-sales-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#B95363" stopOpacity={0.32} />
              <stop offset="100%" stopColor="#B95363" stopOpacity={0} />
            </linearGradient>
          </defs>

          <CartesianGrid
            vertical={false}
            stroke="#EADFDA"
            strokeDasharray="4 6"
          />

          <XAxis
            dataKey="label"
            axisLine={false}
            tickLine={false}
            tick={AXIS_TICK}
            minTickGap={20}
            interval="preserveStartEnd"
            dy={6}
          />

          <YAxis
            axisLine={false}
            tickLine={false}
            tick={AXIS_TICK}
            width={58}
            tickFormatter={(value: number) =>
              isIncome ? formatCompactRupiah(value) : String(Math.round(value))
            }
          />

          <Tooltip
            cursor={{
              stroke: "#B95363",
              strokeDasharray: "4 4",
              strokeOpacity: 0.35,
            }}
            content={({ active, payload, label }) => {
              if (!active || !payload || payload.length === 0) return null;
              const point = payload[0]?.payload as SalesPoint | undefined;
              if (!point) return null;
              return (
                <div className="rounded-2xl border border-[var(--p-line)] bg-white px-3.5 py-3 shadow-xl">
                  <p className="proto-display text-[13px] font-semibold text-[var(--p-ink)]">
                    {String(label)}
                  </p>
                  <dl className="mt-2 space-y-1 text-xs">
                    <div className="flex items-center justify-between gap-5">
                      <dt className="text-[var(--p-ink-soft)]">Pendapatan</dt>
                      <dd className="proto-nums font-semibold text-[var(--p-ink)]">
                        {formatRupiah(point.income)}
                      </dd>
                    </div>
                    <div className="flex items-center justify-between gap-5">
                      <dt className="text-[var(--p-ink-soft)]">Pesanan</dt>
                      <dd className="proto-nums font-semibold text-[var(--p-ink)]">
                        {point.orders}
                      </dd>
                    </div>
                  </dl>
                </div>
              );
            }}
          />

          <Area
            type="monotone"
            dataKey={metric}
            stroke="#B95363"
            strokeWidth={2.5}
            fill="url(#proto-sales-fill)"
            isAnimationActive={!reduceMotion}
            activeDot={{
              r: 4,
              strokeWidth: 2,
              fill: "#FFFFFF",
              stroke: "#B95363",
            }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Category donut                                                              */
/* -------------------------------------------------------------------------- */

export function CategoryDonut() {
  const reduceMotion = useReducedMotion();

  return (
    <div>
      <div className="relative h-[188px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart accessibilityLayer>
            <Pie
              data={CATEGORIES}
              dataKey="count"
              nameKey="name"
              innerRadius="64%"
              outerRadius="94%"
              paddingAngle={2}
              stroke="#FFFFFF"
              strokeWidth={2}
              isAnimationActive={!reduceMotion}
            >
              {CATEGORIES.map((slice) => (
                <Cell key={slice.name} fill={slice.color} />
              ))}
            </Pie>
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload || payload.length === 0) return null;
                const slice = payload[0]?.payload as
                  { name: string; count: number; percent: number } | undefined;
                if (!slice) return null;
                return (
                  <div className="rounded-xl border border-[var(--p-line)] bg-white px-3 py-2 text-xs shadow-xl">
                    <p className="font-semibold text-[var(--p-ink)]">
                      {slice.name}
                    </p>
                    <p className="proto-nums text-[var(--p-ink-soft)]">
                      {slice.count} pesanan · {slice.percent}%
                    </p>
                  </div>
                );
              }}
            />
          </PieChart>
        </ResponsiveContainer>

        <div className="pointer-events-none absolute inset-0 grid place-items-center">
          <div className="text-center">
            <p className="proto-display proto-nums text-2xl font-semibold text-[var(--p-ink)]">
              {TOTAL_CATEGORY_COUNT}
            </p>
            <p className="text-[10px] uppercase tracking-wider text-[var(--p-ink-soft)]">
              Pesanan
            </p>
          </div>
        </div>
      </div>

      <ul className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2">
        {CATEGORIES.map((slice) => (
          <li key={slice.name} className="flex items-center gap-2 text-xs">
            <span
              aria-hidden="true"
              className="h-2 w-2 shrink-0 rounded-full"
              style={{ background: slice.color }}
            />
            <span className="min-w-0 flex-1 truncate text-[var(--p-ink-soft)]">
              {slice.name}
            </span>
            <span className="proto-nums font-semibold text-[var(--p-ink)]">
              {slice.percent}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
