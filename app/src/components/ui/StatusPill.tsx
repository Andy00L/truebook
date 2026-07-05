import type { ReactNode } from "react";
import { joinClassNames } from "@/lib/joinClassNames";

export type StatusPillVariant =
  | "live"
  | "neutral"
  | "amber"
  | "accent"
  | "danger";

const PILL_VARIANT_CLASSES: Record<StatusPillVariant, string> = {
  live: "bg-accent-soft text-accent",
  neutral: "border border-border text-ink-muted",
  amber: "border border-amber text-amber",
  accent: "border border-accent text-accent",
  danger: "border border-danger text-danger",
};

type StatusPillProps = {
  variant: StatusPillVariant;
  /** The pulsing dot marks a live feed; reserved for the live variant. */
  withDot?: boolean;
  children: ReactNode;
};

export function StatusPill({
  variant,
  withDot = false,
  children,
}: StatusPillProps) {
  return (
    <span
      className={joinClassNames(
        "eyebrow inline-flex h-6 items-center gap-1.5 rounded-sm px-2.5 font-mono",
        PILL_VARIANT_CLASSES[variant],
      )}
    >
      {withDot ? (
        <span
          aria-hidden="true"
          className="size-1.5 animate-live-dot rounded-sm bg-current"
        />
      ) : null}
      {children}
    </span>
  );
}
