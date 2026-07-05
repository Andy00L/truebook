"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { getDemoFixture } from "@/lib/data/demoFixtures";
import type { MatchView } from "@/lib/data/types";

/**
 * Demo provider for the match screen. Simulates the live feed the keeper
 * will supply from TxLINE once the program is deployed: a running match
 * clock, small odds moves with green/red pulses, and the screen states.
 */

export type MatchScreenView = "loading" | "live" | "postMatch" | "oddsError";

export type OddsMovePulse = "shorten" | "lengthen";

type LiveOdds = { served: number; consensus: number };

type DemoMatchState = {
  view: MatchScreenView;
  match: MatchView | null;
  oddsPulses: Record<string, OddsMovePulse>;
  retryOdds: () => void;
};

const LOADING_RESOLVE_MS = 1600;
const ODDS_MOVE_INTERVAL_MS = 4000;
/** sourceRef: docs/UI_DESIGN_SYSTEM.md motion tokens (odds tick 300ms) */
const PULSE_CLEAR_MS = 300;

function buildInitialOdds(fixture: MatchView | null): Record<string, LiveOdds> {
  const initialOdds: Record<string, LiveOdds> = {};
  if (!fixture) {
    return initialOdds;
  }
  for (const market of fixture.markets) {
    for (const outcome of market.outcomes) {
      initialOdds[outcome.outcomeKey] = {
        served: outcome.servedOdds,
        consensus: outcome.consensusOdds,
      };
    }
  }
  return initialOdds;
}

export function useDemoMatch(
  fixtureId: string,
  initialView: MatchScreenView,
): DemoMatchState {
  const fixture = useMemo(() => getDemoFixture(fixtureId), [fixtureId]);
  const [view, setView] = useState<MatchScreenView>(() =>
    fixture?.phase === "finished" ? "postMatch" : initialView,
  );
  const [clockSeconds, setClockSeconds] = useState(fixture?.clockSeconds ?? 0);
  const [oddsByOutcome, setOddsByOutcome] = useState<Record<string, LiveOdds>>(
    () => buildInitialOdds(fixture),
  );
  const [oddsPulses, setOddsPulses] = useState<Record<string, OddsMovePulse>>(
    {},
  );
  const pulseTimersRef = useRef<number[]>([]);

  const isFixtureLive = fixture?.phase === "live";

  // Demo skeleton resolves into the live board after one pulse (browser timer).
  useEffect(() => {
    if (view !== "loading") {
      return;
    }
    const resolveTimer = window.setTimeout(() => {
      setView(fixture?.phase === "finished" ? "postMatch" : "live");
    }, LOADING_RESOLVE_MS);
    return () => window.clearTimeout(resolveTimer);
  }, [view, fixture]);

  // Match clock, one tick per second while the fixture is live (browser timer).
  useEffect(() => {
    if (!isFixtureLive || (view !== "live" && view !== "oddsError")) {
      return;
    }
    const clockTimer = window.setInterval(() => {
      setClockSeconds((previousSeconds) => previousSeconds + 1);
    }, 1000);
    return () => window.clearInterval(clockTimer);
  }, [isFixtureLive, view]);

  // Odds random walk simulating consensus moves (browser timer).
  useEffect(() => {
    if (!isFixtureLive || view !== "live") {
      return;
    }
    const moveTimer = window.setInterval(() => {
      setOddsByOutcome((previousOdds) => {
        const outcomeKeys = Object.keys(previousOdds);
        if (outcomeKeys.length === 0) {
          return previousOdds;
        }
        const movedKey =
          outcomeKeys[Math.floor(Math.random() * outcomeKeys.length)];
        const direction = Math.random() < 0.5 ? -1 : 1;
        const delta =
          direction * (0.01 + Math.floor(Math.random() * 4) * 0.01);
        const moved = previousOdds[movedKey];
        const nextOdds: Record<string, LiveOdds> = {
          ...previousOdds,
          [movedKey]: {
            served: Math.max(1.01, Number((moved.served + delta).toFixed(2))),
            consensus: Math.max(
              1.02,
              Number((moved.consensus + delta).toFixed(2)),
            ),
          },
        };
        setOddsPulses((previousPulses) => ({
          ...previousPulses,
          [movedKey]: direction < 0 ? "shorten" : "lengthen",
        }));
        const clearTimer = window.setTimeout(() => {
          setOddsPulses((previousPulses) => {
            const remainingPulses = { ...previousPulses };
            delete remainingPulses[movedKey];
            return remainingPulses;
          });
        }, PULSE_CLEAR_MS);
        pulseTimersRef.current.push(clearTimer);
        return nextOdds;
      });
    }, ODDS_MOVE_INTERVAL_MS);
    return () => window.clearInterval(moveTimer);
  }, [isFixtureLive, view]);

  // Clear any pending pulse timers when the screen unmounts.
  useEffect(() => {
    const pulseTimers = pulseTimersRef.current;
    return () => {
      for (const timerId of pulseTimers) {
        window.clearTimeout(timerId);
      }
    };
  }, []);

  const match = useMemo<MatchView | null>(() => {
    if (!fixture) {
      return null;
    }
    // The post-match view presents the fixture as finished even when the
    // underlying demo fixture is still live (judge-visible state override).
    const presentsAsFinished = view === "postMatch";
    return {
      ...fixture,
      phase: presentsAsFinished ? "finished" : fixture.phase,
      periodNote: presentsAsFinished ? "Full time" : fixture.periodNote,
      clockSeconds,
      markets: fixture.markets.map((market) => ({
        ...market,
        outcomes: market.outcomes.map((outcome) => {
          const liveOdds = oddsByOutcome[outcome.outcomeKey];
          if (!liveOdds) {
            return outcome;
          }
          return {
            ...outcome,
            servedOdds: liveOdds.served,
            consensusOdds: liveOdds.consensus,
          };
        }),
      })),
    };
  }, [fixture, view, clockSeconds, oddsByOutcome]);

  return {
    view,
    match,
    oddsPulses,
    retryOdds: () => setView("live"),
  };
}
