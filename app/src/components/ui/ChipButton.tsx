import type { ButtonHTMLAttributes } from "react";
import { joinClassNames } from "@/lib/joinClassNames";

type ChipButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  isActive: boolean;
};

/** Selectable chip: ticket filters, replay match picker, speed control. */
export function ChipButton({
  isActive,
  className,
  type = "button",
  ...buttonProps
}: ChipButtonProps) {
  return (
    <button
      {...buttonProps}
      type={type}
      aria-pressed={isActive}
      className={joinClassNames(
        "transition-press focus-ring inline-flex h-11 cursor-pointer items-center gap-2 rounded-sm border px-4 text-sm font-medium active:scale-98",
        isActive
          ? "border-accent bg-accent-soft text-accent"
          : "border-border bg-elevated text-ink-muted hover:border-ink-faint",
        className,
      )}
    />
  );
}
