/** Reusable card component following the design system. */

import { HTMLAttributes } from "react";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  padding?: "sm" | "md" | "lg";
}

const paddings = {
  sm: "p-3",
  md: "p-4 md:p-6",
  lg: "p-6 md:p-8",
};

export default function Card({
  padding = "md",
  className = "",
  children,
  ...props
}: CardProps) {
  return (
    <div
      className={
        "rounded-xl border border-neutral-200 bg-white shadow-[0_1px_3px_rgba(0,0,0,0.05)] " +
        paddings[padding] +
        " " +
        className
      }
      {...props}
    >
      {children}
    </div>
  );
}
