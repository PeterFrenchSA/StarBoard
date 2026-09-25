import type { HTMLAttributes, ReactNode } from "react";
import clsx from "clsx";

interface CardProps extends HTMLAttributes<HTMLElement> {
  children: ReactNode;
}

export function Card({ children, className, ...props }: CardProps) {
  return (
    <section
      className={clsx("rounded-3xl border border-white/40 bg-white/85 p-5 shadow-lift backdrop-blur", className)}
      {...props}
    >
      {children}
    </section>
  );
}
