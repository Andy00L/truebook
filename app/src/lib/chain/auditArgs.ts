/**
 * Browser side of the price audit: fetch the validate_odds evidence for a
 * quote (via the server route that holds the TxLINE token), then reshape it
 * into the Anchor argument object audit_ticket / audit_cash_out expect. All
 * big integers become BN here; every field mirrors the on-chain
 * ValidateOddsArgs and the keeper's buildOddsArgs (keeper/src/proofArgs.ts).
 */

import { BN } from "@coral-xyz/anchor";

/** One merkle proof node as TxLINE serves it. */
type RawProofNode = { hash: number[]; isRightSibling: boolean };

/** The odds validation payload the server route returns unchanged. */
export type RawOddsValidation = {
  odds: {
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
  };
  summary: {
    fixtureId: number;
    updateStats: { updateCount: number; minTimestamp: number; maxTimestamp: number };
    oddsSubTreeRoot: number[];
  };
  subTreeProof: RawProofNode[];
  mainTreeProof: RawProofNode[];
};

export type AuditArgsResult =
  | { ok: true; validation: RawOddsValidation }
  | { ok: false; reason: string };

const mapProof = (nodes: RawProofNode[]) =>
  nodes.map((node) => ({ hash: node.hash, isRightSibling: node.isRightSibling }));

/**
 * Reshape a raw odds validation into the Anchor ValidateOddsArgs object. The
 * seed ts is the odds record's own Ts (validate_odds checks it, not the batch
 * minTimestamp); the same asymmetry the keeper handles.
 */
export function buildOddsArgsFromRaw(validation: RawOddsValidation) {
  const odds = validation.odds;
  return {
    ts: new BN(odds.Ts),
    oddsSnapshot: {
      fixtureId: new BN(odds.FixtureId),
      messageId: odds.MessageId,
      ts: new BN(odds.Ts),
      bookmaker: odds.Bookmaker,
      bookmakerId: odds.BookmakerId,
      superOddsType: odds.SuperOddsType,
      gameState: odds.GameState,
      inRunning: odds.InRunning,
      marketParameters: odds.MarketParameters,
      marketPeriod: odds.MarketPeriod,
      priceNames: odds.PriceNames,
      prices: odds.Prices,
    },
    summary: {
      fixtureId: new BN(validation.summary.fixtureId),
      updateStats: {
        updateCount: validation.summary.updateStats.updateCount,
        minTimestamp: new BN(validation.summary.updateStats.minTimestamp),
        maxTimestamp: new BN(validation.summary.updateStats.maxTimestamp),
      },
      oddsSubTreeRoot: validation.summary.oddsSubTreeRoot,
    },
    subTreeProof: mapProof(validation.subTreeProof),
    mainTreeProof: mapProof(validation.mainTreeProof),
  };
}

/** The odds record's epoch day, for the daily-batch root PDA seed. */
export function epochDayLeBytes(oddsTsMs: number): Uint8Array {
  // sourceRef: program constants.rs MILLISECONDS_PER_DAY_I64; epochDay u16 LE.
  const epochDay = Math.floor(oddsTsMs / 86_400_000);
  const bytes = new Uint8Array(2);
  bytes[0] = epochDay & 0xff;
  bytes[1] = (epochDay >> 8) & 0xff;
  return bytes;
}

/** Ask the server route for a quote's proof; the token stays on the server. */
export async function fetchAuditArgs(
  messageId: string,
  ts: number,
): Promise<AuditArgsResult> {
  let response: Response;
  try {
    response = await fetch("/api/audit-args", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ messageId, ts }),
    });
  } catch (networkError) {
    return {
      ok: false,
      reason: `Could not reach the proof service: ${String(networkError).slice(0, 120)}`,
    };
  }
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    return { ok: false, reason: "The proof service returned an unreadable answer." };
  }
  const typedBody = body as AuditArgsResult;
  if (typedBody.ok) {
    return { ok: true, validation: typedBody.validation };
  }
  return {
    ok: false,
    reason: typedBody.reason ?? "The proof service declined the request.",
  };
}
