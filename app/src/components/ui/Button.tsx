import type { ButtonHTMLAttributes } from "react";
import { joinClassNames } from "@/lib/joinClassNames";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "neutral";
  size?: "md" | "lg";
};

/**
 * The two button faces of the product: accent-green primary (one per view)
 * and graphite neutral. Disabled collapses both to a muted elevated block.
 */
export function Button({
  variant = "neutral",
  size = "md",
  className,
  type = "button",
  disabled,
  ...buttonProps
}: ButtonProps) {
  const variantClasses = disabled
    ? "cursor-not-allowed border-border bg-elevated text-ink-faint"
    : variant === "primary"
      ? "cursor-pointer border-accent bg-accent text-on-accent active:scale-98"
      : "cursor-pointer border-border bg-elevated text-ink hover:border-ink-faint active:scale-98";

  return (
    <button
      {...buttonProps}
      type={type}
      disabled={disabled}
      className={joinClassNames(
        "transition-press focus-ring inline-flex items-center justify-center rounded-md border px-5 text-base font-semibold",
        size === "lg" ? "h-12" : "h-11",
        variantClasses,
        className,
      )}
    />
  );
}
