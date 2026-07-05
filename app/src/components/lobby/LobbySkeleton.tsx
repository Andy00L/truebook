import { SurfaceCard } from "@/components/ui/SurfaceCard";
import { Skeleton } from "@/components/ui/Skeleton";

/** Loading state mirroring the banner strip and three fixture cards. */
export function LobbySkeleton() {
  return (
    <div aria-hidden="true">
      <SurfaceCard className="flex flex-wrap gap-6 px-4 py-3.5">
        <Skeleton className="h-3.5 w-50" />
        <Skeleton className="h-3.5 w-45" />
        <Skeleton className="h-3.5 w-28" />
        <Skeleton className="h-3.5 w-40" />
      </SurfaceCard>
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-[repeat(auto-fill,minmax(340px,1fr))]">
        {[0, 1, 2].map((cardIndex) => (
          <SurfaceCard key={cardIndex} className="p-5">
            <Skeleton
              className="h-4 w-7/10"
              style={{ animationDelay: `${cardIndex * 120}ms` }}
            />
            <div className="mt-4 flex gap-2">
              {[0, 1, 2].map((cellIndex) => (
                <Skeleton
                  key={cellIndex}
                  className="h-14 flex-1"
                  style={{ animationDelay: `${cardIndex * 120}ms` }}
                />
              ))}
            </div>
            <Skeleton
              className="mt-3.5 h-1 w-full"
              style={{ animationDelay: `${cardIndex * 120}ms` }}
            />
            <Skeleton
              className="mt-2.5 h-3 w-3/5"
              style={{ animationDelay: `${cardIndex * 120}ms` }}
            />
          </SurfaceCard>
        ))}
      </div>
    </div>
  );
}
