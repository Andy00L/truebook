import { SurfaceCard } from "@/components/ui/SurfaceCard";
import { StatusPill } from "@/components/ui/StatusPill";
import { OddsCell } from "@/components/ui/OddsCell";
import { TransparencyBar } from "@/components/ui/TransparencyBar";
import { formatOdds } from "@/lib/format";
import type { MarketView } from "@/lib/data/types";
import type { OddsMovePulse } from "@/lib/data/useDemoMatch";

type MarketCardProps = {
  market: MarketView;
  oddsPulses: Record<string, OddsMovePulse>;
  selectedOutcomeKey: string | null;
  onSelectOutcome: (marketKey: string, outcomeKey: string) => void;
  /** 40ms stagger step per card position in the board. */
  enterDelayMs: number;
};

/** Scales the margin segment of the bar with the displayed margin. */
function marginSegmentPx(marginLabel: string): number {
  const marginPercent = Number.parseFloat(marginLabel);
  if (Number.isNaN(marginPercent)) {
    return 24;
  }
  return Math.round(10 + marginPercent * 8);
}

/** One market on the board: name, outcome cells, price transparency bar. */
export function MarketCard({
  market,
  oddsPulses,
  selectedOutcomeKey,
  onSelectOutcome,
  enterDelayMs,
}: MarketCardProps) {
  const isLocked = market.phase === "locked";
  const featuredOutcome = market.outcomes.find((outcome) => outcome.isBest);

  return (
    <SurfaceCard
      aria-disabled={isLocked || undefined}
      className="animate-card-in p-5"
      style={{ animationDelay: `${enterDelayMs}ms` }}
    >
      <div
        className={`flex items-baseline justify-between gap-3 ${isLocked ? "opacity-55" : ""}`}
      >
        <h3 className="m-0 text-base font-semibold text-ink">{market.name}</h3>
        <span className="eyebrow font-mono text-ink-faint">
          {market.groupLabel}
        </span>
      </div>

      {isLocked ? (
        <div className="mt-5 flex min-h-13 items-center gap-3">
          <StatusPill variant="amber">LOCKED</StatusPill>
          <span className="text-sm text-ink-faint">{market.phaseNote}</span>
        </div>
      ) : (
        <>
          <div className="mt-3.5 flex gap-2 overflow-x-auto">
            {market.outcomes.map((outcome) => (
              <OddsCell
                key={outcome.outcomeKey}
                label={outcome.label}
                priceLabel={formatOdds(outcome.servedOdds)}
                isBest={outcome.isBest}
                isSelected={selectedOutcomeKey === outcome.outcomeKey}
                pulse={oddsPulses[outcome.outcomeKey] ?? null}
                onSelect={() =>
                  onSelectOutcome(market.marketKey, outcome.outcomeKey)
                }
              />
            ))}
          </div>
          {featuredOutcome ? (
            <TransparencyBar
              marketName={market.name}
              consensusLabel={formatOdds(featuredOutcome.consensusOdds)}
              marginLabel={market.marginLabel}
              servedLabel={formatOdds(featuredOutcome.servedOdds)}
              marginBasisPx={marginSegmentPx(market.marginLabel)}
            />
          ) : null}
        </>
      )}
    </SurfaceCard>
  );
}
