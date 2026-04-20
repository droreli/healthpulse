import { differenceInHours, format, isValid, parse, startOfDay, subDays } from "date-fns";

const HAE_DATE_TIME_FORMAT = "yyyy-MM-dd HH:mm:ss xx";

export function parseHaeDate(raw: string): Date | null {
  const parsed = parse(raw, HAE_DATE_TIME_FORMAT, new Date());
  return isValid(parsed) ? parsed : null;
}

export function rawDateToLocalIso(raw: string): string | null {
  const match = raw.match(
    /^(\d{4}-\d{2}-\d{2})(?: (\d{2}:\d{2}:\d{2}))?(?: ([+-]\d{2})(\d{2}))?$/
  );

  if (!match) {
    return null;
  }

  const [, datePart, timePart = "00:00:00", offsetHours, offsetMinutes] = match;
  if (!offsetHours || !offsetMinutes) {
    return `${datePart}T${timePart}`;
  }

  return `${datePart}T${timePart}${offsetHours}:${offsetMinutes}`;
}

export function rawDateToUtcIso(raw: string): string | null {
  const parsed = parseHaeDate(raw);
  return parsed ? parsed.toISOString() : null;
}

export function rawDateOnlyToUtcIso(raw: string): string {
  return `${raw}T00:00:00.000Z`;
}

export function toLocalDateKey(isoOrDate: string): string {
  return isoOrDate.slice(0, 10);
}

export function todayKey(): string {
  return format(new Date(), "yyyy-MM-dd");
}

export function toWeekLabel(date: Date): string {
  return format(date, "yyyy-'W'II");
}

export function rangeStart(range: "1d" | "7d" | "14d" | "30d" | "90d" | "180d" | "1y"): Date {
  const days =
    range === "1d"
      ? 0
      : range === "7d"
        ? 6
        : range === "14d"
          ? 13
          : range === "30d"
            ? 29
            : range === "90d"
              ? 89
              : range === "180d"
                ? 179
                : 364;
  return startOfDay(subDays(new Date(), days));
}

export function rangeDays(range: "1d" | "7d" | "14d" | "30d" | "90d" | "180d" | "1y"): number {
  return range === "1d"
    ? 1
    : range === "7d"
      ? 7
      : range === "14d"
        ? 14
        : range === "30d"
          ? 30
          : range === "90d"
            ? 90
            : range === "180d"
              ? 180
              : 365;
}

export function isSyncStale(lastSyncedAt: string | null, staleHours: number): boolean {
  if (!lastSyncedAt) {
    return true;
  }

  return differenceInHours(new Date(), new Date(lastSyncedAt)) >= staleHours;
}
