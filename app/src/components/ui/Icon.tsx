import type { ButtonHTMLAttributes } from "react";
import { joinClassNames } from "@/lib/joinClassNames";

/**
 * The single 16px icon set of the product (v3 noir): filled paths with
 * rounded terminals, currentColor, one stroke language.
 * sourceRef: ui-design/returns (accepted Claude Design exports).
 */

type IconProps = {
  className?: string;
};

/** Arrow pointing right; rotate via the direction prop for deltas. */
export function IconArrow({
  className,
  direction = "right",
}: IconProps & { direction?: "right" | "upRight" | "downRight" }) {
  const rotation =
    direction === "upRight"
      ? "rotate(-45 8 8)"
      : direction === "downRight"
        ? "rotate(45 8 8)"
        : undefined;
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <path
        transform={rotation}
        d="M8.36328 3.36334C8.71475 3.01186 9.28525 3.01186 9.63672 3.36334L13.6367 7.36334C13.9882 7.71481 13.9882 8.28531 13.6367 8.63677L9.63672 12.6368C9.28526 12.9882 8.71474 12.9882 8.36328 12.6368C8.01182 12.2853 8.01184 11.7148 8.36328 11.3633L10.8262 8.90044H3C2.50297 8.90044 2.09965 8.49708 2.09961 8.00005C2.09961 7.503 2.50294 7.09966 3 7.09966H10.8262L8.36328 4.63677C8.01182 4.28531 8.01184 3.71481 8.36328 3.36334Z"
        fill="currentColor"
      />
    </svg>
  );
}

/** Chevron pointing down; the accordion header rotates it 180deg when open. */
export function IconChevron({
  className,
  direction = "down",
}: IconProps & { direction?: "down" | "right" }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <path
        transform={direction === "right" ? "rotate(-90 8 8)" : undefined}
        d="M11.363 6.363a.9.9 0 0 1 1.274 1.274l-4 4a.9.9 0 0 1-1.274 0l-4-4a.9.9 0 0 1 1.274-1.274L8 9.727l3.363-3.364Z"
        fill="currentColor"
      />
    </svg>
  );
}

export function IconCopy({ className }: IconProps) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <path
        d="M6.4 4V3.2c0-.7.6-1.3 1.3-1.3h5.1c.7 0 1.3.6 1.3 1.3v5.1c0 .7-.6 1.3-1.3 1.3h-.9"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <rect
        x="2"
        y="6.1"
        width="7.9"
        height="7.9"
        rx="1.6"
        stroke="currentColor"
        strokeWidth="1.6"
      />
    </svg>
  );
}

export function IconCheck({ className }: IconProps) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <path
        d="M3.2 8.6l3.2 3.2 6.4-7"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function IconClose({ className }: IconProps) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <path
        d="M4.2 4.2l7.6 7.6M11.8 4.2l-7.6 7.6"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function IconLink({ className }: IconProps) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <path
        d="M6.8 9.2l2.4-2.4M7.6 4.7l1.1-1.1a2.62 2.62 0 0 1 3.7 3.7l-1.1 1.1M8.4 11.3l-1.1 1.1a2.62 2.62 0 0 1-3.7-3.7l1.1-1.1"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function IconPlay({ className }: IconProps) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <path
        d="M5.6 3.9v8.2c0 .72.79 1.16 1.4.78l6.5-4.1a.92.92 0 0 0 0-1.56L7 3.12c-.61-.38-1.4.06-1.4.78Z"
        fill="currentColor"
      />
    </svg>
  );
}

export function IconPause({ className }: IconProps) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <rect x="4.2" y="3.2" width="2.6" height="9.6" rx="1.3" fill="currentColor" />
      <rect x="9.2" y="3.2" width="2.6" height="9.6" rx="1.3" fill="currentColor" />
    </svg>
  );
}

type CircleIconButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  ariaLabel: string;
  /** Lift reads one step above raised panels; elevated sits on cards. */
  surface?: "elevated" | "lift";
};

/** A standalone icon never sits bare: a 32px circle on a raised surface. */
export function CircleIconButton({
  ariaLabel,
  surface = "elevated",
  className,
  type = "button",
  ...buttonProps
}: CircleIconButtonProps) {
  return (
    <button
      {...buttonProps}
      type={type}
      aria-label={ariaLabel}
      className={joinClassNames(
        "transition-press focus-ring inline-flex size-8 flex-none cursor-pointer items-center justify-center rounded-full border-0 text-ink hover:brightness-130 active:scale-97",
        surface === "lift" ? "bg-lift" : "bg-elevated",
        className,
      )}
    />
  );
}

type CircleIconLinkProps = {
  href: string;
  ariaLabel: string;
  surface?: "elevated" | "lift";
  children: React.ReactNode;
};

/** External-link twin of CircleIconButton (explorer links). */
export function CircleIconLink({
  href,
  ariaLabel,
  surface = "elevated",
  children,
}: CircleIconLinkProps) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      aria-label={ariaLabel}
      className={joinClassNames(
        "transition-press focus-ring inline-flex size-8 flex-none items-center justify-center rounded-full text-ink no-underline hover:brightness-130",
        surface === "lift" ? "bg-lift" : "bg-elevated",
      )}
    >
      {children}
    </a>
  );
}
