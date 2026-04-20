export interface ThresholdInsight {
  title: string;
  status: "pass" | "warn" | "neutral";
  value: string;
  detail: string;
}

export function zone2Insight(zone2Pct: number | null): ThresholdInsight {
  if (zone2Pct === null) {
    return {
      title: "Zone 2 discipline",
      status: "neutral",
      value: "No running data",
      detail: "Need workouts with heart-rate data to evaluate Zone 2 distribution."
    };
  }

  return zone2Pct >= 70
    ? {
        title: "Zone 2 discipline",
        status: "pass",
        value: `${zone2Pct.toFixed(0)}%`,
        detail: "At or above your 70% target."
      }
    : {
        title: "Zone 2 discipline",
        status: "warn",
        value: `${zone2Pct.toFixed(0)}%`,
        detail: "Below your 70% target for easy aerobic work."
      };
}

export function sleepGoalInsight(avgSleep: number | null, goal: number): ThresholdInsight {
  if (avgSleep === null) {
    return {
      title: "Sleep goal",
      status: "neutral",
      value: "No sleep data",
      detail: "Need nightly sleep sessions to evaluate progress."
    };
  }

  return avgSleep >= goal
    ? {
        title: "Sleep goal",
        status: "pass",
        value: `${avgSleep.toFixed(1)}h`,
        detail: `Meeting or exceeding your ${goal.toFixed(1)}h goal.`
      }
    : {
        title: "Sleep goal",
        status: "warn",
        value: `${avgSleep.toFixed(1)}h`,
        detail: `Below your ${goal.toFixed(1)}h goal.`
      };
}
