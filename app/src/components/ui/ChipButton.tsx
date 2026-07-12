import type { ButtonHTMLAttributes } from "react";
import { joinClassNames } from "@/lib/joinClassNames";

type ChipButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  isActive: boolean;
};

/** Selectable pill chip: the replay match picker and its kin. */
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
        "transition-press focus-ring inline-flex h-10 cursor-pointer items-center gap-2 rounded-full border-0 px-4 text-sm active:scale-97",
        isActive
          ? "bg-lift font-medium text-ink"
          : "bg-elevated font-normal text-ink-muted hover:brightness-130",
        className,
      )}
    />
  );
}
