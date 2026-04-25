import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import type { ButtonHTMLAttributes } from "react";
import { forwardRef } from "react";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md font-medium tracking-[0.02em] transition-all outline-none focus-visible:ring-2 focus-visible:ring-glow/60 focus-visible:ring-offset-2 focus-visible:ring-offset-bg disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        primary:
          "bg-glow text-bg shadow-[0_0_18px_rgba(107,230,193,0.35)] hover:bg-glow/90 active:scale-[0.98]",
        ghost:
          "bg-transparent text-fg border border-fg/25 hover:border-glow/60 hover:text-glow active:scale-[0.98]",
        outline:
          "bg-abyss/40 text-fg border border-deep hover:border-glow/60 hover:text-glow",
        danger:
          "bg-warn/15 text-warn border border-warn/40 hover:bg-warn/25",
      },
      size: {
        sm: "h-9 px-3 text-[0.78rem] uppercase",
        md: "h-10 px-5 text-[0.85rem] uppercase",
        lg: "h-12 px-7 text-[0.95rem] uppercase",
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
