const zoneColors = ["#8E8E93", "#30D158", "#64D2FF", "#FF9F0A", "#FF453A"];

export default function HRZoneBar({
  zones
}: {
  zones: Array<{ label: string; seconds: number }>;
}) {
  const total = zones.reduce((sum, zone) => sum + zone.seconds, 0) || 1;

  if (zones.every((zone) => zone.seconds === 0)) {
    return (
      <div className="rounded-2xl border border-dashed border-white/10 bg-white/5 px-4 py-3 text-sm text-text-secondary">
        Heart-rate zone data was not captured for this workout.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex h-4 overflow-hidden rounded-full bg-white/10">
        {zones.map((zone, index) => (
          <div
            key={zone.label}
            style={{ width: `${(zone.seconds / total) * 100}%`, backgroundColor: zoneColors[index] }}
          />
        ))}
      </div>
      <div className="grid grid-cols-5 gap-2 text-xs text-text-secondary">
        {zones.map((zone, index) => (
          <div key={zone.label}>
            <span className="mr-2 inline-block h-2 w-2 rounded-full" style={{ backgroundColor: zoneColors[index] }} />
            {zone.label}: {Math.round(zone.seconds / 60)}m
          </div>
        ))}
      </div>
    </div>
  );
}
