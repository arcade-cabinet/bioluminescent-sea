import type { InputHTMLAttributes } from "react";
import { forwardRef } from "react";
import { cn } from "@/lib/utils";

/**
 * Chart-line input. No boxy field, no fill — just a soft mint
 * underline that brightens on focus. Type sits on the water like
 * the rest of the chrome.
 */
export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        "h-11 w-full bg-transparent px-2 text-center font-body text-base italic text-fg outline-none border-0 border-b border-glow/35 transition-all placeholder:text-fg-muted/60 focus:border-glow focus:shadow-[0_4px_18px_-6px_rgba(107,230,193,0.55)]",
        className,
      )}
      style={{ fontFamily: "var(--font-body)", fontWeight: 400 }}
      {...props}
    />
  ),
);
Input.displayName = "Input";
