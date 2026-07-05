import { SurfaceCard } from "@/components/ui/SurfaceCard";
import { Skeleton } from "@/components/ui/Skeleton";

/** Loading state mirroring the filter chips and three ticket rows. */
export function TicketsSkeleton() {
  return (
    <div aria-hidden="true" className="flex flex-col gap-3">
      <div className="flex gap-2">
        {[0, 1, 2].map((chipIndex) => (
          <Skeleton key={chipIndex} className="h-11 w-18 rounded-sm" />
        ))}
      </div>
      {[0, 1, 2].map((rowIndex) => (
        <SurfaceCard
          key={rowIndex}
          className="flex flex-wrap items-center gap-4 p-4"
        >
          <Skeleton
            className="h-4 min-w-55 flex-1"
            style={{ animationDelay: `${rowIndex * 120}ms` }}
          />
          <Skeleton
            className="h-7 w-22"
            style={{ animationDelay: `${rowIndex * 120}ms` }}
          />
          <Skeleton
            className="h-7 w-18"
            style={{ animationDelay: `${rowIndex * 120}ms` }}
          />
          <Skeleton
            className="h-7 w-28"
            style={{ animationDelay: `${rowIndex * 120}ms` }}
          />
          <Skeleton
            className="h-6 w-22"
            style={{ animationDelay: `${rowIndex * 120}ms` }}
          />
        </SurfaceCard>
      ))}
    </div>
  );
}
