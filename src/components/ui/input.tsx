import type { InputHTMLAttributes } from "react";
import clsx from "clsx";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  hint?: string;
}

export function Input({ label, hint, className, id, ...props }: InputProps) {
  const htmlId = id ?? label.toLowerCase().replace(/[^a-z0-9]+/g, "-");

  return (
    <label htmlFor={htmlId} className="flex flex-col gap-1 text-sm font-medium text-board-ink">
      {label}
      <input
        id={htmlId}
        className={clsx(
          "h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none ring-board-mint transition focus:ring-2",
          className
        )}
        {...props}
      />
      {hint ? <span className="text-xs text-slate-500">{hint}</span> : null}
    </label>
  );
}
