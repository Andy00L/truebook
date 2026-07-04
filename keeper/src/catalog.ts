// The market types the keeper offers per fixture. Each maps a human market to a
// TxLINE predicate: (stat_a [op stat_b]) comparison threshold, and the index in a
// StablePrice record's prices[] that is this market's YES consensus price.

// Anchor enum encodings.
const SUBTRACT = { subtract: {} } as const;
const GREATER_THAN = { greaterThan: {} } as const;

export type MarketDefinition = {
  key: string;
  label: string;
  // Predicate as stored in the on-chain MarketParams.
  statAKey: number;
  statAPeriod: number;
  statBKey: number;
  statBPeriod: number;
  hasStatB: boolean;
  op: typeof SUBTRACT;
  comparison: typeof GREATER_THAN;
  threshold: number;
  // StablePrice statKeys to request proofs for, and which price index is YES.
  proofStatKeys: [number, number];
  outcomePriceIndex: number;
  // Which StablePrice super odds type carries this market's consensus price.
  superOddsType: string;
};

// Home win: (Participant1 goals - Participant2 goals) > 0, period Total. The home
// consensus price is part1 (index 0) of the 1X2 StablePrice record.
export const HOME_WIN: MarketDefinition = {
  key: "home_win",
  label: "Home win",
  statAKey: 1,
  statAPeriod: 0,
  statBKey: 2,
  statBPeriod: 0,
  hasStatB: true,
  op: SUBTRACT,
  comparison: GREATER_THAN,
  threshold: 0,
  proofStatKeys: [1, 2],
  outcomePriceIndex: 0,
  superOddsType: "1X2_PARTICIPANT_RESULT",
};

export const MARKET_CATALOG: MarketDefinition[] = [HOME_WIN];

// The on-chain MarketParams object for a definition.
export function toMarketParams(definition: MarketDefinition) {
  return {
    statAKey: definition.statAKey,
    statAPeriod: definition.statAPeriod,
    statBKey: definition.statBKey,
    statBPeriod: definition.statBPeriod,
    hasStatB: definition.hasStatB,
    op: definition.op,
    comparison: definition.comparison,
    threshold: definition.threshold,
  };
}
