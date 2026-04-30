/** Badge component for shift types, statuses, and roles. */

import type { ShiftType } from "@/lib/types";

type BadgeVariant = "default" | "success" | "warning" | "danger" | "info";

interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  shiftType?: ShiftType;
  className?: string;
}

const variantStyles: Record<BadgeVariant, string> = {
  default: "bg-neutral-100 text-neutral-700",
  success: "bg-success-50 text-success-700",
  warning: "bg-warning-50 text-warning-700",
  danger: "bg-danger-50 text-danger-700",
  info: "bg-info-50 text-info-500",
};

export default function Badge({
  children,
  variant = "default",
  shiftType,
  className = "",
}: BadgeProps) {
  const shiftClass = shiftType ? `shift-${shiftType}` : "";
  const style = shiftType ? shiftClass : variantStyles[variant];

  return (
    <span
      className={
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium " +
        style +
        " " +
        className
      }
    >
      {children}
    </span>
  );
}
