// The market catalog: the single TS source of truth for which predicates
// TrueBook offers, how they read on screen, and which TxLINE StablePrice
// record each one is priced from. It mirrors the on-chain mapping in
// program/programs/truebook/src/oddsmap.rs exactly; the program enforces the
// same predicate-to-record derivation at create_market and audit time, so a
// drift between the two surfaces as on-chain errors, never as a silent
// mismatch. Browser-safe: types and pure functions only.
// sourceRef: .scratch/odds-updates-18172379.json (observed record shapes) and
// program/programs/truebook/src/oddsmap.rs.

import type { OddsRecord } from "./txline/types.js";

// Anchor enum encodings of the on-chain MarketParams fields.
export const ANCHOR_OP_ADD = { add: {} } as const;
export const ANCHOR_OP_SUBTRACT = { subtract: {} } as const;
export const ANCHOR_CMP_GREATER_THAN = { greaterThan: {} } as const;
export const ANCHOR_CMP_LESS_THAN = { lessThan: {} } as const;
export const ANCHOR_CMP_EQUAL_TO = { equalTo: {} } as const;

export type BinaryOpName = "none" | "add" | "subtract";
export type ComparisonName = "greaterThan" | "lessThan" | "equalTo";

// The predicate fields exactly as the on-chain MarketParams stores them,
// with enums flattened to their variant names.
export type NormalizedMarketParams = {
  statAKey: number;
  statAPeriod: number;
  statBKey: number;
  statBPeriod: number;
  hasStatB: boolean;
  op: BinaryOpName;
  comparison: ComparisonName;
  threshold: number;
};

// Score stat keys and periods of the supported predicates.
// sourceRef: config.ts STAT_KEY_PARTICIPANT1_GOALS / STAT_KEY_PARTICIPANT2_GOALS.
const STAT_KEY_P1_GOALS = 1;
const STAT_KEY_P2_GOALS = 2;
const STAT_PERIOD_TOTAL = 0;
const STAT_PERIOD_FIRST_HALF = 1;

// StablePrice record shapes, as the devnet feed emits them.
// sourceRef: .scratch/odds-updates-18172379.json.
export const SUPER_ODDS_1X2 = "1X2_PARTICIPANT_RESULT" as const;
export const SUPER_ODDS_OVER_UNDER = "OVERUNDER_PARTICIPANT_GOALS" as const;
export const SUPER_ODDS_ASIAN_HANDICAP = "ASIANHANDICAP_PARTICIPANT_GOALS" as const;
const MARKET_PERIOD_FIRST_HALF = "half=1";

// Everything a screen or the keeper needs to know about one market predicate.
export type MarketDescriptor = {
  // Stable key, e.g. "homeWin", "goalsOver2_5", "firstHalfGoalsOver0_5".
  key: string;
  name: string;
  // Card eyebrow group: "1x2", "totals", "margin".
  groupLabel: string;
  yesLabel: string;
  noLabel: string;
  // The consensus record this market's quotes must come from.
  superOddsType: string;
  marketParameters: string | null;
  marketPeriod: string | null;
  yesPriceIndex: number;
  // Stat keys to request from the scores stat-validation endpoint. Periods
  // other than Total use the period*1000+base key encoding observed in the
  // scores snapshot Stats map (sourceRef: .scratch/snapshot-18172379.json).
  proofStatKeys: [number, number];
};

function proofStatKeysFor(period: number): [number, number] {
  if (period === STAT_PERIOD_TOTAL) {
    return [STAT_KEY_P1_GOALS, STAT_KEY_P2_GOALS];
  }
  return [period * 1000 + STAT_KEY_P1_GOALS, period * 1000 + STAT_KEY_P2_GOALS];
}

/**
 * Describe an on-chain predicate, or return null when it maps to no known
 * consensus record (the program refuses to create such markets). Handles any
 * totals threshold so in-play lines created mid-match still label correctly.
 */
export function describeMarketParams(
  params: NormalizedMarketParams,
): MarketDescriptor | null {
  const isGoalsPair =
    params.hasStatB &&
    params.statAKey === STAT_KEY_P1_GOALS &&
    params.statBKey === STAT_KEY_P2_GOALS &&
    params.statAPeriod === params.statBPeriod;
  if (!isGoalsPair) {
    return null;
  }
  const period = params.statAPeriod;
  if (period !== STAT_PERIOD_TOTAL && period !== STAT_PERIOD_FIRST_HALF) {
    return null;
  }
  const marketPeriod = period === STAT_PERIOD_FIRST_HALF ? MARKET_PERIOD_FIRST_HALF : null;
  const halfSuffix = period === STAT_PERIOD_FIRST_HALF ? " · 1st half" : "";
  const halfKeyPrefix = period === STAT_PERIOD_FIRST_HALF ? "firstHalf" : "";
  const proofStatKeys = proofStatKeysFor(period);

  if (params.op === "subtract" && params.comparison === "greaterThan" && params.threshold === 0) {
    return {
      key: `${halfKeyPrefix}homeWin`,
      name: `Home win${halfSuffix}`,
      groupLabel: "1x2",
      yesLabel: "Yes",
      noLabel: "No",
      superOddsType: SUPER_ODDS_1X2,
      marketParameters: null,
      marketPeriod,
      yesPriceIndex: 0,
      proofStatKeys,
    };
  }
  if (params.op === "subtract" && params.comparison === "equalTo" && params.threshold === 0) {
    return {
      key: `${halfKeyPrefix}draw`,
      name: `Draw${halfSuffix}`,
      groupLabel: "1x2",
      yesLabel: "Yes",
      noLabel: "No",
      superOddsType: SUPER_ODDS_1X2,
      marketParameters: null,
      marketPeriod,
      yesPriceIndex: 1,
      proofStatKeys,
    };
  }
  if (params.op === "subtract" && params.comparison === "lessThan" && params.threshold === 0) {
    return {
      key: `${halfKeyPrefix}awayWin`,
      name: `Away win${halfSuffix}`,
      groupLabel: "1x2",
      yesLabel: "Yes",
      noLabel: "No",
      superOddsType: SUPER_ODDS_1X2,
      marketParameters: null,
      marketPeriod,
      yesPriceIndex: 2,
      proofStatKeys,
    };
  }
  if (params.op === "subtract" && params.comparison === "greaterThan" && params.threshold > 0) {
    const marginGoals = params.threshold + 1;
    return {
      key: `${halfKeyPrefix}homeWinsBy${marginGoals}Plus`,
      name: `Home wins by ${marginGoals}+${halfSuffix}`,
      groupLabel: "margin",
      yesLabel: "Yes",
      noLabel: "No",
      superOddsType: SUPER_ODDS_ASIAN_HANDICAP,
      marketParameters: `line=-${params.threshold}.5`,
      marketPeriod,
      yesPriceIndex: 0,
      proofStatKeys,
    };
  }
  if (params.op === "add" && params.comparison === "greaterThan" && params.threshold >= 0) {
    const line = `${params.threshold}.5`;
    return {
      key: `${halfKeyPrefix}goalsOver${params.threshold}_5`,
      name: `Over ${line} goals${halfSuffix}`,
      groupLabel: "totals",
      yesLabel: `Over ${line}`,
      noLabel: `Under ${line}`,
      superOddsType: SUPER_ODDS_OVER_UNDER,
      marketParameters: `line=${line}`,
      marketPeriod,
      yesPriceIndex: 0,
      proofStatKeys,
    };
  }
  return null;
}

// A creatable catalog entry: the predicate the keeper commits on-chain.
export type MarketBlueprint = {
  params: NormalizedMarketParams;
  descriptor: MarketDescriptor;
};

function blueprintFrom(params: NormalizedMarketParams): MarketBlueprint {
  const descriptor = describeMarketParams(params);
  if (descriptor === null) {
    // Unreachable for the static catalog below; loud is better than silent.
    throw new Error(`[blueprintFrom] catalog predicate maps to no consensus record: ${JSON.stringify(params)}`);
  }
  return { params, descriptor };
}

function goalsPairParams(
  op: BinaryOpName,
  comparison: ComparisonName,
  threshold: number,
  period: number,
): NormalizedMarketParams {
  return {
    statAKey: STAT_KEY_P1_GOALS,
    statAPeriod: period,
    statBKey: STAT_KEY_P2_GOALS,
    statBPeriod: period,
    hasStatB: true,
    op,
    comparison,
    threshold,
  };
}

/**
 * The pre-match board: every market the keeper opens per upcoming fixture.
 * Corners and both-teams-to-score are deliberately absent: the devnet feed
 * publishes no consensus record for them, so they could not be priced or
 * audited honestly (sourceRef: .scratch/odds-updates-18172379.json).
 */
export const PREMATCH_CATALOG: ReadonlyArray<MarketBlueprint> = [
  blueprintFrom(goalsPairParams("subtract", "greaterThan", 0, STAT_PERIOD_TOTAL)),
  blueprintFrom(goalsPairParams("subtract", "equalTo", 0, STAT_PERIOD_TOTAL)),
  blueprintFrom(goalsPairParams("subtract", "lessThan", 0, STAT_PERIOD_TOTAL)),
  blueprintFrom(goalsPairParams("add", "greaterThan", 1, STAT_PERIOD_TOTAL)),
  blueprintFrom(goalsPairParams("add", "greaterThan", 2, STAT_PERIOD_TOTAL)),
  blueprintFrom(goalsPairParams("add", "greaterThan", 0, STAT_PERIOD_FIRST_HALF)),
  blueprintFrom(goalsPairParams("subtract", "greaterThan", 1, STAT_PERIOD_TOTAL)),
];

/** The in-play totals line over the current score: total goals > current. */
export function inPlayTotalsBlueprint(currentTotalGoals: number): MarketBlueprint {
  return blueprintFrom(
    goalsPairParams("add", "greaterThan", currentTotalGoals, STAT_PERIOD_TOTAL),
  );
}

/** The Anchor-encoded MarketParams object for a normalized predicate. */
export function toAnchorMarketParams(params: NormalizedMarketParams): {
  statAKey: number;
  statAPeriod: number;
  statBKey: number;
  statBPeriod: number;
  hasStatB: boolean;
  op: typeof ANCHOR_OP_ADD | typeof ANCHOR_OP_SUBTRACT;
  comparison:
    | typeof ANCHOR_CMP_GREATER_THAN
    | typeof ANCHOR_CMP_LESS_THAN
    | typeof ANCHOR_CMP_EQUAL_TO;
  threshold: number;
} {
  return {
    statAKey: params.statAKey,
    statAPeriod: params.statAPeriod,
    statBKey: params.statBKey,
    statBPeriod: params.statBPeriod,
    hasStatB: params.hasStatB,
    op: params.op === "add" ? ANCHOR_OP_ADD : ANCHOR_OP_SUBTRACT,
    comparison:
      params.comparison === "greaterThan"
        ? ANCHOR_CMP_GREATER_THAN
        : params.comparison === "lessThan"
          ? ANCHOR_CMP_LESS_THAN
          : ANCHOR_CMP_EQUAL_TO,
    threshold: params.threshold,
  };
}

/** Flatten Anchor's { variantName: {} } enum encoding to the variant name. */
function enumVariantName(enumObject: object): string {
  return Object.keys(enumObject)[0] ?? "none";
}

/**
 * Normalize the MarketParams shape Anchor returns when fetching a Market
 * account (enums as single-key objects) back into plain variant names.
 */
export function normalizeMarketParams(rawParams: {
  statAKey: number;
  statAPeriod: number;
  statBKey: number;
  statBPeriod: number;
  hasStatB: boolean;
  op: object;
  comparison: object;
  threshold: number;
}): NormalizedMarketParams {
  return {
    statAKey: rawParams.statAKey,
    statAPeriod: rawParams.statAPeriod,
    statBKey: rawParams.statBKey,
    statBPeriod: rawParams.statBPeriod,
    hasStatB: rawParams.hasStatB,
    op: enumVariantName(rawParams.op) as BinaryOpName,
    comparison: enumVariantName(rawParams.comparison) as ComparisonName,
    threshold: rawParams.threshold,
  };
}

/**
 * The freshest StablePrice record matching a descriptor, or null when the
 * feed currently quotes no such record (the market simply waits for one).
 */
export function pickConsensusRecord(
  records: ReadonlyArray<OddsRecord>,
  descriptor: MarketDescriptor,
): OddsRecord | null {
  let freshest: OddsRecord | null = null;
  for (const record of records) {
    if (record.SuperOddsType !== descriptor.superOddsType) continue;
    if ((record.MarketParameters ?? null) !== descriptor.marketParameters) continue;
    if ((record.MarketPeriod ?? null) !== descriptor.marketPeriod) continue;
    const yesPrice = record.Prices[descriptor.yesPriceIndex];
    if (yesPrice === undefined || yesPrice <= 0) continue;
    if (freshest === null || record.Ts > freshest.Ts) {
      freshest = record;
    }
  }
  return freshest;
}
