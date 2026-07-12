import type { ButtonHTMLAttributes, ReactNode } from "react";
import { joinClassNames } from "@/lib/joinClassNames";

type ButtonFace = "primary" | "neutral";
type ButtonSize = "md" | "lg";

/**
 * The two button faces (v3 noir): the cream pill primary (ink fill, field
 * text: the brightest object on screen is the primary action) and the raised
 * pill secondary. Hover is a brightness shift, press scales 0.97. Button and
 * ButtonLink share this one recipe so anchors never drift from buttons.
 */
function buttonFaceClasses(
  variant: ButtonFace,
  size: ButtonSize,
  disabled: boolean,
  className?: string,
): string {
  const variantClasses = disabled
    ? "cursor-default opacity-40 " +
      (variant === "primary" ? "bg-ink text-field" : "bg-elevated text-ink")
    : variant === "primary"
      ? "cursor-pointer bg-ink text-field hover:brightness-90 active:scale-97"
      : "cursor-pointer bg-elevated text-ink hover:brightness-130 active:scale-97";

  return joinClassNames(
    "transition-press focus-ring inline-flex items-center justify-center rounded-full border-0 font-medium",
    size === "lg" ? "h-11 px-5.5 text-base" : "h-10 px-4.5 text-sm",
    variantClasses,
    className,
  );
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonFace;
  size?: ButtonSize;
};

export function Button({
  variant = "neutral",
  size = "md",
  className,
  type = "button",
  disabled,
  ...buttonProps
}: ButtonProps) {
  return (
    <button
      {...buttonProps}
      type={type}
      disabled={disabled}
      className={buttonFaceClasses(variant, size, disabled === true, className)}
    />
  );
}

type ButtonLinkProps = {
  href: string;
  variant?: ButtonFace;
  size?: ButtonSize;
  className?: string;
  /** External targets open a new tab with rel noreferrer. */
  external?: boolean;
  children: ReactNode;
};

/** Anchor twin of Button, for navigations that must look like actions. */
export function ButtonLink({
  href,
  variant = "neutral",
  size = "md",
  className,
  external = false,
  children,
}: ButtonLinkProps) {
  return (
    <a
      href={href}
      target={external ? "_blank" : undefined}
      rel={external ? "noreferrer" : undefined}
      className={joinClassNames(
        buttonFaceClasses(variant, size, false),
        "no-underline",
        className,
      )}
    >
      {children}
    </a>
  );
}
