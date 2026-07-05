"use client";

import { useState } from "react";
import Link from "next/link";
import { PageShell } from "@/components/ui/PageShell";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorPanel } from "@/components/ui/ErrorPanel";
import { LobbyHeader } from "@/components/lobby/LobbyHeader";
import { HonestyBanner } from "@/components/lobby/HonestyBanner";
import { FixtureCard } from "@/components/lobby/FixtureCard";
import { LobbySkeleton } from "@/components/lobby/LobbySkeleton";
import { JudgePanel } from "@/components/judge/JudgePanel";
import { listDemoFixtures } from "@/lib/data/demoFixtures";
import { DEMO_HOUSE_STATS } from "@/lib/data/demoHouse";
import { useDemoMatch } from "@/lib/data/useDemoMatch";

export type LobbyScreenView = "fixtures" | "loading" | "empty" | "error";

type LobbyScreenProps = {
  initialView: LobbyScreenView;
  /** Gate-testing hook for the judge panel faucet error state. */
  judgeFaucetFails: boolean;
};

/** The front door: honesty banner, remaining fixtures, judge mode. */
export function LobbyScreen({
  initialView,
  judgeFaucetFails,
}: LobbyScreenProps) {
  const [view, setView] = useState<LobbyScreenView>(initialView);
  const [isJudgeOpen, setIsJudgeOpen] = useState(false);
  const fixtures = listDemoFixtures();
  const liveFixture = fixtures.find((fixture) => fixture.phase === "live");

  // The live fixture ticks and pulses through the same demo feed the match
  // screen uses, so both screens move in the same rhythm.
  const { match: liveMatch, oddsPulses } = useDemoMatch(
    liveFixture?.fixtureId ?? "",
    "live",
  );

  return (
    <PageShell>
      <LobbyHeader
        onJudgeToggle={() => setIsJudgeOpen((wasOpen) => !wasOpen)}
      />

      {isJudgeOpen ? (
        <JudgePanel
          onClose={() => setIsJudgeOpen(false)}
          faucetFails={judgeFaucetFails}
        />
      ) : null}

      {view === "loading" ? (
        <LobbySkeleton />
      ) : view === "error" ? (
        <ErrorPanel
          title="Couldn't load fixtures"
          message="The TxLINE consensus feed didn't respond."
          onRetry={() => setView("fixtures")}
        />
      ) : view === "empty" ? (
        <EmptyState
          message="No fixtures in the current window."
          action={
            <Link
              href="/replay"
              className="focus-ring rounded-sm border border-transparent px-2 py-3 text-sm text-accent no-underline hover:underline"
            >
              Replay settled matches →
            </Link>
          }
        />
      ) : (
        <>
          <HonestyBanner
            vaultLabel={DEMO_HOUSE_STATS.vaultLabel}
            openExposureLabel={DEMO_HOUSE_STATS.openExposureLabel}
            marginLabel={DEMO_HOUSE_STATS.marginLabel}
            ticketsAuditedLabel={DEMO_HOUSE_STATS.ticketsAuditedLabel}
            violationsFoundLabel={DEMO_HOUSE_STATS.violationsFoundLabel}
          />

          <div className="mt-6 flex items-baseline justify-between gap-4">
            <span className="eyebrow text-ink-muted">
              FIFA World Cup · remaining fixtures
            </span>
            <span className="font-mono text-xs tabular-nums text-ink-faint">
              {fixtures.length} fixtures
            </span>
          </div>

          <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-[repeat(auto-fill,minmax(340px,1fr))]">
            {fixtures.map((fixture, fixtureIndex) => {
              const isLiveFixture =
                fixture.fixtureId === liveFixture?.fixtureId;
              return (
                <FixtureCard
                  key={fixture.fixtureId}
                  fixture={
                    isLiveFixture && liveMatch ? liveMatch : fixture
                  }
                  oddsPulses={isLiveFixture ? oddsPulses : undefined}
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
