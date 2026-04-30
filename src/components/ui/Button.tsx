/** Reusable button component following the design system. */

import { ButtonHTMLAttributes, forwardRef } from "react";

type Variant = "primary" | "secondary" | "danger" | "ghost";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  loading?: boolean;
}

const base =
  "inline-flex items-center justify-center gap-2 rounded-xl font-medium " +
  "transition-colors duration-150 focus:outline-none focus:ring-2 " +
  "focus:ring-primary-500/40 disabled:opacity-50 disabled:cursor-not-allowed " +
  "min-h-[48px] px-6 py-3 text-sm";

const variants: Record<Variant, string> = {
  primary: "bg-primary-500 text-white hover:bg-primary-600 active:bg-primary-700",
  secondary:
    "bg-white border border-primary-500 text-primary-600 hover:bg-primary-50",
  danger: "bg-danger-500 text-white hover:bg-red-600",
  ghost: "text-neutral-700 hover:bg-neutral-100",
};

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "primary", loading, children, className = "", ...props }, ref) => (
    <button
      ref={ref}
      className={`${base} ${variants[variant]} ${className}`}
      disabled={loading || props.disabled}
      {...props}
    >
      {loading && (
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
      )}
      {children}
    </button>
  )
);

Button.displayName = "Button";
export default Button;
