import type { ReactNode } from "react";
import { SurfaceCard } from "@/components/ui/SurfaceCard";
import { MascotDribble } from "@/components/ui/MascotDribble";

type EmptyStateProps = {
  /** One sentence; the motif and the action do the rest. */
  message: string;
  /** One action: a link or button leading somewhere useful. */
  action?: ReactNode;
};

/** Designed empty state: the mascot motif, one sentence, one action. */
export function EmptyState({ message, action }: EmptyStateProps) {
  return (
    <SurfaceCard className="flex animate-card-in flex-col items-center gap-4 p-8 text-center">
      <MascotDribble />
      <p className="m-0 text-sm text-ink-muted">{message}</p>
      {action ?? null}
    </SurfaceCard>
  );
}
