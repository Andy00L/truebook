import type { ButtonHTMLAttributes } from "react";
import { joinClassNames } from "@/lib/joinClassNames";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "neutral";
  size?: "md" | "lg";
};

/**
 * The two button faces (v3 noir): the cream pill primary (ink fill, field
 * text: the brightest object on screen is the primary action) and the raised
 * pill secondary. Hover is a brightness shift, press scales 0.97.
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
    ? "cursor-default opacity-40 " +
      (variant === "primary" ? "bg-ink text-field" : "bg-elevated text-ink")
    : variant === "primary"
      ? "cursor-pointer bg-ink text-field hover:brightness-90 active:scale-97"
      : "cursor-pointer bg-elevated text-ink hover:brightness-130 active:scale-97";

  return (
    <button
      {...buttonProps}
      type={type}
      disabled={disabled}
      className={joinClassNames(
        "transition-press focus-ring inline-flex items-center justify-center rounded-full border-0 font-medium",
        size === "lg" ? "h-11 px-5.5 text-base" : "h-10 px-4.5 text-sm",
        variantClasses,
        className,
      )}
    />
  );
}
