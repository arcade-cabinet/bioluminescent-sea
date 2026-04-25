import type { HTMLAttributes } from "react";
import { forwardRef } from "react";
import { cn } from "@/lib/utils";

/**
 * Luminous-patch surface. The previous boxy Card with hard borders
 * and rectangular shadow read as "SaaS dashboard tile" against the
 * trench. This version paints a soft radial mint wash that fades
 * into the water at the edges — a glowing patch, not a frame.
 *
 * Borders are off by default. Hover lifts the inner glow without
 * introducing a hard outline. The `accent` prop tints the radial
 * wash so each mode card glows in its own colour.
 */
interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /** Hex string used as the radial-wash tint. Defaults to mint glow. */
  accent?: string;
  /** Suppress the radial wash for HUD/details surfaces that just need a panel feel. */
  flat?: boolean;
}

export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ className, accent = "#6be6c1", flat, style, ...props }, ref) => {
    const wash = flat
      ? undefined
      : `radial-gradient(120% 90% at 50% 0%, ${accent}1f 0%, ${accent}0d 35%, transparent 70%)`;
    return (
      <div
        ref={ref}
        className={cn(
          // No border, no hard rounding — just soft text-on-water.
          // The inner shadow keeps content readable against the
          // brightest part of the wash.
          "relative isolate text-fg",
          className,
        )}
        style={{
          backgroundImage: wash,
          ...style,
        }}
        {...props}
      />
    );
  },
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
        "bs-display text-2xl font-medium tracking-wide text-glow",
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
 * Four delicate corner ticks — kept for components that genuinely
 * want a chartmaker's frame (the seed picker dialog). Mode cards no
 * longer use them; their luminous wash carries the identity instead
 * of a literal frame.
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
