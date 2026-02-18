import { forwardRef } from "react";
import type { InputHTMLAttributes } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, id, className = "", ...props }, ref) => {
    const inputId = id ?? label.toLowerCase().replace(/\s+/g, "-");

    return (
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor={inputId}
          className="text-sm font-medium text-slate-300"
        >
          {label}
        </label>
        <input
          ref={ref}
          id={inputId}
          className={`rounded-lg border px-3 py-2 text-sm text-slate-100 outline-none transition-colors placeholder:text-slate-500 ${
            error
              ? "border-red-500 bg-slate-800 focus:border-red-500"
              : "border-slate-700 bg-slate-800 focus:border-blue-500"
          } ${className}`}
          {...props}
        />
        {error && <p className="text-xs text-red-400">{error}</p>}
      </div>
    );
  }
);

Input.displayName = "Input";
