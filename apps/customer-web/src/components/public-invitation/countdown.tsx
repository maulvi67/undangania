"use client";

import { useEffect, useState } from "react";

type CountdownValue = {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
};

function parseLocalDateTime(
  value: string,
): [number, number, number, number, number] | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;
  const [, year, month, day, hour, minute] = match;
  if (!year || !month || !day || !hour || !minute) return null;
  return [
    Number(year),
    Number(month),
    Number(day),
    Number(hour),
    Number(minute),
  ];
}

function partValue(
  parts: Intl.DateTimeFormatPart[],
  type: Intl.DateTimeFormatPartTypes,
): number | null {
  const value = parts.find((part) => part.type === type)?.value;
  if (!value) return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function localDateTimeToEpoch(value: string, timezone: string): number | null {
  const parts = parseLocalDateTime(value);
  if (!parts) return null;
  const [year, month, day, hour, minute] = parts;
  const wallClock = Date.UTC(year, month - 1, day, hour, minute);
  try {
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    });
    const zonedParts = formatter.formatToParts(new Date(wallClock));
    const zonedYear = partValue(zonedParts, "year");
    const zonedMonth = partValue(zonedParts, "month");
    const zonedDay = partValue(zonedParts, "day");
    const zonedHour = partValue(zonedParts, "hour");
    const zonedMinute = partValue(zonedParts, "minute");
    const zonedSecond = partValue(zonedParts, "second");
    if (
      zonedYear === null ||
      zonedMonth === null ||
      zonedDay === null ||
      zonedHour === null ||
      zonedMinute === null ||
      zonedSecond === null
    ) {
      return null;
    }
    const representedWallClock = Date.UTC(
      zonedYear,
      zonedMonth - 1,
      zonedDay,
      zonedHour,
      zonedMinute,
      zonedSecond,
    );
    return wallClock - (representedWallClock - wallClock);
  } catch {
    return null;
  }
}

function getRemaining(target: number): CountdownValue | null {
  const distance = target - Date.now();
  if (distance <= 0) return null;
  const totalSeconds = Math.floor(distance / 1000);
  return {
    days: Math.floor(totalSeconds / 86_400),
    hours: Math.floor((totalSeconds % 86_400) / 3_600),
    minutes: Math.floor((totalSeconds % 3_600) / 60),
    seconds: totalSeconds % 60,
  };
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

export function Countdown({
  startsAt,
  timezone,
}: {
  startsAt: string;
  timezone: string;
}) {
  const target = localDateTimeToEpoch(startsAt, timezone);
  const [remaining, setRemaining] = useState<CountdownValue | null | undefined>(
    undefined,
  );

  useEffect(() => {
    if (target === null) return;
    const update = () => setRemaining(getRemaining(target));
    update();
    const interval = window.setInterval(update, 1_000);
    return () => window.clearInterval(interval);
  }, [target]);

  const message =
    target === null || remaining === undefined
      ? "Menuju hari bahagia"
      : remaining === null
        ? "Hari bahagia telah tiba"
        : `${remaining.days} hari ${pad(remaining.hours)}:${pad(remaining.minutes)}:${pad(remaining.seconds)}`;

  return (
    <p className="gld-countdown" aria-label={`Hitung mundur: ${message}`}>
      <span className="gld-countdown__label">Menuju hari bahagia</span>
      <span className="gld-countdown__value" aria-hidden="true">
        {message}
      </span>
    </p>
  );
}
