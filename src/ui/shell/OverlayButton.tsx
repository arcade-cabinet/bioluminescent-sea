import type { ButtonHTMLAttributes, CSSProperties, ReactNode } from "react";

interface OverlayButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "ghost";
  children: ReactNode;
}

/**
 * Identity-forward button for overlay screens. Primary variant carries the
 * bioluminescent mint glow; ghost variant is a hollow chip for secondary
 * actions like "Quit" or "Settings".
 */
export function OverlayButton({
  variant = "primary",
  style,
  children,
  ...rest
}: OverlayButtonProps) {
  const base: CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "0.85rem 1.5rem",
    fontFamily: "var(--font-body)",
    fontWeight: 500,
    fontSize: "0.95rem",
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    borderRadius: 6,
    cursor: "pointer",
    transition: "box-shadow 0.2s ease, transform 0.1s ease",
    pointerEvents: "auto",
    ...style,
  };

  const variantStyle: CSSProperties =
    variant === "primary"
      ? {
          background: "var(--color-glow)",
          color: "var(--color-bg)",
          border: "1px solid var(--color-glow)",
          boxShadow: "0 0 20px rgba(107, 230, 193, 0.35)",
        }
      : {
          background: "transparent",
          color: "var(--color-fg)",
          border: "1px solid rgba(217, 242, 236, 0.25)",
        };

  return (
    <button type="button" style={{ ...base, ...variantStyle }} {...rest}>
      {children}
    </button>
  );
}
