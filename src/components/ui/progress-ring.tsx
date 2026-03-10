interface ProgressRingProps {
  value: number;
  label: string;
  subtitle?: string;
  size?: number;
}

export function ProgressRing({ value, label, subtitle, size = 140 }: ProgressRingProps) {
  const clamped = Math.max(0, Math.min(100, value));
  const stroke = 10;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (clamped / 100) * circumference;

  return (
    <div className="flex flex-col items-center gap-2">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="drop-shadow-sm">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#e2e8f0"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#29c7b8"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          className="transition-all duration-500"
        />
        <text
          x="50%"
          y="48%"
          dominantBaseline="middle"
          textAnchor="middle"
          className="fill-board-ink text-xl font-black"
        >
          {clamped}%
        </text>
      </svg>
      <p className="text-sm font-semibold text-board-ink">{label}</p>
      {subtitle ? <p className="text-xs text-slate-500">{subtitle}</p> : null}
    </div>
  );
}
