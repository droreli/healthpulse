export function formatHours(value: number | null | undefined): string {
  if (typeof value !== "number") {
    return "—";
  }
  return `${value.toFixed(1)}h`;
}

export function formatHoursFromMinutes(value: number | null | undefined): string {
  if (typeof value !== "number") {
    return "—";
  }

  return `${(value / 60).toFixed(1)}h`;
}

export function formatDurationMinutes(value: number | null | undefined): string {
  if (typeof value !== "number") {
    return "—";
  }

  const rounded = Math.round(value);
  const hours = Math.floor(rounded / 60);
  const minutes = rounded % 60;

  if (hours === 0) {
    return `${minutes}m`;
  }

  return minutes === 0 ? `${hours}h` : `${hours}h ${minutes}m`;
}

export function formatMinutes(value: number | null | undefined): string {
  if (typeof value !== "number") {
    return "—";
  }

  return `${Math.round(value)}m`;
}

export function formatPercent(value: number | null | undefined): string {
  if (typeof value !== "number") {
    return "—";
  }
  return `${value.toFixed(1)}%`;
}

export function formatNumber(value: number | null | undefined, digits = 1): string {
  if (typeof value !== "number") {
    return "—";
  }
  return value.toFixed(digits);
}

export function formatDateLabel(value: string): string {
  return value.slice(5);
}
