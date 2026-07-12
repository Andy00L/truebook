"use client";

import { useEffect, useMemo, useState, type PointerEvent } from "react";
import Link from "next/link";
import { PageShell } from "@/components/ui/PageShell";
import { TopBar } from "@/components/ui/TopBar";
import { SurfaceCard } from "@/components/ui/SurfaceCard";
import { StatusPill } from "@/components/ui/StatusPill";
import { HashRow } from "@/components/ui/HashRow";
import { ChipButton } from "@/components/ui/ChipButton";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorPanel } from "@/components/ui/ErrorPanel";
import { Skeleton } from "@/components/ui/Skeleton";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { OdometerNumber } from "@/components/ui/OdometerNumber";
import { PriceEquation } from "@/components/ui/PriceEquation";
import { DotMatrixChart, ChartLegend, type ChartPoint } from "@/components/ui/DotMatrixChart";
import { IconArrow, IconPlay, IconPause } from "@/components/ui/Icon";
import { joinClassNames } from "@/lib/joinClassNames";
import { formatOdds } from "@/lib/format";
import { explorerTxUrl } from "@/lib/data/types";
import {
  DEMO_REPLAYS,
  REPLAY_END_MINUTE,
  getReplayMatch,
  oddsAtMinute,
  scoreAtMinute,
  type ReplayMatch,
} from "@/lib/data/demoReplay";

export type ReplayScreenView = "replay" | "loading" | "empty" | "error";

type ReplaySpeed = 1 | 4 | 16;

/**
 * Engine tick target; the advance is computed from real elapsed time so the
 * replay keeps pace even when a background tab throttles timers. One wall
 * second plays one match minute at 1x.
 */
const ENGINE_TICK_MS = 100;
const MATCH_MINUTES_PER_WALL_SECOND = 1;
const SETTLEMENT_EPSILON_MINUTES = 0.1;

/**
 * The displayed consensus is recovered from the committed margin, exactly as
 * the chain client does (served = consensus minus margin).
 * sourceRef: app/src/lib/chain/truebookClient.ts (marginFactor recovery).
 */
const REPLAY_MARGIN_FACTOR = 1.02;
const REPLAY_MARGIN_LABEL = "2.0%";

/* Chart geometry (700x240 viewBox, labels at y=230, plot band 12..200). */
const CHART_VIEW_WIDTH = 700;
const CHART_VIEW_HEIGHT = 240;
const CHART_PLOT_TOP = 12;
const CHART_PLOT_HEIGHT = 188;
const CHART_LEFT_X = 10;
const CHART_RIGHT_X = 690;
const CHART_MINUTE_LABELS = [0, 15, 30, 45, 60, 75, 90] as const;

function chartX(minute: number): number {
  return (
    CHART_LEFT_X +
    (minute / REPLAY_END_MINUTE) * (CHART_RIGHT_X - CHART_LEFT_X)
  );
}

function ReplaySkeleton() {
  return (
    <div aria-hidden="true">
      <SurfaceCard className="flex flex-wrap justify-between gap-6 p-6">
        <div>
          <Skeleton className="h-5 w-52" />
          <Skeleton className="mt-3 h-3 w-38" />
        </div>
        <div className="flex gap-10">
          <Skeleton className="h-7.5 w-27.5" />
          <Skeleton className="h-7.5 w-27.5" />
        </div>
      </SurfaceCard>
      <SurfaceCard className="mt-5 p-6">
        <Skeleton className="h-60 w-full" />
        <div className="mt-4.5 flex items-center gap-4">
          <Skeleton className="size-11 rounded-full" />
          <Skeleton className="h-10 w-40 rounded-full" />
          <Skeleton className="h-1 flex-1 rounded-full" />
        </div>
      </SurfaceCard>
    </div>
  );
}

type ReplayScreenProps = {
  initialView: ReplayScreenView;
};

/**
 * Replay a settled match (v3 noir): the dot-matrix price chart is the
 * instrument. Scrub it, watch the score and the served price roll digit by
 * digit, and land on the verified settlement.
 */
export function ReplayScreen({ initialView }: ReplayScreenProps) {
  const [view, setView] = useState<ReplayScreenView>(initialView);
  const [selectedReplayId, setSelectedReplayId] = useState(
    DEMO_REPLAYS[0].replayId,
  );
  const [playheadMinute, setPlayheadMinute] = useState(63);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState<ReplaySpeed>(4);
  const [isScrubbing, setIsScrubbing] = useState(false);

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
        if (nextMinute >= REPLAY_END_MINUTE) {
          setIsPlaying(false);
        }
        return nextMinute;
      });
    }, ENGINE_TICK_MS);
    return () => window.clearInterval(engineTimer);
  }, [isPlaying, view, replay, speed]);

  const selectReplay = (replayId: string) => {
    setSelectedReplayId(replayId);
    setPlayheadMinute(0);
    setIsPlaying(false);
  };

  const handlePlayToggle = () => {
    if (playheadMinute >= REPLAY_END_MINUTE) {
      setPlayheadMinute(0);
      setIsPlaying(true);
      return;
    }
    setIsPlaying((wasPlaying) => !wasPlaying);
  };

  const scrubFromPointer = (pointerEvent: PointerEvent<HTMLDivElement>) => {
    const chartBounds = pointerEvent.currentTarget.getBoundingClientRect();
    const pointerFraction =
      (pointerEvent.clientX - chartBounds.left) / chartBounds.width;
    const pointerViewX = pointerFraction * CHART_VIEW_WIDTH;
    const pointerMinute =
      ((pointerViewX - CHART_LEFT_X) / (CHART_RIGHT_X - CHART_LEFT_X)) *
      REPLAY_END_MINUTE;
    setPlayheadMinute(
      Math.max(0, Math.min(REPLAY_END_MINUTE, pointerMinute)),
    );
  };

  const chartScale = useMemo(() => {
    if (!replay) {
      return null;
    }
    const homePrices = replay.quoteSteps.map((quoteStep) => quoteStep[1]);
    const maxPrice = Math.max(...homePrices) * REPLAY_MARGIN_FACTOR;
    const minPrice = Math.min(...homePrices);
    const priceSpan = maxPrice - minPrice || 1;
    const yForPrice = (price: number) =>
      CHART_PLOT_TOP +
      (1 - (price - minPrice) / priceSpan) * CHART_PLOT_HEIGHT;
    const servedPoints: ChartPoint[] = replay.quoteSteps.map((quoteStep) => ({
      x: chartX(quoteStep[0]),
      y: yForPrice(quoteStep[1]),
    }));
    const consensusPoints: ChartPoint[] = replay.quoteSteps.map(
      (quoteStep) => ({
        x: chartX(quoteStep[0]),
        y: yForPrice(quoteStep[1] * REPLAY_MARGIN_FACTOR),
      }),
    );
    return { servedPoints, consensusPoints, yForPrice };
  }, [replay]);

  if (view === "loading") {
    return (
      <PageShell>
        <TopBar active="replay" />
        <ReplaySkeleton />
      </PageShell>
    );
  }

  if (view === "error") {
    return (
      <PageShell>
        <TopBar active="replay" />
        <ErrorPanel
          title="The price history didn't load"
          message="The devnet RPC did not respond. The anchored history is still on chain."
          onRetry={() => setView("replay")}
        />
      </PageShell>
    );
  }

  if (view === "empty" || !replay || !chartScale) {
    return (
      <PageShell>
        <TopBar active="replay" />
        <EmptyState
          message="No settled matches to replay yet. A match appears here once its score proof anchors."
          action={
            <Link
              href="/"
              className="focus-ring rounded-full px-2 py-2 text-sm font-medium text-accent no-underline hover:underline"
            >
              Back to the lobby
            </Link>
          }
        />
      </PageShell>
    );
  }

  const currentOdds = oddsAtMinute(replay, playheadMinute);
  const kickoffOdds = oddsAtMinute(replay, 0);
  const currentScore = scoreAtMinute(replay, playheadMinute);
  const scoreText = `${currentScore.homeScore} - ${currentScore.awayScore}`;
  const servedText = formatOdds(currentOdds.home);
  const consensusText = formatOdds(currentOdds.home * REPLAY_MARGIN_FACTOR);
  const oddsDelta = currentOdds.home - kickoffOdds.home;
  const deltaPercent = Math.abs((oddsDelta / kickoffOdds.home) * 100).toFixed(1);
  const deltaText = `${oddsDelta >= 0 ? "+" : "-"}${Math.abs(oddsDelta).toFixed(2)} (${deltaPercent}%)`;
  const isSettled =
    playheadMinute >= REPLAY_END_MINUTE - SETTLEMENT_EPSILON_MINUTES;
  const playheadLeftPercent = `${((chartX(playheadMinute) / CHART_VIEW_WIDTH) * 100).toFixed(2)}%`;
  const playheadDotTopPercent = `${((chartScale.yForPrice(currentOdds.home) / CHART_VIEW_HEIGHT) * 100).toFixed(2)}%`;
  const settlementOutcome = replay.homeWinHolds ? "YES holds" : "NO holds";

  return (
    <PageShell>
      <TopBar active="replay" />

      <div className="flex flex-wrap items-center justify-between gap-4 px-1 pb-4">
        <span className="text-sm text-ink-muted">Replay</span>
        <div className="flex flex-wrap gap-2">
          {DEMO_REPLAYS.map((replayOption) => (
            <ChipButton
              key={replayOption.replayId}
              isActive={selectedReplayId === replayOption.replayId}
              onClick={() => selectReplay(replayOption.replayId)}
            >
              {replayOption.homeTeam} vs {replayOption.awayTeam}
              <span className="text-xs tabular-nums opacity-70">
                {replayOption.pickerDateLabel}
              </span>
            </ChipButton>
          ))}
        </div>
      </div>

      <SurfaceCard className="flex animate-card-in flex-wrap items-start justify-between gap-7 p-6">
        <div>
          <div className="text-xl font-medium tracking-tight text-ink">
            {replay.homeTeam} vs {replay.awayTeam}
          </div>
          <div className="mt-1.5 text-sm text-ink-muted">{replay.subLine}</div>
        </div>
        <div className="flex flex-wrap items-start gap-11">
          <div>
            <div className="text-sm text-ink-muted">Score</div>
            <div className="mt-1 flex items-baseline gap-2.5">
              <OdometerNumber
                value={scoreText}
                className="text-2xl font-light tabular-nums leading-tight tracking-tight text-ink"
              />
              <span className="font-mono text-sm tabular-nums text-ink-muted">
                {Math.floor(playheadMinute)}&apos;
              </span>
            </div>
          </div>
          <div>
            <div className="text-sm text-ink-muted">
              Home win · {replay.homeTeam}
            </div>
            <OdometerNumber
              value={servedText}
              className="mt-1 text-2xl font-light tabular-nums leading-tight tracking-tight text-ink"
            />
            <div
              className={joinClassNames(
                "mt-2 inline-flex items-center gap-1.5 text-sm font-medium tabular-nums",
                oddsDelta >= 0 ? "text-accent" : "text-danger",
              )}
            >
              <IconArrow direction={oddsDelta >= 0 ? "upRight" : "downRight"} />
              <span>{deltaText}</span>
              <span className="font-normal text-ink-muted">since kickoff</span>
            </div>
            <div className="mt-2.5">
              <PriceEquation
                consensusLabel={consensusText}
                marginLabel={REPLAY_MARGIN_LABEL}
                servedLabel={servedText}
              />
            </div>
          </div>
        </div>
      </SurfaceCard>

      <SurfaceCard
        className="mt-5 animate-card-in p-6"
        style={{ animationDelay: "40ms" }}
      >
        <div className="mb-2">
          <ChartLegend />
        </div>
        <div
          aria-hidden="true"
          className="relative h-60 cursor-ew-resize touch-none"
          onPointerDown={(pointerEvent) => {
            pointerEvent.currentTarget.setPointerCapture(
              pointerEvent.pointerId,
            );
            setIsScrubbing(true);
            setIsPlaying(false);
            scrubFromPointer(pointerEvent);
          }}
          onPointerMove={(pointerEvent) => {
            if (isScrubbing) {
              scrubFromPointer(pointerEvent);
            }
          }}
          onPointerUp={() => setIsScrubbing(false)}
        >
          <DotMatrixChart
            servedPoints={chartScale.servedPoints}
            consensusPoints={chartScale.consensusPoints}
            viewWidth={CHART_VIEW_WIDTH}
            viewHeight={CHART_VIEW_HEIGHT}
            fillBaselineY={200}
            drawOnLoad
            ariaLabel={`Served home-win price against consensus for ${replay.homeTeam} vs ${replay.awayTeam}`}
          >
            {CHART_MINUTE_LABELS.map((minuteLabel) => (
              <text
                key={minuteLabel}
                x={chartX(minuteLabel)}
                y={230}
                fill="var(--color-ink-muted)"
                fontSize="11"
                textAnchor="middle"
              >
                {minuteLabel}&apos;
              </text>
            ))}
          </DotMatrixChart>
          <div
            className="pointer-events-none absolute top-[5%] h-[78%] w-px bg-ink opacity-85"
            style={{ left: playheadLeftPercent }}
          />
          <div
            className="pointer-events-none absolute size-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent"
            style={{ left: playheadLeftPercent, top: playheadDotTopPercent }}
          />
          <div
            className="pointer-events-none absolute top-0 -translate-x-1/2 rounded-full bg-elevated px-2.5 py-1 font-mono text-2xs tabular-nums text-ink"
            style={{ left: playheadLeftPercent }}
          >
            {Math.floor(playheadMinute)}&apos;
          </div>
        </div>

        <div className="mt-4.5 flex flex-wrap items-center gap-4">
          <button
            type="button"
            onClick={handlePlayToggle}
            aria-label={isPlaying ? "Pause replay" : "Play replay"}
            className="transition-press focus-ring relative inline-flex size-11 flex-none cursor-pointer items-center justify-center rounded-full border-0 bg-elevated text-ink hover:brightness-130 active:scale-97"
          >
            <span
              className={joinClassNames(
                "absolute inline-flex transition-opacity duration-120 ease-standard",
                isPlaying ? "opacity-0" : "opacity-100",
              )}
            >
              <IconPlay />
            </span>
            <span
              className={joinClassNames(
                "absolute inline-flex transition-opacity duration-120 ease-standard",
                isPlaying ? "opacity-100" : "opacity-0",
              )}
            >
              <IconPause />
            </span>
          </button>
          <SegmentedControl
            ariaLabel="Replay speed"
            activeKey={String(speed)}
            onSelect={(speedKey) =>
              setSpeed(Number.parseInt(speedKey, 10) as ReplaySpeed)
            }
            options={[
              { key: "1", label: "1x" },
              { key: "4", label: "4x" },
              { key: "16", label: "16x" },
            ]}
          />
          <input
            type="range"
            className="replay-scrub h-4 min-w-40 flex-1 cursor-pointer"
            aria-label="Match minute"
            min={0}
            max={REPLAY_END_MINUTE}
            step={1}
            value={Math.floor(playheadMinute)}
            onChange={(changeEvent) => {
              setIsPlaying(false);
              setPlayheadMinute(
                Number.parseInt(changeEvent.target.value, 10) || 0,
              );
            }}
          />
        </div>

        <div
          className="grid transition-[grid-template-rows] duration-250 ease-standard"
          style={{ gridTemplateRows: isSettled ? "1fr" : "0fr" }}
        >
          <div className="overflow-hidden">
            {isSettled ? (
              <div className="mt-4.5 rounded-sm bg-elevated px-4.5 py-2.5">
                <div
                  className="flex animate-card-in items-center justify-between py-2"
                  style={{ animationDelay: "0ms" }}
                >
                  <span className="text-sm text-ink-muted">Outcome</span>
                  <span className="text-base font-medium text-ink">
                    {settlementOutcome} · {replay.resultScoreLine}
                  </span>
                </div>
                <div
                  className="animate-card-in"
                  style={{ animationDelay: "40ms" }}
                >
                  <HashRow
                    label="Day root"
                    value={replay.dayRoot}
                    href={explorerTxUrl(replay.verifyTx)}
                  />
                  <HashRow
                    label="Verify tx"
                    value={replay.verifyTx}
                    href={explorerTxUrl(replay.verifyTx)}
                  />
                </div>
                <div className="flex flex-wrap items-center justify-center gap-4 py-3">
                  <StatusPill variant="accent" animateIn animateInDelayMs={420}>
                    Verified on Solana
                  </StatusPill>
                  <Link
                    href={replay.verifyPageHref}
                    className="focus-ring rounded-full px-1 py-1 text-sm font-medium text-accent no-underline hover:underline"
                  >
                    Public verify page
                  </Link>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </SurfaceCard>
    </PageShell>
  );
}
