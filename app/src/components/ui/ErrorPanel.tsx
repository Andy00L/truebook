import { SurfaceCard } from "@/components/ui/SurfaceCard";
import { Button } from "@/components/ui/Button";

type ErrorPanelProps = {
  title: string;
  message: string;
  onRetry: () => void;
  retryLabel?: string;
};

/** Error state, visually distinct from empty: red dot, cause, retry path. */
export function ErrorPanel({
  title,
  message,
  onRetry,
  retryLabel = "Retry",
}: ErrorPanelProps) {
  return (
    <SurfaceCard className="flex animate-card-in flex-col items-start gap-2 p-8">
      <div className="flex items-center gap-2.5">
        <span aria-hidden="true" className="size-2 rounded-sm bg-danger" />
        <span className="text-lg font-semibold text-ink">{title}</span>
      </div>
      <p className="m-0 text-sm text-ink-muted">{message}</p>
      <Button onClick={onRetry} className="mt-3">
        {retryLabel}
      </Button>
    </SurfaceCard>
  );
}
