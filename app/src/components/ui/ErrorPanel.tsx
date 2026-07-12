import { SurfaceCard } from "@/components/ui/SurfaceCard";
import { Button } from "@/components/ui/Button";

type ErrorPanelProps = {
  title: string;
  message: string;
  onRetry: () => void;
  retryLabel?: string;
};

/** Error state, visually distinct from empty: cause named, retry path. */
export function ErrorPanel({
  title,
  message,
  onRetry,
  retryLabel = "Retry",
}: ErrorPanelProps) {
  return (
    <SurfaceCard className="flex animate-card-in flex-col items-center px-6 py-12 text-center">
      <span className="text-sm font-medium text-danger">Something failed</span>
      <span className="mt-2 text-base font-medium text-ink">{title}</span>
      <p className="m-0 mt-1.5 max-w-[44ch] text-sm leading-normal text-ink-muted">
        {message}
      </p>
      <Button onClick={onRetry} size="lg" className="mt-5">
        {retryLabel}
      </Button>
    </SurfaceCard>
  );
}
