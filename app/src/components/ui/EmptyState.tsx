import type { ReactNode } from "react";
import { useId } from "react";
import { SurfaceCard } from "@/components/ui/SurfaceCard";

/** The empty-state motif (v3 noir): a faint dot-matrix block, nothing more. */
function DotMotif() {
  const motifId = useId().replace(/[^a-zA-Z0-9-]/g, "");
  return (
    <svg width="88" height="40" aria-hidden="true" className="inline-block">
      <defs>
        <pattern
          id={`${motifId}-dots`}
          width="8"
          height="8"
          patternUnits="userSpaceOnUse"
        >
          <circle cx="1.5" cy="1.5" r="1.5" fill="var(--color-ink-faint)" />
        </pattern>
      </defs>
      <rect
        width="88"
        height="40"
        fill={`url(#${motifId}-dots)`}
        opacity="0.55"
      />
    </svg>
  );
}

type EmptyStateProps = {
  /** One sentence; the motif and the action do the rest. */
  message: string;
  /** One action: a link or button leading somewhere useful. */
  action?: ReactNode;
};

/** Designed empty state: the dot motif, one sentence, one action. */
export function EmptyState({ message, action }: EmptyStateProps) {
  return (
    <SurfaceCard className="flex animate-card-in flex-col items-center gap-4 px-6 py-12 text-center">
      <DotMotif />
      <p className="m-0 text-sm text-ink-muted">{message}</p>
      {action ?? null}
    </SurfaceCard>
  );
}
