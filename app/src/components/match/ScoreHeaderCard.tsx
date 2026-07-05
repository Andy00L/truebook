import { SurfaceCard } from "@/components/ui/SurfaceCard";
import { StatusPill } from "@/components/ui/StatusPill";
import { formatClock } from "@/lib/format";
import type { MatchView } from "@/lib/data/types";

/** Score header: competition eyebrow, teams and score, clock and status. */
export function ScoreHeaderCard({ match }: { match: MatchView }) {
  const isLive = match.phase === "live";
  const isFinished = match.phase === "finished";

  return (
    <SurfaceCard className="flex animate-card-in flex-wrap items-center justify-between gap-6 p-5">
      <div>
        <div className="eyebrow text-ink-faint">{match.competitionLine}</div>
        <div className="mt-2.5 flex flex-wrap items-baseline gap-4">
          <span className="text-2xl font-semibold text-ink">
            {match.homeTeam}
          </span>
          <span className="font-mono text-4xl font-semibold leading-none tabular-nums text-ink">
            {isLive || isFinished
              ? `${match.homeScore} - ${match.awayScore}`
              : "vs"}
          </span>
          <span className="text-2xl font-semibold text-ink">
            {match.awayTeam}
          </span>
        </div>
      </div>
      <div className="flex flex-col items-end gap-1.5">
        <div className="flex items-center gap-3">
          {isLive ? (
            <StatusPill variant="live" withDot>
              LIVE
            </StatusPill>
          ) : (
            <StatusPill variant="neutral">
              {isFinished ? "FULL TIME" : "SCHEDULED"}
            </StatusPill>
          )}
          <span className="font-mono text-2xl font-semibold tabular-nums text-ink">
            {isLive ? formatClock(match.clockSeconds) : isFinished ? "FT" : ""}
          </span>
        </div>
        <span className="text-xs text-ink-faint">{match.periodNote}</span>
      </div>
    </SurfaceCard>
  );
}
