import { SurfaceCard } from "@/components/ui/SurfaceCard";
import { StatusPill } from "@/components/ui/StatusPill";
import { OddsCell } from "@/components/ui/OddsCell";
import { formatOdds } from "@/lib/format";
import { AWAITING_QUOTE_NOTE, type MarketView } from "@/lib/data/types";

type MarketCardProps = {
  market: MarketView;
  selectedOutcomeKey: string | null;
  onSelectOutcome: (marketKey: string, outcomeKey: string) => void;
  /** 40ms stagger step per card position in the board. */
  enterDelayMs: number;
};

/** One market on the board: label, outcome cells, equations inside them. */
export function MarketCard({
  market,
  selectedOutcomeKey,
  onSelectOutcome,
  enterDelayMs,
}: MarketCardProps) {
  const isLocked = market.phase === "locked";

  return (
    <SurfaceCard
      aria-disabled={isLocked || undefined}
      className="animate-card-in p-5"
      style={{ animationDelay: `${enterDelayMs}ms` }}
    >
      <div
        className={`flex items-baseline justify-between gap-3 ${isLocked ? "opacity-55" : ""}`}
      >
        <h3 className="m-0 text-sm font-normal text-ink-muted">
          {market.name} · {market.groupLabel}
        </h3>
      </div>

      {isLocked ? (
        <div className="mt-4 flex min-h-13 items-center gap-3">
          <StatusPill variant="amber">Locked</StatusPill>
          <span className="text-sm text-ink-muted">{market.phaseNote}</span>
        </div>
      ) : market.outcomes.length === 0 ? (
        <div className="mt-4 flex min-h-13 items-center gap-3">
          <StatusPill variant="neutral">Awaiting quote</StatusPill>
          <span className="text-sm text-ink-muted">{AWAITING_QUOTE_NOTE}</span>
        </div>
      ) : (
        <div className="mt-3.5 flex gap-3 overflow-x-auto">
          {market.outcomes.map((outcome) => (
            <OddsCell
              key={outcome.outcomeKey}
              label={outcome.label}
              priceLabel={formatOdds(outcome.servedOdds)}
              consensusLabel={formatOdds(outcome.consensusOdds)}
              marginLabel={market.marginLabel}
              isSelected={selectedOutcomeKey === outcome.outcomeKey}
              onSelect={() =>
                onSelectOutcome(market.marketKey, outcome.outcomeKey)
              }
            />
          ))}
        </div>
      )}
    </SurfaceCard>
  );
}
