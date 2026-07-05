"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { PageShell } from "@/components/ui/PageShell";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { SurfaceCard } from "@/components/ui/SurfaceCard";
import { StatusPill } from "@/components/ui/StatusPill";
import { Stamp } from "@/components/ui/Stamp";
import { HashRow } from "@/components/ui/HashRow";
import { ChipButton } from "@/components/ui/ChipButton";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorPanel } from "@/components/ui/ErrorPanel";
import { Skeleton } from "@/components/ui/Skeleton";
import { joinClassNames } from "@/lib/joinClassNames";
import { formatOdds } from "@/lib/format";
import { explorerTxUrl } from "@/lib/data/types";
import {
  DEMO_REPLAYS,
  REPLAY_END_MINUTE,
  getReplayMatch,
  oddsAtMinute,
  scoreAtMinute,
  type ReplayOddsSnapshot,
} from "@/lib/data/demoReplay";
import type { OddsMovePulse } from "@/lib/data/useDemoMatch";

export type ReplayScreenView = "replay" | "loading" | "empty" | "error";

type ReplaySpeed = 1 | 4 | 16;

/**
 * Engine tick target; the advance is computed from real elapsed time so the
 * replay keeps pace even when a background tab throttles timers. One wall
 * second plays one match minute at 1x.
 */
const ENGINE_TICK_MS = 100;
const MATCH_MINUTES_PER_WALL_SECOND = 1;
/** sourceRef: docs/UI_DESIGN_SYSTEM.md motion tokens (odds tick 300ms) */
const PULSE_CLEAR_MS = 300;
const SETTLEMENT_EPSILON_MINUTES = 0.1;

const ODDS_KEYS = ["home", "draw", "away", "over", "under"] as const;
type OddsKey = (typeof ODDS_KEYS)[number];

function formatReplayClock(minute: number): string {
  const wholeMinutes = String(Math.floor(minute)).padStart(2, "0");
  const seconds = String(Math.floor((minute % 1) * 60)).padStart(2, "0");
  return `${wholeMinutes}:${seconds}`;
}

function ReplaySkeleton() {
  return (
    <div aria-hidden="true" className="flex flex-col gap-4">
      <div className="flex gap-2">
        {[0, 1, 2].map((chipIndex) => (
          <Skeleton key={chipIndex} className="h-11 w-55 rounded-sm" />
        ))}
      </div>
      <SurfaceCard className="flex flex-wrap gap-6 p-5">
        <div className="min-w-60 flex-1">
          <Skeleton className="h-3 w-50" />
          <Skeleton className="mt-3 h-7 w-70 max-w-9/10" />
        </div>
        <div className="min-w-75 flex-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="mt-3.5 h-8 w-3/5" />
        </div>
      </SurfaceCard>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-[repeat(auto-fit,minmax(320px,1fr))]">
        {[0, 1].map((cardIndex) => (
          <SurfaceCard key={cardIndex} className="p-5">
            <Skeleton
              className="h-3 w-30"
              style={{ animationDelay: `${(cardIndex + 1) * 120}ms` }}
            />
            <div className="mt-3.5 flex gap-2">
              {[0, 1, 2].slice(0, cardIndex === 0 ? 3 : 2).map((cellIndex) => (
                <Skeleton
                  key={cellIndex}
                  className="h-18 flex-1"
                  style={{ animationDelay: `${(cardIndex + 1) * 120}ms` }}
                />
              ))}
            </div>
          </SurfaceCard>
        ))}
      </div>
    </div>
  );
}

function ReplayOddsCell({
  label,
  priceLabel,
  pulse,
}: {
  label: string;
  priceLabel: string;
  pulse: OddsMovePulse | null;
}) {
  const backgroundClass =
    pulse === "shorten"
      ? "bg-accent-soft"
      : pulse === "lengthen"
        ? "bg-danger-soft"
        : "bg-elevated";
  return (
    <div
      className={joinClassNames(
        "flex min-h-18 min-w-25 flex-1 basis-0 flex-col items-center justify-center gap-1.5 rounded-sm border border-border p-3 transition-[background-color] duration-300 ease-standard",
        backgroundClass,
      )}
    >
      <span className="eyebrow text-ink-muted">{label}</span>
      <span className="font-mono text-xl font-semibold tabular-nums text-ink">
        {priceLabel}
      </span>
    </div>
  );
}

type ReplayScreenProps = {
  initialView: ReplayScreenView;
};

/** Replay a settled match: score, moving quotes, settlement at the end. */
export function ReplayScreen({ initialView }: ReplayScreenProps) {
  const [view, setView] = useState<ReplayScreenView>(initialView);
  const [selectedReplayId, setSelectedReplayId] = useState(
    DEMO_REPLAYS[0].replayId,
  );
  const [playheadMinute, setPlayheadMinute] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState<ReplaySpeed>(4);
  const [oddsPulses, setOddsPulses] = useState<Record<string, OddsMovePulse>>(
    {},
  );
  const previousOddsRef = useRef<ReplayOddsSnapshot | null>(null);
  const pulseTimersRef = useRef<Partial<Record<OddsKey, number>>>({});

  const replay = getReplayMatch(selectedReplayId);

  // The replay engine: a wall-clock interval driving the match playhead.
  useEffect(() => {
    if (!isPlaying || view !== "replay" || !replay) {
      return;
    }
    let lastTickAt = performance.now();
    const engineTimer = window.setInterval(() => {
      const now = performance.now();
      const elapsedSeconds = (now - lastTickAt) / 1000;
      lastTickAt = now;
      setPlayheadMinute((previousMinute) => {
        const nextMinute = Math.min(
          REPLAY_END_MINUTE,
          previousMinute +
            elapsedSeconds * MATCH_MINUTES_PER_WALL_SECOND * speed,
        );
        const nextOdds = oddsAtMinute(replay, nextMinute);
        const previousOdds = previousOddsRef.current ?? nextOdds;
        for (const oddsKey of ODDS_KEYS) {
          if (nextOdds[oddsKey] !== previousOdds[oddsKey]) {
            const pulseDirection: OddsMovePulse =
              nextOdds[oddsKey] < previousOdds[oddsKey]
                ? "shorten"
                : "lengthen";
            setOddsPulses((currentPulses) => ({
              ...currentPulses,
              [oddsKey]: pulseDirection,
            }));
            const pendingTimer = pulseTimersRef.current[oddsKey];
            if (pendingTimer !== undefined) {
              window.clearTimeout(pendingTimer);
            }
            pulseTimersRef.current[oddsKey] = window.setTimeout(() => {
              setOddsPulses((currentPulses) => {
                const remainingPulses = { ...currentPulses };
                delete remainingPulses[oddsKey];
                return remainingPulses;
              });
            }, PULSE_CLEAR_MS);
          }
        }
        previousOddsRef.current = nextOdds;
        if (nextMinute >= REPLAY_END_MINUTE) {
          setIsPlaying(false);
        }
        return nextMinute;
      });
    }, ENGINE_TICK_MS);
    return () => window.clearInterval(engineTimer);
  }, [isPlaying, view, replay, speed]);

  // Clear any pending pulse timers when the screen unmounts.
  useEffect(() => {
    const pulseTimers = pulseTimersRef.current;
    return () => {
      for (const timerId of Object.values(pulseTimers)) {
        if (timerId !== undefined) {
          window.clearTimeout(timerId);
        }
      }
    };
  }, []);

  const selectReplay = (replayId: string) => {
    setSelectedReplayId(replayId);
    setPlayheadMinute(0);
    setIsPlaying(false);
    setOddsPulses({});
    previousOddsRef.current = null;
  };

  const handlePlayToggle = () => {
    if (playheadMinute >= REPLAY_END_MINUTE) {
      previousOddsRef.current = replay ? oddsAtMinute(replay, 0) : null;
      setPlayheadMinute(0);
      setOddsPulses({});
      setIsPlaying(true);
      return;
    }
    setIsPlaying((wasPlaying) => !wasPlaying);
  };

  const handleSeek = (rawValue: string) => {
    const seekMinute = Number.parseFloat(rawValue) || 0;
    previousOddsRef.current = replay ? oddsAtMinute(replay, seekMinute) : null;
    setPlayheadMinute(seekMinute);
    setOddsPulses({});
  };

  const currentOdds = replay ? oddsAtMinute(replay, playheadMinute) : null;
  const currentScore = replay
    ? scoreAtMinute(replay, playheadMinute)
    : { homeScore: 0, awayScore: 0 };
  const isSettled =
    playheadMinute >= REPLAY_END_MINUTE - SETTLEMENT_EPSILON_MINUTES;

  return (
    <PageShell>
      <Breadcrumb
        withMascot
        tagline="Provably-fair sportsbook on Solana"
        segments={[{ label: "Fixtures", href: "/" }, { label: "Replay" }]}
      />

      {view === "loading" ? (
        <ReplaySkeleton />
      ) : view === "error" ? (
        <ErrorPanel
          title="Couldn't load the replay"
          message="The archived quote stream didn't respond."
          onRetry={() => setView("replay")}
        />
      ) : view === "empty" || !replay || !currentOdds ? (
        <EmptyState
          message="No replayable match in this window."
          action={
            <Link
              href="/"
              className="focus-ring rounded-sm border border-transparent px-2 py-3 text-sm text-accent no-underline hover:underline"
            >
              Browse fixtures →
            </Link>
          }
        />
      ) : (
        <>
          <div className="flex items-baseline justify-between gap-4">
            <span className="eyebrow text-ink-muted">
              Replay a settled match
            </span>
            <span className="font-mono text-xs tabular-nums text-ink-faint">
              {DEMO_REPLAYS.length} matches replayable
            </span>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            {DEMO_REPLAYS.map((replayOption) => (
              <ChipButton
                key={replayOption.replayId}
                isActive={selectedReplayId === replayOption.replayId}
                onClick={() => selectReplay(replayOption.replayId)}
              >
                {replayOption.homeTeam} vs {replayOption.awayTeam}
                <span className="font-mono text-xs tabular-nums text-ink-faint">
                  {replayOption.pickerDateLabel}
                </span>
              </ChipButton>
            ))}
          </div>

          <SurfaceCard className="mt-4 flex animate-card-in flex-wrap items-center gap-7 p-5">
            <div className="min-w-62 flex-1 basis-70">
              <div className="eyebrow text-ink-faint">{replay.subLine}</div>
              <div className="mt-2.5 flex flex-wrap items-baseline gap-3.5">
                <span className="text-xl font-semibold text-ink">
                  {replay.homeTeam}
                </span>
                <span className="font-mono text-2xl font-semibold leading-none tabular-nums text-ink">
                  {currentScore.homeScore} - {currentScore.awayScore}
                </span>
                <span className="text-xl font-semibold text-ink">
                  {replay.awayTeam}
                </span>
              </div>
              <div className="mt-2.5 flex items-center gap-3">
                <StatusPill variant="neutral">REPLAY</StatusPill>
                <span className="font-mono text-lg tabular-nums text-ink">
                  {formatReplayClock(playheadMinute)}
                </span>
                <span className="font-mono text-xs tabular-nums text-ink-faint">
                  / {REPLAY_END_MINUTE}:00
                </span>
              </div>
            </div>

            <div className="min-w-75 flex-2 basis-90">
              <div className="relative h-11">
                <div className="absolute inset-x-0 top-5 h-1 rounded-sm bg-border" />
                <div
                  className="absolute left-0 top-5 h-1 rounded-sm bg-accent-deep"
                  style={{
                    width: `${((playheadMinute / REPLAY_END_MINUTE) * 100).toFixed(2)}%`,
                  }}
                />
                {replay.goals.map((goal) => (
                  <div
                    key={`${goal.side}-${goal.minute}`}
                    className="absolute top-4.5 size-2 -translate-x-1/2 rounded-sm bg-ink"
                    style={{
                      left: `${((goal.minute / REPLAY_END_MINUTE) * 100).toFixed(1)}%`,
                    }}
                  />
                ))}
                <div className="absolute left-full top-4.5 size-2 -translate-x-1/2 rounded-sm bg-accent" />
                <input
                  type="range"
                  className="replay-scrub absolute inset-0 h-11 w-full cursor-pointer"
                  aria-label="Replay timeline"
                  min={0}
                  max={REPLAY_END_MINUTE}
                  step={0.1}
                  value={playheadMinute}
                  onChange={(changeEvent) =>
                    handleSeek(changeEvent.target.value)
                  }
                />
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handlePlayToggle}
                  aria-label={isPlaying ? "Pause replay" : "Play replay"}
                  className="transition-press focus-ring flex size-11 cursor-pointer items-center justify-center rounded-md border border-accent bg-accent font-mono text-base text-on-accent active:scale-98"
                >
                  {isPlaying ? "❚❚" : "▶"}
                </button>
                <div className="ml-2 flex gap-1">
                  {([1, 4, 16] as const).map((speedOption) => (
                    <ChipButton
                      key={speedOption}
                      isActive={speed === speedOption}
                      onClick={() => setSpeed(speedOption)}
                      className="px-3 font-mono text-xs tabular-nums"
                    >
                      {speedOption}x
                    </ChipButton>
                  ))}
                </div>
                <span className="ml-auto font-mono text-xs tabular-nums text-ink-faint">
                  goals and settlement marked on the timeline
                </span>
              </div>
            </div>
          </SurfaceCard>

          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-[repeat(auto-fit,minmax(320px,1fr))]">
            <SurfaceCard
              className="animate-card-in p-5"
              style={{ animationDelay: "40ms" }}
            >
              <div className="flex items-baseline justify-between gap-3">
                <h3 className="m-0 text-base font-semibold text-ink">
                  Home win
                </h3>
                <span className="eyebrow font-mono text-ink-faint">1x2</span>
              </div>
              <div className="mt-3.5 flex gap-2 overflow-x-auto">
                <ReplayOddsCell
                  label={replay.homeTeam}
                  priceLabel={formatOdds(currentOdds.home)}
                  pulse={oddsPulses.home ?? null}
                />
                <ReplayOddsCell
                  label="Draw"
                  priceLabel={formatOdds(currentOdds.draw)}
                  pulse={oddsPulses.draw ?? null}
                />
                <ReplayOddsCell
                  label={replay.awayTeam}
                  priceLabel={formatOdds(currentOdds.away)}
                  pulse={oddsPulses.away ?? null}
                />
              </div>
            </SurfaceCard>

            <SurfaceCard
              className="animate-card-in p-5"
              style={{ animationDelay: "80ms" }}
            >
              <div className="flex items-baseline justify-between gap-3">
                <h3 className="m-0 text-base font-semibold text-ink">
                  Over 2.5 goals
                </h3>
                <span className="eyebrow font-mono text-ink-faint">totals</span>
              </div>
              <div className="mt-3.5 flex gap-2 overflow-x-auto">
                <ReplayOddsCell
                  label="Over 2.5"
                  priceLabel={formatOdds(currentOdds.over)}
                  pulse={oddsPulses.over ?? null}
                />
                <ReplayOddsCell
                  label="Under 2.5"
                  priceLabel={formatOdds(currentOdds.under)}
                  pulse={oddsPulses.under ?? null}
                />
              </div>
            </SurfaceCard>

            {isSettled ? (
              <SurfaceCard elevated className="receipt-edge animate-card-in p-5">
                <div className="eyebrow text-ink-faint">Settlement fired</div>
                <div className="mt-3 flex flex-col gap-2 font-mono text-sm tabular-nums">
                  <div className="flex justify-between gap-4">
                    <span className="text-ink-muted">final score</span>
                    <span className="text-ink">{replay.resultScoreLine}</span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-ink-muted">home win holds</span>
                    <span className="text-ink">
                      {String(replay.homeWinHolds)}
                    </span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-ink-muted">over 2.5 holds</span>
                    <span className="text-ink">{String(replay.overHolds)}</span>
                  </div>
                </div>
                <div className="mb-2.5 mt-3.5 border-t border-dashed border-border" />
                <div className="flex flex-col gap-1">
                  <HashRow
                    label="day root"
                    value={replay.dayRoot}
                    href={explorerTxUrl(replay.verifyTx)}
                    labelWidthClass="w-20"
                  />
                  <HashRow
                    label="verify tx"
                    value={replay.verifyTx}
                    href={explorerTxUrl(replay.verifyTx)}
                    labelWidthClass="w-20"
                  />
                </div>
                <div className="mt-3.5 flex flex-wrap items-center gap-4">
                  <Stamp tone="accent">VERIFIED ON SOLANA</Stamp>
                  <Link
                    href={replay.verifyPageHref}
                    className="focus-ring rounded-sm border border-transparent px-1 py-3 font-mono text-xs text-accent no-underline hover:underline"
                  >
                    public verify page →
                  </Link>
                </div>
              </SurfaceCard>
            ) : null}
          </div>
        </>
      )}
    </PageShell>
  );
}
