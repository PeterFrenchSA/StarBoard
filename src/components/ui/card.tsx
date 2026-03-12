import type { CSSProperties, ReactNode } from "react";
import clsx from "clsx";

interface CardProps {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}

export function Card({ children, className, style }: CardProps) {
  return (
    <section
      className={clsx("rounded-3xl border border-white/40 bg-white/85 p-5 shadow-lift backdrop-blur", className)}
      style={style}
    >
      {children}
    </section>
  );
}
