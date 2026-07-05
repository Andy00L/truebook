import Link from "next/link";
import { SurfaceCard } from "@/components/ui/SurfaceCard";
import { StatusPill } from "@/components/ui/StatusPill";
import { TransparencyBar } from "@/components/ui/TransparencyBar";
import { joinClassNames } from "@/lib/joinClassNames";
import { formatClock, formatOdds } from "@/lib/format";
import type { MatchView, OutcomeQuote } from "@/lib/data/types";
import type { OddsMovePulse } from "@/lib/data/useDemoMatch";

type FixtureCardProps = {
  fixture: MatchView;
  /** Pulses only flow to the live fixture; upcoming cards stay still. */
  oddsPulses?: Record<string, OddsMovePulse>;
  /** 40ms stagger step per card position in the grid. */
  enterDelayMs: number;
};

function FixtureOddsLink({
  fixtureId,
  fixtureName,
  outcome,
  pulse,
}: {
  fixtureId: string;
  fixtureName: string;
  outcome: OutcomeQuote;
  pulse: OddsMovePulse | null;
}) {
  const backgroundClass =
    pulse === "shorten"
      ? "bg-accent-soft"
      : pulse === "lengthen"
        ? "bg-danger-soft"
        : "bg-elevated hover:bg-border";

  return (
    <Link
      href={`/match/${fixtureId}`}
      aria-label={`${outcome.label} in ${fixtureName} at ${formatOdds(outcome.servedOdds)}`}
      className={joinClassNames(
        "transition-press focus-ring flex min-h-14 min-w-22 flex-1 basis-0 flex-col items-center justify-center gap-1 rounded-sm border p-2 no-underline active:scale-98",
        backgroundClass,
        outcome.isBest ? "border-accent" : "border-border",
      )}
    >
      <span className="eyebrow text-ink-muted">{outcome.label}</span>
      <span className="font-mono text-lg font-semibold tabular-nums text-ink">
        {formatOdds(outcome.servedOdds)}
      </span>
    </Link>
  );
}

/** One fixture on the lobby grid: teams, status, featured market, bar. */
export function FixtureCard({
  fixture,
  oddsPulses = {},
  enterDelayMs,
}: FixtureCardProps) {
  const fixtureName = `${fixture.homeTeam} vs ${fixture.awayTeam}`;
  const featuredMarket = fixture.markets[0];
  const featuredOutcome = featuredMarket?.outcomes.find(
    (outcome) => outcome.isBest,
  );
  const isLive = fixture.phase === "live";

  return (
    <SurfaceCard
      className="flex animate-card-in flex-col p-5"
      style={{ animationDelay: `${enterDelayMs}ms` }}
    >
      <div className="flex items-center justify-between gap-3">
        <h3 className="m-0 text-lg font-semibold text-ink">{fixtureName}</h3>
        {isLive ? (
          <StatusPill variant="live" withDot>
            LIVE
          </StatusPill>
        ) : null}
      </div>

      {isLive ? (
        <div className="mt-1.5 flex items-baseline gap-3 font-mono tabular-nums">
          <span className="text-lg font-semibold text-ink">
            {fixture.homeScore} - {fixture.awayScore}
          </span>
          <span className="text-xs text-ink-muted">
            {formatClock(fixture.clockSeconds)}
          </span>
        </div>
      ) : (
        <div className="mt-1.5 flex items-baseline gap-2 font-mono text-xs tabular-nums">
          <span className="text-ink-faint">kickoff</span>
          <span className="text-ink-muted">{fixture.kickoffLabel}</span>
        </div>
      )}

      {featuredMarket && featuredOutcome ? (
        <>
          <div className="eyebrow mt-4 text-ink-faint">
            {featuredMarket.name}
          </div>
          <div className="mt-2 flex gap-2 overflow-x-auto">
            {featuredMarket.outcomes.map((outcome) => (
              <FixtureOddsLink
                key={outcome.outcomeKey}
                fixtureId={fixture.fixtureId}
                fixtureName={fixtureName}
                outcome={outcome}
                pulse={oddsPulses[outcome.outcomeKey] ?? null}
              />
            ))}
          </div>
          <TransparencyBar
            compact
            marketName={featuredMarket.name}
            consensusLabel={formatOdds(featuredOutcome.consensusOdds)}
            marginLabel={featuredMarket.marginLabel}
            servedLabel={formatOdds(featuredOutcome.servedOdds)}
            marginBasisPx={17}
          />
        </>
      ) : null}

      <div className="mt-3.5 border-t border-border pt-1">
        <Link
          href={`/match/${fixture.fixtureId}`}
          className="focus-ring inline-flex min-h-11 items-center rounded-sm border border-transparent px-1 text-sm text-accent no-underline hover:underline"
        >
          view markets →
        </Link>
      </div>
    </SurfaceCard>
  );
}
