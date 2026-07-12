"use client";

import { useState } from "react";
import Link from "next/link";
import { PageShell } from "@/components/ui/PageShell";
import { TopBar } from "@/components/ui/TopBar";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorPanel } from "@/components/ui/ErrorPanel";
import { HonestyBanner, type HonestyDelta } from "@/components/lobby/HonestyBanner";
import { FixtureCard } from "@/components/lobby/FixtureCard";
import { LobbySkeleton } from "@/components/lobby/LobbySkeleton";
import { JudgePanel } from "@/components/judge/JudgePanel";
import { listDemoFixtures } from "@/lib/data/demoFixtures";
import { DEMO_HOUSE_DELTA, DEMO_HOUSE_STATS } from "@/lib/data/demoHouse";
import { useDemoMatch } from "@/lib/data/useDemoMatch";
import { useChainLobby } from "@/lib/chain/useChainLobby";

export type LobbyScreenView = "fixtures" | "loading" | "empty" | "error";

export type LobbyDataSource = "demo" | "chain";

type LobbyScreenProps = {
  initialView: LobbyScreenView;
  /** ?judge=open lands with the judge panel already open. */
  initialJudgeOpen: boolean;
  /** Gate-testing hook for the judge panel faucet error state. */
  judgeFaucetFails: boolean;
  /** Demo fixtures, or the live devnet board (NEXT_PUBLIC_DATA_SOURCE). */
  dataSource: LobbyDataSource;
};

/** Splits "94.24 USDT" into its figure and unit for the big number. */
function splitVaultLabel(vaultLabel: string): {
  amount: string;
  unit: string;
} {
  const lastSpaceIndex = vaultLabel.lastIndexOf(" ");
  if (lastSpaceIndex < 0) {
    return { amount: vaultLabel, unit: "" };
  }
  return {
    amount: vaultLabel.slice(0, lastSpaceIndex),
    unit: vaultLabel.slice(lastSpaceIndex + 1),
  };
}

/** The front door: honesty header, open markets, judge mode. */
export function LobbyScreen({
  initialView,
  initialJudgeOpen,
  judgeFaucetFails,
  dataSource,
}: LobbyScreenProps) {
  const [view, setView] = useState<LobbyScreenView>(initialView);
  const [isJudgeOpen, setIsJudgeOpen] = useState(initialJudgeOpen);
  const isChainSource = dataSource === "chain";
  const demoFixtures = listDemoFixtures();
  const liveFixture = demoFixtures.find((fixture) => fixture.phase === "live");

  // The live fixture ticks through the same demo feed the match screen uses,
  // so both screens move in the same rhythm (the cells detect moves).
  const { match: liveMatch } = useDemoMatch(liveFixture?.fixtureId ?? "", "live");

  const chainLobby = useChainLobby(isChainSource);

  const fixtures = isChainSource
    ? chainLobby.state.status === "ready"
      ? chainLobby.state.board.fixtures
      : []
    : demoFixtures;
  const houseStats = isChainSource
    ? chainLobby.state.status === "ready"
      ? chainLobby.state.board.houseStats
      : DEMO_HOUSE_STATS
    : DEMO_HOUSE_STATS;
  const vault = splitVaultLabel(houseStats.vaultLabel);
  // No invented deltas on chain: the delta line ships with vault history.
  const vaultDelta: HonestyDelta | undefined = isChainSource
    ? undefined
    : DEMO_HOUSE_DELTA;

  return (
    <PageShell>
      <TopBar
        onJudgeToggle={() => setIsJudgeOpen((wasOpen) => !wasOpen)}
        withWallet={isChainSource}
      />

      {isJudgeOpen ? (
        <JudgePanel
          onClose={() => setIsJudgeOpen(false)}
          faucetFails={judgeFaucetFails}
          dataSource={dataSource}
        />
      ) : null}

      {isChainSource && chainLobby.state.status === "loading" ? (
        <LobbySkeleton />
      ) : isChainSource && chainLobby.state.status === "error" ? (
        <ErrorPanel
          title="The devnet RPC did not respond"
          message="Open markets can't be listed until the connection returns."
          onRetry={chainLobby.retry}
        />
      ) : !isChainSource && view === "loading" ? (
        <LobbySkeleton />
      ) : !isChainSource && view === "error" ? (
        <ErrorPanel
          title="The odds feed didn't answer"
          message="TxLINE consensus is unreachable, so no price can be served."
          onRetry={() => setView("fixtures")}
        />
      ) : view === "empty" ? (
        <EmptyState
          message="No fixtures in this window. TxLINE hasn't opened a market yet."
          action={
            <Link
              href="/replay"
              className="focus-ring rounded-full px-2 py-2 text-sm font-medium text-accent no-underline hover:underline"
            >
              Replay settled matches
            </Link>
          }
        />
      ) : (
        <>
          <HonestyBanner
            vaultAmount={vault.amount}
            vaultUnit={vault.unit}
            delta={vaultDelta}
            openExposureLabel={houseStats.openExposureLabel}
            marginLabel={houseStats.marginLabel}
            ticketsAuditedLabel={houseStats.ticketsAuditedLabel}
            violationsFoundLabel={houseStats.violationsFoundLabel}
          />

          <div className="mt-7 flex items-baseline justify-between gap-4 px-1">
            <span className="text-sm text-ink-muted">Open markets</span>
            <span className="text-sm tabular-nums text-ink-muted">
              {fixtures.length} fixtures
            </span>
          </div>

          <div className="mt-3 grid grid-cols-1 gap-5 sm:grid-cols-[repeat(auto-fill,minmax(320px,1fr))]">
            {fixtures.map((fixture, fixtureIndex) => {
              const isLiveFixture =
                !isChainSource && fixture.fixtureId === liveFixture?.fixtureId;
              return (
                <FixtureCard
                  key={`${fixture.fixtureId}-${fixtureIndex}`}
                  fixture={isLiveFixture && liveMatch ? liveMatch : fixture}
                  enterDelayMs={fixtureIndex * 40}
                />
              );
            })}
          </div>
        </>
      )}
    </PageShell>
  );
}
