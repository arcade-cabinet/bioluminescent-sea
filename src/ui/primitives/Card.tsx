import type { HTMLAttributes } from "react";
import { forwardRef } from "react";
import { cn } from "@/lib/utils";

/**
 * Card surface for the abyssal palette. Subtle abyss background, deep teal
 * stroke, soft inner glow on hover when interactive. Pair with `<CardCorners />`
 * for the cartographer's-chart corner ticks shown on landing mode cards.
 */
export const Card = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "relative rounded-lg border border-deep/80 bg-abyss/80 text-fg shadow-[0_24px_60px_rgba(5,10,20,0.5)] backdrop-blur-sm",
        className,
      )}
      {...props}
    />
  ),
);
Card.displayName = "Card";

export const CardHeader = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("flex flex-col gap-1 p-5", className)} {...props} />
  ),
);
CardHeader.displayName = "CardHeader";

export const CardTitle = forwardRef<HTMLHeadingElement, HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h3
      ref={ref}
      className={cn(
        "bs-display text-2xl font-medium tracking-tight text-glow",
        className,
      )}
      {...props}
    />
  ),
);
CardTitle.displayName = "CardTitle";

export const CardDescription = forwardRef<
  HTMLParagraphElement,
  HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn("text-sm leading-relaxed text-fg-muted", className)}
    {...props}
  />
));
CardDescription.displayName = "CardDescription";

export const CardContent = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("p-5 pt-0", className)} {...props} />
  ),
);
CardContent.displayName = "CardContent";

export const CardFooter = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("flex items-center gap-2 p-5 pt-0", className)}
      {...props}
    />
  ),
);
CardFooter.displayName = "CardFooter";

interface CardCornersProps {
  /** Hex string painting the four corner ticks. Defaults to mint glow. */
  color?: string;
}

/**
 * Four cartographer's-chart corner markers — absolutely positioned inside
 * a `relative` parent. Pure decoration; aria-hidden.
 */
export function CardCorners({ color = "var(--color-glow)" }: CardCornersProps) {
  const style = { color };
  return (
    <span aria-hidden="true" style={style} className="pointer-events-none">
      <span className="absolute -left-px -top-px block size-2.5 border-l-2 border-t-2 border-current" />
      <span className="absolute -right-px -top-px block size-2.5 border-r-2 border-t-2 border-current" />
      <span className="absolute -bottom-px -left-px block size-2.5 border-b-2 border-l-2 border-current" />
      <span className="absolute -bottom-px -right-px block size-2.5 border-b-2 border-r-2 border-current" />
    </span>
  );
}
