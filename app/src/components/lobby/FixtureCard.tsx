import Link from "next/link";
import { StatusPill } from "@/components/ui/StatusPill";
import { OdometerNumber } from "@/components/ui/OdometerNumber";
import { PriceEquation } from "@/components/ui/PriceEquation";
import { IconChevron } from "@/components/ui/Icon";
import { formatOdds } from "@/lib/format";
import type { MatchView } from "@/lib/data/types";

type FixtureCardProps = {
  fixture: MatchView;
  /** 40ms stagger step per card position in the grid. */
  enterDelayMs: number;
};

/**
 * One fixture on the lobby grid (v3 noir): the whole card is the link.
 * Teams over the market line left, the featured quote as a big thin number
 * right, the transparency equation as the footer.
 */
export function FixtureCard({ fixture, enterDelayMs }: FixtureCardProps) {
  const featuredMarket = fixture.markets[0];
  const featuredOutcome =
    featuredMarket?.outcomes.find((outcome) => outcome.isBest) ??
    featuredMarket?.outcomes[0];
  const isLive = fixture.phase === "live";
  const marketLine = featuredMarket
    ? `${featuredMarket.name} · ${featuredMarket.groupLabel}`
    : "Awaiting quote";
  const scoreSuffix = isLive
    ? ` · ${fixture.homeScore}-${fixture.awayScore}`
    : "";

  return (
    <Link
      href={`/match/${fixture.fixtureId}`}
      className="transition-press focus-ring block animate-card-in rounded-md bg-surface p-5 text-ink no-underline hover:bg-elevated active:scale-97"
      style={{ animationDelay: `${enterDelayMs}ms` }}
    >
      <span className="flex items-start justify-between gap-4">
        <span className="min-w-0">
          <span className="block text-lg font-medium tracking-tight">
            {fixture.homeTeam} vs {fixture.awayTeam}
          </span>
          <span className="mt-1.5 flex flex-wrap items-center gap-2.5">
            <span className="text-sm text-ink-muted">
              {marketLine}
              {scoreSuffix}
            </span>
            {isLive ? (
              <StatusPill variant="live" withDot>
                Live
              </StatusPill>
            ) : null}
          </span>
        </span>
        {featuredOutcome ? (
          <OdometerNumber
            value={formatOdds(featuredOutcome.servedOdds)}
            className="flex-none text-2xl font-light tabular-nums leading-tight tracking-tight"
          />
        ) : null}
      </span>
      <span className="mt-4.5 flex items-center justify-between gap-4">
        {featuredMarket && featuredOutcome ? (
          <PriceEquation
            consensusLabel={formatOdds(featuredOutcome.consensusOdds)}
            marginLabel={featuredMarket.marginLabel}
            servedLabel={formatOdds(featuredOutcome.servedOdds)}
          />
        ) : (
          <span className="text-xs text-ink-faint">
            The next keeper tick posts a fresh price.
          </span>
        )}
        <span
          aria-hidden="true"
          className="inline-flex size-8 flex-none items-center justify-center rounded-full bg-elevated text-ink"
        >
          <IconChevron direction="right" />
        </span>
      </span>
    </Link>
  );
}
