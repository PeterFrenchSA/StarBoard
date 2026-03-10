import clsx from "clsx";

type ToastVariant = "success" | "error";

interface ToastProps {
  message: string;
  variant?: ToastVariant;
  className?: string;
}

const toneClass: Record<ToastVariant, string> = {
  success: "border-emerald-200 bg-emerald-50 text-emerald-700",
  error: "border-red-200 bg-red-50 text-red-700"
};

export function Toast({ message, variant = "success", className }: ToastProps) {
  return (
    <div
      role="status"
      className={clsx(
        "animate-toast-in rounded-2xl border px-4 py-3 text-sm font-semibold shadow-lift",
        toneClass[variant],
        className
      )}
    >
      {message}
    </div>
  );
}
