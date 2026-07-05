"use client";

import { useState } from "react";
import Link from "next/link";
import { PageShell } from "@/components/ui/PageShell";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorPanel } from "@/components/ui/ErrorPanel";
import { MarketGrid } from "@/components/ui/MarketGrid";
import { MatchSkeleton } from "@/components/match/MatchSkeleton";
import { ScoreHeaderCard } from "@/components/match/ScoreHeaderCard";
import { MarketCard } from "@/components/match/MarketCard";
import { PostMatchBoard } from "@/components/match/PostMatchBoard";
import { BetSlip, type SlipQuote } from "@/components/match/BetSlip";
import { useDemoMatch, type MatchScreenView } from "@/lib/data/useDemoMatch";

type MatchScreenProps = {
  fixtureId: string;
  initialView: MatchScreenView;
};

/** The hero screen: one match, its markets, and every price shown in full. */
export function MatchScreen({ fixtureId, initialView }: MatchScreenProps) {
  const { view, match, oddsPulses, retryOdds } = useDemoMatch(
    fixtureId,
    initialView,
  );
  const [slipQuote, setSlipQuote] = useState<SlipQuote | null>(null);

  if (!match) {
    return (
      <PageShell>
        <Breadcrumb
          segments={[{ label: "Fixtures", href: "/" }, { label: "Match" }]}
        />
        <EmptyState
          message="This fixture is not in the current World Cup window."
          action={
            <Link
              href="/"
              className="focus-ring rounded-sm border border-transparent px-1 py-3 text-sm text-accent no-underline hover:underline"
            >
              Back to the lobby
            </Link>
          }
        />
      </PageShell>
    );
  }

  const snapshotQuote = (
    marketKey: string,
    outcomeKey: string,
  ): SlipQuote | null => {
    const market = match.markets.find(
      (candidate) => candidate.marketKey === marketKey,
    );
    const outcome = market?.outcomes.find(
      (candidate) => candidate.outcomeKey === outcomeKey,
    );
    if (!market || !outcome) {
      return null;
    }
    return {
      outcomeKey: outcome.outcomeKey,
      marketName: market.name,
      outcomeLabel: outcome.label,
      servedOdds: outcome.servedOdds,
      consensusOdds: outcome.consensusOdds,
      marginLabel: market.marginLabel,
    };
  };

  const handleSelectOutcome = (marketKey: string, outcomeKey: string) => {
    setSlipQuote(snapshotQuote(marketKey, outcomeKey));
  };

  const handleRefreshQuote = () => {
    if (!slipQuote) {
      return;
    }
    const marketOfQuote = match.markets.find((candidate) =>
      candidate.outcomes.some(
        (outcome) => outcome.outcomeKey === slipQuote.outcomeKey,
      ),
    );
    if (marketOfQuote) {
      setSlipQuote(
        snapshotQuote(marketOfQuote.marketKey, slipQuote.outcomeKey),
      );
    }
  };

  return (
    <PageShell>
      <Breadcrumb
        segments={[
          { label: "Fixtures", href: "/" },
          { label: `${match.homeTeam} vs ${match.awayTeam}` },
        ]}
      />

      {view === "loading" ? (
        <MatchSkeleton />
      ) : (
        <>
          <ScoreHeaderCard match={match} />

          {view === "oddsError" ? (
            <div className="mt-4">
              <ErrorPanel
                title="Couldn't load market prices"
                message="The TxLINE consensus feed didn't respond."
                onRetry={retryOdds}
              />
            </div>
          ) : view === "postMatch" ? (
            <PostMatchBoard settledMarkets={match.settledMarkets} />
          ) : (
            <MarketGrid>
              {match.markets.map((market, marketIndex) => (
                <MarketCard
                  key={market.marketKey}
                  market={market}
                  oddsPulses={oddsPulses}
                  selectedOutcomeKey={slipQuote?.outcomeKey ?? null}
                  onSelectOutcome={handleSelectOutcome}
                  enterDelayMs={marketIndex * 40}
                />
              ))}
            </MarketGrid>
          )}
        </>
      )}

      {slipQuote ? (
        <BetSlip
          quote={slipQuote}
          onClose={() => setSlipQuote(null)}
          onRefreshQuote={handleRefreshQuote}
        />
      ) : null}
    </PageShell>
  );
}
