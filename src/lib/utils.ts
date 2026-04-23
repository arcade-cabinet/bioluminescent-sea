/**
 * Minimal className join — replaces the cabinet's clsx + tailwind-merge shim,
 * which we don't need since this repo uses CSS custom properties + inline
 * styles instead of Tailwind utility classes.
 */
export function cn(...inputs: Array<string | false | null | undefined>): string {
  return inputs.filter(Boolean).join(" ");
}
