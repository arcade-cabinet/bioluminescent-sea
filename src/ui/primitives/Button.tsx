import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import type { ButtonHTMLAttributes } from "react";
import { forwardRef } from "react";
import { cn } from "@/lib/utils";

/**
 * Buttons in the trench. Identity rule: no hard rectangular borders
 * on dark surfaces. Primary CTA is a luminous mint pill — the only
 * solid mint shape on screen at any given time. Ghost/outline use a
 * soft hairline that fades on hover into a glow ring; nothing reads
 * like a "Submit" button on a form. Type is small-caps Spectral
 * with chart-maker tracking.
 */
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full font-medium uppercase tracking-[0.18em] transition-all outline-none focus-visible:ring-2 focus-visible:ring-glow/60 focus-visible:ring-offset-2 focus-visible:ring-offset-bg disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        // The only solid-mint surface on the whole game. Reserved for
        // a single primary action per screen (Begin Dive, Dive Again).
        primary:
          "bg-glow text-bg shadow-[0_0_28px_rgba(107,230,193,0.45),0_0_56px_rgba(107,230,193,0.18)] hover:bg-glow/90 hover:shadow-[0_0_36px_rgba(107,230,193,0.55),0_0_72px_rgba(107,230,193,0.25)] active:scale-[0.98]",
        // Ghost — text + soft hairline that lifts to a glow on hover.
        // Used for secondary actions where chrome should melt away
        // until you focus on it.
        ghost:
          "bg-transparent text-fg-muted border border-transparent hover:text-glow hover:shadow-[0_0_18px_rgba(107,230,193,0.25)] active:scale-[0.98]",
        // Outline — for inline secondary actions in dialogs. Hairline
        // mint, never a solid box.
        outline:
          "bg-transparent text-fg border border-glow/25 hover:border-glow/65 hover:text-glow hover:shadow-[0_0_22px_rgba(107,230,193,0.22)] active:scale-[0.98]",
        // Danger — warm-red hairline. Used by the Reset/Abandon
        // controls in the drydock. Same shape language as outline.
        danger:
          "bg-transparent text-warn border border-warn/45 hover:border-warn/80 hover:shadow-[0_0_22px_rgba(255,107,107,0.25)]",
      },
      size: {
        sm: "h-9 px-4 text-[0.72rem]",
        md: "h-11 px-6 text-[0.78rem]",
        lg: "h-14 px-9 text-[0.92rem]",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  },
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        ref={ref}
        type={asChild ? undefined : (props.type ?? "button")}
        className={cn(buttonVariants({ variant, size }), className)}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";

export { buttonVariants };
