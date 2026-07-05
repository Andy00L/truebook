"use client";

import { useState } from "react";
import Link from "next/link";
import { useAnchorWallet } from "@solana/wallet-adapter-react";
import { PageShell } from "@/components/ui/PageShell";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorPanel } from "@/components/ui/ErrorPanel";
import { MarketGrid } from "@/components/ui/MarketGrid";
import { MatchSkeleton } from "@/components/match/MatchSkeleton";
import { ScoreHeaderCard } from "@/components/match/ScoreHeaderCard";
import { MarketCard } from "@/components/match/MarketCard";
import { PostMatchBoard } from "@/components/match/PostMatchBoard";
import {
  BetSlip,
  type PlaceBetResult,
  type SlipQuote,
} from "@/components/match/BetSlip";
import { ConnectWalletButton } from "@/components/wallet/ConnectWalletButton";
import { useDemoMatch, type MatchScreenView } from "@/lib/data/useDemoMatch";
import { useChainMatch } from "@/lib/chain/useChainMatch";
import { placeBetOnChain } from "@/lib/chain/placeBet";
import type { MatchView } from "@/lib/data/types";

export type MatchDataSource = "demo" | "chain";

type MatchScreenProps = {
  fixtureId: string;
  initialView: MatchScreenView;
  /** Demo simulation, or the live devnet market (NEXT_PUBLIC_DATA_SOURCE). */
  dataSource: MatchDataSource;
};

/** The hero screen: one match, its markets, and every price shown in full. */
export function MatchScreen({
  fixtureId,
  initialView,
  dataSource,
}: MatchScreenProps) {
  const isChainSource = dataSource === "chain";
  const demoMatch = useDemoMatch(fixtureId, initialView);
  const chainMatch = useChainMatch(isChainSource, fixtureId);
  const anchorWallet = useAnchorWallet();
  const [slipQuote, setSlipQuote] = useState<SlipQuote | null>(null);

  const view: MatchScreenView = isChainSource
    ? chainMatch.state.status === "loading"
      ? "loading"
      : chainMatch.state.status === "error"
        ? "oddsError"
        : "live"
    : demoMatch.view;

  const match: MatchView | null = isChainSource
    ? chainMatch.state.status === "ready"
      ? chainMatch.state.match
      : null
    : demoMatch.match;

  const isChainPending =
    isChainSource &&
    (chainMatch.state.status === "loading" ||
      chainMatch.state.status === "error");

  if (!match && !isChainPending) {
    return (
      <PageShell>
        <Breadcrumb
          segments={[{ label: "Fixtures", href: "/" }, { label: "Match" }]}
          actions={isChainSource ? <ConnectWalletButton /> : undefined}
        />
        <EmptyState
          message={
            isChainSource
              ? "No open market for this fixture on devnet."
              : "This fixture is not in the current World Cup window."
          }
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
    const market = match?.markets.find(
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
      marketAddress: market.marketAddress,
      side: outcome.outcomeKey.endsWith("-yes")
        ? "yes"
        : outcome.outcomeKey.endsWith("-no")
          ? "no"
          : undefined,
    };
  };

  const handleSelectOutcome = (marketKey: string, outcomeKey: string) => {
    setSlipQuote(snapshotQuote(marketKey, outcomeKey));
  };

  const handleRefreshQuote = () => {
    if (!slipQuote || !match) {
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

  const handleChainPlaceBet = async (
    stakeAmount: number,
  ): Promise<PlaceBetResult> => {
    if (!anchorWallet) {
      return {
        ok: false,
        reason: "Connect a wallet first (top right), then place the bet.",
      };
    }
    if (!slipQuote?.marketAddress || !slipQuote.side) {
      return { ok: false, reason: "This quote is not backed by a devnet market." };
    }
    return placeBetOnChain(
      anchorWallet,
      slipQuote.marketAddress,
      slipQuote.side,
      stakeAmount,
    );
  };

  return (
    <PageShell>
      <Breadcrumb
        segments={[
          { label: "Fixtures", href: "/" },
          {
            label: match ? `${match.homeTeam} vs ${match.awayTeam}` : "Match",
          },
        ]}
        actions={isChainSource ? <ConnectWalletButton /> : undefined}
      />

      {view === "loading" ? (
        <MatchSkeleton />
      ) : (
        <>
          {match ? <ScoreHeaderCard match={match} /> : null}

          {view === "oddsError" ? (
            <div className="mt-4">
              <ErrorPanel
                title={
                  isChainSource
                    ? "Couldn't load the devnet market"
                    : "Couldn't load market prices"
                }
                message={
                  isChainSource
                    ? "The Solana devnet RPC didn't respond."
                    : "The TxLINE consensus feed didn't respond."
                }
                onRetry={isChainSource ? chainMatch.retry : demoMatch.retryOdds}
              />
            </div>
          ) : view === "postMatch" && match ? (
            <PostMatchBoard settledMarkets={match.settledMarkets} />
          ) : match ? (
            <MarketGrid>
              {match.markets.map((market, marketIndex) => (
                <MarketCard
                  key={market.marketKey}
                  market={market}
                  oddsPulses={isChainSource ? {} : demoMatch.oddsPulses}
                  selectedOutcomeKey={slipQuote?.outcomeKey ?? null}
                  onSelectOutcome={handleSelectOutcome}
                  enterDelayMs={marketIndex * 40}
                />
              ))}
            </MarketGrid>
          ) : null}
        </>
      )}

      {slipQuote ? (
        <BetSlip
          quote={slipQuote}
          onClose={() => setSlipQuote(null)}
          onRefreshQuote={handleRefreshQuote}
          onPlaceBet={isChainSource ? handleChainPlaceBet : undefined}
        />
      ) : null}
    </PageShell>
  );
}
