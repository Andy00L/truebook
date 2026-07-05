import { SurfaceCard } from "@/components/ui/SurfaceCard";
import { Skeleton } from "@/components/ui/Skeleton";
import { MarketGrid } from "@/components/ui/MarketGrid";

/** Loading state mirroring the final layout: header plus three market cards. */
export function MatchSkeleton() {
  return (
    <div aria-hidden="true">
      <SurfaceCard className="p-5">
        <Skeleton className="h-3 w-55" />
        <div className="mt-4 flex items-center justify-between gap-4">
          <Skeleton className="h-8 w-85 max-w-3/5" />
          <Skeleton className="h-8 w-35" />
        </div>
      </SurfaceCard>
      <MarketGrid>
        {[0, 1, 2].map((cardIndex) => (
          <SurfaceCard key={cardIndex} className="p-5">
            <Skeleton
              className="h-3 w-30"
              style={{ animationDelay: `${cardIndex * 120}ms` }}
            />
            <div className="mt-3.5 flex gap-2">
              {[0, 1, 2].slice(0, cardIndex === 0 ? 3 : 2).map((cellIndex) => (
                <Skeleton
                  key={cellIndex}
                  className="h-18 flex-1"
                  style={{ animationDelay: `${cardIndex * 120}ms` }}
                />
              ))}
            </div>
            <Skeleton
              className="mt-4 h-1 w-full"
              style={{ animationDelay: `${cardIndex * 120}ms` }}
            />
            <Skeleton
              className="mt-2.5 h-3 w-3/5"
              style={{ animationDelay: `${cardIndex * 120}ms` }}
            />
          </SurfaceCard>
        ))}
      </MarketGrid>
    </div>
  );
}
