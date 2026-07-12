import { SurfaceCard } from "@/components/ui/SurfaceCard";
import { Skeleton } from "@/components/ui/Skeleton";
import { MarketGrid } from "@/components/ui/MarketGrid";

/** Loading state mirroring the final layout: header plus market cards. */
export function MatchSkeleton() {
  return (
    <div aria-hidden="true">
      <SurfaceCard className="flex items-start justify-between gap-6 p-6">
        <div>
          <Skeleton className="h-3 w-50" />
          <Skeleton className="mt-3.5 h-5.5 w-62" />
          <Skeleton className="mt-3 h-3 w-40" />
        </div>
        <div className="flex flex-col items-end gap-3.5">
          <Skeleton className="h-7.5 w-28" />
          <Skeleton className="h-6.5 w-24 rounded-full" />
        </div>
      </SurfaceCard>
      <MarketGrid>
        <SurfaceCard className="p-5">
          <Skeleton className="h-3 w-35" />
          <div className="mt-4 grid grid-cols-2 gap-3">
            <Skeleton className="h-29.5" style={{ animationDelay: "120ms" }} />
            <Skeleton className="h-29.5" style={{ animationDelay: "120ms" }} />
          </div>
        </SurfaceCard>
      </MarketGrid>
    </div>
  );
}
