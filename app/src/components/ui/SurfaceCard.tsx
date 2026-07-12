import type { HTMLAttributes } from "react";
import { joinClassNames } from "@/lib/joinClassNames";

type SurfaceCardProps = HTMLAttributes<HTMLDivElement> & {
  /** Raised inner panels (proof blocks, receipts) sit one surface up. */
  elevated?: boolean;
};

/**
 * The one card material (v3 noir): borderless, shadowless; elevation is a
 * surface value (field < surface < elevated). Cards are radius 16, inner
 * raised panels radius 12.
 */
export function SurfaceCard({
  elevated = false,
  className,
  ...divProps
}: SurfaceCardProps) {
  return (
    <div
      {...divProps}
      className={joinClassNames(
        elevated ? "rounded-sm bg-elevated" : "rounded-md bg-surface",
        className,
      )}
    />
  );
}
