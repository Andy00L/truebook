// TxLINE API response types, verified against devnet payloads on 2026-07-02.
// sourceRef: docs/research/2026-07-02-spike-findings.md and docs.yaml (OpenAPI).

// A single merkle proof node. hash is 32 bytes.
export type ProofNode = {
  hash: number[];
  isRightSibling: boolean;
};

// A single scored statistic. key 1 = Participant1 goals, key 2 = Participant2 goals.
// period 0 = Total. Other keys and periods follow the period*1000+base encoding.
export type ScoreStat = {
  key: number;
  value: number;
  period: number;
};

// Per-fixture batch summary shared by scores proofs. Note the API field name
// eventStatsSubTreeRoot maps to the on-chain arg eventsSubTreeRoot.
export type ScoresBatchSummaryJson = {
  fixtureId: number;
  updateStats: {
    updateCount: number;
    minTimestamp: number;
    maxTimestamp: number;
  };
  eventStatsSubTreeRoot: number[];
};

// Response of GET /api/scores/stat-validation (legacy mode, one or two stats).
export type ScoresStatValidation = {
  ts: number;
  statToProve: ScoreStat;
  statToProve2?: ScoreStat;
  eventStatRoot: number[];
  summary: ScoresBatchSummaryJson;
  statProof: ProofNode[];
  statProof2?: ProofNode[];
  subTreeProof: ProofNode[];
  mainTreeProof: ProofNode[];
};

// A StablePrice odds record from the stream, updates, or validation payload.
// Prices are decimal odds scaled by 1000 (1613 = 1.613 decimal).
export type OddsRecord = {
  FixtureId: number;
  MessageId: string;
  Ts: number;
  Bookmaker: string;
  BookmakerId: number;
  SuperOddsType: string;
  GameState: string | null;
  InRunning: boolean;
  MarketParameters: string | null;
  MarketPeriod: string | null;
  PriceNames: string[];
  Prices: number[];
  Pct?: string[];
};

// Per-fixture odds batch summary used by odds proofs.
export type OddsBatchSummaryJson = {
  fixtureId: number;
  updateStats: {
    updateCount: number;
    minTimestamp: number;
    maxTimestamp: number;
  };
  oddsSubTreeRoot: number[];
};

// Response of GET /api/odds/validation.
export type OddsValidation = {
  odds: OddsRecord;
  summary: OddsBatchSummaryJson;
  subTreeProof: ProofNode[];
  mainTreeProof: ProofNode[];
};

// A fixture from GET /api/fixtures/snapshot.
export type FixtureSnapshot = {
  FixtureId: number;
  Participant1: string;
  Participant2: string;
  Participant1IsHome: boolean;
  StartTime: string;
  CompetitionId?: number;
};

// A scores snapshot row from GET /api/scores/snapshot/{fixtureId}.
export type ScoresSnapshotRow = {
  FixtureId: number;
  GameState: string;
  Seq: number;
  Ts: number;
  StatusId?: number;
  Score?: unknown;
  Stats?: unknown;
};

// One parsed Server-Sent Event.
export type SseEvent = {
  id?: string;
  event?: string;
  data: string;
};

// The session credentials needed for every authenticated data request.
export type TxlineAuth = {
  jwt: string;
  apiToken: string;
};
