import type { CSSProperties, ReactNode } from "react";
import { joinClassNames } from "@/lib/joinClassNames";

/**
 * The proof pill: the product's entire verdict language (v3 noir). An 11px
 * uppercase pill, 1px border, tinted fill. Live carries a 6px core dot with
 * two staggered ping halos. No seals, no stamps, anywhere.
 */

export type StatusPillVariant =
  | "live"
  | "neutral"
  | "amber"
  | "accent"
  | "danger";

const PILL_VARIANT_CLASSES: Record<StatusPillVariant, string> = {
  live: "border-accent bg-accent-soft text-accent",
  neutral: "border-border text-ink-muted",
  amber: "border-amber bg-amber-soft text-amber",
  accent: "border-accent bg-accent-soft text-accent",
  danger: "border-danger bg-danger-soft text-danger",
};

type StatusPillProps = {
  variant: StatusPillVariant;
  /** The ping dot marks a live feed; reserved for the live variant. */
  withDot?: boolean;
  /** Fade-scale entrance (0.96 to 1, 250ms); the verdict lands last. */
  animateIn?: boolean;
  /** Entrance delay so the pill arrives after the numbers settle. */
  animateInDelayMs?: number;
  children: ReactNode;
};

export function StatusPill({
  variant,
  withDot = false,
  animateIn = false,
  animateInDelayMs = 0,
  children,
}: StatusPillProps) {
  const animationStyle: CSSProperties | undefined = animateIn
    ? { animationDelay: `${animateInDelayMs}ms` }
    : undefined;
  return (
    <span
      className={joinClassNames(
        "eyebrow inline-flex items-center gap-2 rounded-full border px-3 py-1 font-medium",
        PILL_VARIANT_CLASSES[variant],
        animateIn && "animate-pill-in",
      )}
      style={animationStyle}
    >
      {withDot ? (
        <span aria-hidden="true" className="relative size-1.5 flex-none">
          <span className="absolute inset-0 rounded-full bg-current" />
          <span className="absolute inset-0 animate-ping-halo rounded-full bg-current" />
          <span
            className="absolute inset-0 animate-ping-halo rounded-full bg-current"
            style={{ animationDelay: "1.1s" }}
          />
        </span>
      ) : null}
      {children}
    </span>
  );
}
