interface ProgressProps {
  value: number;
  label?: string;
}

export function Progress({ value, label }: ProgressProps) {
  const clamped = Math.max(0, Math.min(100, value));

  return (
    <div className="flex flex-col gap-1">
      {label ? <span className="text-xs font-medium text-slate-600">{label}</span> : null}
      <div className="h-2 w-full rounded-full bg-slate-200">
        <div
          className="h-2 rounded-full bg-gradient-to-r from-board-mint to-board-sky transition-all"
          style={{ width: `${clamped}%` }}
        />
      </div>
    </div>
  );
}
