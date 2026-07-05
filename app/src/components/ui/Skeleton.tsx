import type { CSSProperties } from "react";
import { joinClassNames } from "@/lib/joinClassNames";

type SkeletonProps = {
  className?: string;
  /** Stagger sibling skeletons with an animationDelay style. */
  style?: CSSProperties;
};

/** Loading placeholder block; compose it to mirror the final layout. */
export function Skeleton({ className, style }: SkeletonProps) {
  return (
    <div
      aria-hidden="true"
      className={joinClassNames("animate-skeleton rounded-sm bg-elevated", className)}
      style={style}
    />
  );
}
