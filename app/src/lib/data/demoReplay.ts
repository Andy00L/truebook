/**
 * Demo replay archive: three settled matches with their goal times, quote
 * history, and settlement proofs. The chain provider will rebuild the same
 * shapes from the TxLINE /api/scores/historical stream and archived quotes.
 */

/** Regulation plus stoppage; the timeline runs 0 to 94 minutes. */
export const REPLAY_END_MINUTE = 94;

/** One quote step: [minute, home, draw, away, over25, under25]. */
type QuoteStep = readonly [number, number, number, number, number, number];

export type ReplayOddsSnapshot = {
  home: number;
  draw: number;
  away: number;
  over: number;
  under: number;
};

export type ReplayMatch = {
  replayId: string;
  homeTeam: string;
  awayTeam: string;
  pickerDateLabel: string;
  subLine: string;
  goals: ReadonlyArray<{ minute: number; side: "home" | "away" }>;
  quoteSteps: ReadonlyArray<QuoteStep>;
  resultScoreLine: string;
  homeWinHolds: boolean;
  overHolds: boolean;
  dayRoot: string;
  verifyTx: string;
  verifyPageHref: string;
};

export const DEMO_REPLAYS: ReadonlyArray<ReplayMatch> = [
  {
    replayId: "ned-jpn",
    homeTeam: "Netherlands",
    awayTeam: "Japan",
    pickerDateLabel: "Jul 1",
    subLine: "Quarter-final · Jul 1 · settled",
    goals: [
      { minute: 23, side: "home" },
      { minute: 71, side: "home" },
    ],
    quoteSteps: [
      [0, 1.95, 3.3, 4.1, 1.8, 2.0],
      [8, 1.9, 3.35, 4.25, 1.83, 1.97],
      [15, 1.98, 3.25, 4.0, 1.78, 2.02],
      [23, 1.52, 4.3, 6.6, 1.62, 2.28],
      [31, 1.55, 4.2, 6.4, 1.68, 2.2],
      [40, 1.48, 4.5, 7.2, 1.75, 2.1],
      [45, 1.45, 4.7, 7.6, 1.85, 1.98],
      [54, 1.4, 5.1, 8.5, 2.0, 1.85],
      [62, 1.35, 5.6, 9.8, 2.2, 1.7],
      [71, 1.08, 12.5, 26.0, 2.45, 1.55],
      [80, 1.04, 17.0, 34.0, 3.1, 1.35],
      [88, 1.01, 29.0, 51.0, 5.5, 1.14],
    ],
    resultScoreLine: "Netherlands 2 - 0 Japan",
    homeWinHolds: true,
    overHolds: false,
    dayRoot:
      "9c4e2a6f8d1b3e5c7a9f2d4b6e8c0a1f3d5b7e9c2a4f6d8b0e1c3a5f7d9b25d1b77",
    verifyTx: "4Fg7wRpVq2ZkQmXj8yTnBcHsDe3MxUvKaPr5EJ9tYiA6wSg1hFb2mCzXkpQm2Ze",
    verifyPageHref: "/verify/18172390-1x2",
  },
  {
    replayId: "mar-eng",
    homeTeam: "Morocco",
    awayTeam: "England",
    pickerDateLabel: "Jul 2",
    subLine: "Semi-final · Jul 2 · settled",
    goals: [
      { minute: 12, side: "home" },
      { minute: 55, side: "away" },
      { minute: 88, side: "away" },
    ],
    quoteSteps: [
      [0, 3.6, 3.3, 2.1, 1.95, 1.87],
      [6, 3.75, 3.3, 2.05, 1.98, 1.84],
      [12, 2.35, 3.4, 3.1, 1.8, 2.02],
      [20, 2.45, 3.35, 3.0, 1.88, 1.94],
      [30, 2.6, 3.25, 2.85, 2.0, 1.83],
      [45, 2.8, 3.1, 2.65, 2.2, 1.68],
      [55, 4.9, 3.6, 1.85, 1.9, 1.92],
      [64, 5.4, 3.75, 1.75, 2.05, 1.8],
      [75, 6.2, 3.9, 1.62, 2.3, 1.62],
      [88, 15.0, 8.5, 1.1, 1.3, 3.4],
    ],
    resultScoreLine: "Morocco 1 - 2 England",
    homeWinHolds: false,
    overHolds: true,
    dayRoot:
      "7be1f4a9c2d5e8b1f3a6c9d2e5b8f1a4c7d0e3b6f9a2c5d8e1b4f7a0c3d6e920ce88",
    verifyTx: "2ZqWk8RpVq3XkQmYj7yTnBcHsDe4MxUvKaPr6EJ8tYiA5wSg2hFb3mCzXtHn5Rd",
    verifyPageHref: "/verify/18172391-1x2",
  },
  {
    replayId: "cro-den",
    homeTeam: "Croatia",
    awayTeam: "Denmark",
    pickerDateLabel: "Jul 3",
    subLine: "Quarter-final · Jul 3 · settled",
    goals: [],
    quoteSteps: [
      [0, 2.45, 3.05, 3.2, 2.05, 1.78],
      [15, 2.5, 3.0, 3.15, 2.15, 1.72],
      [30, 2.6, 2.9, 3.05, 2.35, 1.6],
      [45, 2.75, 2.75, 2.95, 2.6, 1.48],
      [60, 2.95, 2.55, 2.8, 3.1, 1.32],
      [75, 3.3, 2.25, 2.65, 4.2, 1.18],
      [85, 3.9, 1.9, 2.55, 6.5, 1.08],
    ],
    resultScoreLine: "Croatia 0 - 0 Denmark",
    homeWinHolds: false,
    overHolds: false,
    dayRoot:
      "3af8c2d6e9b1f4a7c0d3e6b9f2a5c8d1e4b7f0a3c6d9e2b5f8a1c4d7e0b391d4e7",
    verifyTx: "6Hj3kTpVq5XkQmZj9yTnBcHsDe2MxUvKaPr4EJ7tYiA8wSg3hFb1mCzXmWq8Xc",
    verifyPageHref: "/verify/18172392-1x2",
  },
];

export function getReplayMatch(replayId: string): ReplayMatch | null {
  return DEMO_REPLAYS.find((replay) => replay.replayId === replayId) ?? null;
}

/** Quotes in force at a given minute: the last step at or before it. */
export function oddsAtMinute(
  replay: ReplayMatch,
  minute: number,
): ReplayOddsSnapshot {
  let currentStep = replay.quoteSteps[0];
  for (const quoteStep of replay.quoteSteps) {
    if (quoteStep[0] <= minute) {
      currentStep = quoteStep;
    } else {
      break;
    }
  }
  return {
    home: currentStep[1],
    draw: currentStep[2],
    away: currentStep[3],
    over: currentStep[4],
    under: currentStep[5],
  };
}

export function scoreAtMinute(
  replay: ReplayMatch,
  minute: number,
): { homeScore: number; awayScore: number } {
  let homeScore = 0;
  let awayScore = 0;
  for (const goal of replay.goals) {
    if (goal.minute <= minute) {
      if (goal.side === "home") {
        homeScore += 1;
      } else {
        awayScore += 1;
      }
    }
  }
  return { homeScore, awayScore };
}
