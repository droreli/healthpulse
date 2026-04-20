export default function RecoveryGauge({
  score,
  color,
  label
}: {
  score: number;
  color: string;
  label: string;
}) {
  if (score < 0) {
    return (
      <div className="flex h-52 items-center justify-center rounded-[28px] border border-dashed border-white/10 bg-white/5 text-text-secondary">
        Building baseline
      </div>
    );
  }

  const circumference = 2 * Math.PI * 78;
  const dashOffset = circumference - (score / 100) * circumference;

  return (
    <div className="flex flex-col items-center justify-center rounded-[28px] border border-white/10 bg-white/5 p-6">
      <svg width="220" height="220" viewBox="0 0 220 220">
        <circle cx="110" cy="110" r="78" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="18" />
        <circle
          cx="110"
          cy="110"
          r="78"
          fill="none"
          stroke={color}
          strokeWidth="18"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          transform="rotate(-90 110 110)"
        />
        <text x="110" y="104" textAnchor="middle" fill="white" fontSize="42" fontWeight="600">
          {score}
        </text>
        <text x="110" y="132" textAnchor="middle" fill="#8E8E93" fontSize="14">
          {label}
        </text>
      </svg>
    </div>
  );
}
