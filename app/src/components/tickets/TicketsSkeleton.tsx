import { SurfaceCard } from "@/components/ui/SurfaceCard";
import { Skeleton } from "@/components/ui/Skeleton";

/** Loading state mirroring the segmented filter and four ticket rows. */
export function TicketsSkeleton() {
  return (
    <div aria-hidden="true">
      <Skeleton className="mt-5 h-10 w-90 max-w-full rounded-full" />
      <SurfaceCard className="mt-4 p-2.5">
        {[0, 1, 2, 3].map((rowIndex) => (
          <div
            key={rowIndex}
            className="flex items-center justify-between gap-4 px-3 py-4"
          >
            <div className="min-w-0 flex-1">
              <Skeleton
                className="h-3.5 w-45"
                style={{ animationDelay: `${rowIndex * 120}ms` }}
              />
              <Skeleton
                className="mt-2 h-3 w-35"
                style={{ animationDelay: `${rowIndex * 120}ms` }}
              />
            </div>
            <div className="flex items-center gap-3.5">
              <Skeleton
                className="h-6 w-24 rounded-full"
                style={{ animationDelay: `${rowIndex * 120}ms` }}
              />
              <Skeleton
                className="h-3.5 w-16"
                style={{ animationDelay: `${rowIndex * 120}ms` }}
              />
            </div>
          </div>
        ))}
      </SurfaceCard>
    </div>
  );
}
