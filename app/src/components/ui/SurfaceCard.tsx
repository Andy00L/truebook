import type { HTMLAttributes } from "react";
import { joinClassNames } from "@/lib/joinClassNames";

type SurfaceCardProps = HTMLAttributes<HTMLDivElement> & {
  /** Elevated surfaces carry popovers, dialogs, and printed receipts. */
  elevated?: boolean;
};

/** The one graphite card material every TrueBook panel is made of. */
export function SurfaceCard({
  elevated = false,
  className,
  ...divProps
}: SurfaceCardProps) {
  return (
    <div
      {...divProps}
      className={joinClassNames(
        "rounded-md border border-border shadow-card",
        elevated ? "bg-elevated" : "bg-surface",
        className,
      )}
    />
  );
}
