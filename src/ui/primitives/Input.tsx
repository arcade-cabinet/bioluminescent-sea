import type { InputHTMLAttributes } from "react";
import { forwardRef } from "react";
import { cn } from "@/lib/utils";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        "h-11 w-full rounded-md border border-glow/60 bg-bg/60 px-4 text-center font-body text-base text-fg outline-none transition-shadow placeholder:text-fg-muted/60 focus:border-glow focus:shadow-[0_0_18px_rgba(107,230,193,0.35)]",
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = "Input";
