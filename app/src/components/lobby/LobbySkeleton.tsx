import { SurfaceCard } from "@/components/ui/SurfaceCard";
import { Skeleton } from "@/components/ui/Skeleton";

/** Loading state mirroring the honesty header and three fixture cards. */
export function LobbySkeleton() {
  return (
    <div aria-hidden="true">
      <SurfaceCard className="p-6">
        <div className="flex flex-wrap justify-between gap-8">
          <div>
            <Skeleton className="h-3 w-24" />
            <Skeleton className="mt-3.5 h-10 w-65" />
            <Skeleton className="mt-3.5 h-3 w-42" />
          </div>
          <div className="grid grid-cols-2 content-start gap-x-11 gap-y-5">
            {[0, 1, 2, 3].map((statIndex) => (
              <div key={statIndex}>
                <Skeleton className="h-3 w-24" />
                <Skeleton className="mt-2.5 h-5 w-18" />
              </div>
            ))}
          </div>
        </div>
        <Skeleton className="mt-6 h-27.5 w-full" />
      </SurfaceCard>
      <div className="mt-7 flex justify-between px-1">
        <Skeleton className="h-3 w-22" />
        <Skeleton className="h-3 w-15" />
      </div>
      <div className="mt-3 grid grid-cols-1 gap-5 sm:grid-cols-[repeat(auto-fill,minmax(320px,1fr))]">
        {[0, 1, 2].map((cardIndex) => (
          <SurfaceCard key={cardIndex} className="p-5">
            <div className="flex justify-between gap-4">
              <Skeleton
                className="h-4.5 w-7/10"
                style={{ animationDelay: `${cardIndex * 120}ms` }}
              />
              <Skeleton
                className="h-7 w-16"
                style={{ animationDelay: `${cardIndex * 120}ms` }}
              />
            </div>
            <Skeleton
              className="mt-3 h-3 w-1/2"
              style={{ animationDelay: `${cardIndex * 120}ms` }}
            />
            <Skeleton
              className="mt-6 h-3 w-full"
              style={{ animationDelay: `${cardIndex * 120}ms` }}
            />
          </SurfaceCard>
        ))}
      </div>
    </div>
  );
}
