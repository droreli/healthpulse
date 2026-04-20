import type { HaeFileType, ParsedHaeFile, ParsedMetricSeries, ParsedWorkoutRecord } from "./types.js";

export function parseHaeFileContents(contents: string, fileType: HaeFileType): ParsedHaeFile {
  const parsed = JSON.parse(contents) as { data?: Record<string, unknown> };

  if (fileType === "metrics") {
    return {
      type: "metrics",
      metrics: extractMetrics(parsed.data?.metrics)
    };
  }

  return {
    type: "workouts",
    workouts: extractWorkouts(parsed.data?.workouts)
  };
}

function extractMetrics(input: unknown): ParsedMetricSeries[] {
  if (!Array.isArray(input)) {
    throw new Error("Invalid HAE metrics payload: data.metrics must be an array");
  }

  return input.flatMap((item) => {
    if (typeof item !== "object" || item === null) {
      return [];
    }

    const value = item as Record<string, unknown>;
    if (typeof value.name !== "string" || typeof value.units !== "string" || !Array.isArray(value.data)) {
      return [];
    }

    return [
      {
        name: value.name,
        units: value.units,
        data: value.data.filter((entry): entry is Record<string, unknown> => typeof entry === "object" && entry !== null)
      }
    ];
  });
}

function extractWorkouts(input: unknown): ParsedWorkoutRecord[] {
  if (!Array.isArray(input)) {
    throw new Error("Invalid HAE workouts payload: data.workouts must be an array");
  }

  return input.filter((item): item is ParsedWorkoutRecord => typeof item === "object" && item !== null);
}
