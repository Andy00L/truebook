import { SurfaceCard } from "@/components/ui/SurfaceCard";
import { StatusPill } from "@/components/ui/StatusPill";
import { OdometerNumber } from "@/components/ui/OdometerNumber";
import { formatClock, formatMatchupLabel } from "@/lib/format";
import type { MatchView } from "@/lib/data/types";

/**
 * Score header (v3 noir): competition and teams left; the hero figure right
 * (the scoreline or the kickoff time, 32px weight 300) over the status pill.
 */
export function ScoreHeaderCard({ match }: { match: MatchView }) {
  const isLive = match.phase === "live";
  const isFinished = match.phase === "finished";
  const heroFigure =
    isLive || isFinished
      ? `${match.homeScore} - ${match.awayScore}`
      : (match.kickoffLabel ?? "vs");

  return (
    <SurfaceCard className="flex animate-card-in flex-wrap items-start justify-between gap-6 p-6">
      <div>
        <div className="text-sm text-ink-muted">{match.competitionLine}</div>
        <div className="mt-2.5 text-xl font-medium tracking-tight text-ink">
          {formatMatchupLabel(match.homeTeam, match.awayTeam)}
        </div>
        <div className="mt-1.5 text-sm text-ink-muted">{match.periodNote}</div>
      </div>
      <div className="flex flex-col items-end gap-3">
        <span className="flex items-baseline gap-3 text-2xl font-light tabular-nums leading-tight tracking-tight text-ink">
          {isLive || isFinished ? (
            <OdometerNumber value={heroFigure} />
          ) : (
            heroFigure
          )}
          {isLive ? (
            <span className="font-mono text-sm tabular-nums text-ink-muted">
              {formatClock(match.clockSeconds)}
            </span>
          ) : null}
        </span>
        {isLive ? (
          <StatusPill variant="live" withDot>
            Live
          </StatusPill>
        ) : (
          <StatusPill variant="neutral">
            {isFinished ? "Full time" : "Scheduled"}
          </StatusPill>
        )}
      </div>
    </SurfaceCard>
  );
}
