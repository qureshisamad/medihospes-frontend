/** Reusable input component following the design system. */

import { InputHTMLAttributes, forwardRef } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, className = "", id, ...props }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, "-");
    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label
            htmlFor={inputId}
            className="text-sm font-medium text-neutral-700"
          >
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={
            "h-12 rounded-lg border px-3 text-sm transition-colors " +
            "placeholder:text-neutral-500 focus:outline-none focus:ring-2 " +
            (error
              ? "border-danger-500 focus:ring-danger-500/40"
              : "border-neutral-300 focus:border-primary-500 focus:ring-primary-500/40") +
            " " +
            className
          }
          {...props}
        />
        {error && (
          <p className="text-xs text-danger-500">{error}</p>
        )}
      </div>
    );
  }
);

Input.displayName = "Input";
export default Input;
