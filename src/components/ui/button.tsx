import { forwardRef, type ButtonHTMLAttributes } from "react";
import clsx from "clsx";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  loading?: boolean;
}

const variantClass: Record<ButtonVariant, string> = {
  primary: "bg-board-mint text-white hover:bg-teal-500",
  secondary: "bg-board-sun text-board-ink hover:bg-yellow-400",
  ghost: "bg-white text-board-ink hover:bg-slate-100 border border-slate-200",
  danger: "bg-board-coral text-white hover:bg-red-500"
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", loading = false, className, children, disabled, ...props },
  ref
) {
  return (
    <button
      ref={ref}
      className={clsx(
        "rounded-2xl px-4 py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60",
        variantClass[variant],
        className
      )}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? "Please wait..." : children}
    </button>
  );
});
