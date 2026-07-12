// Convert TxLINE proof payloads into the argument shapes verify_market and
// audit_ticket expect. The seed ts differs per validator: validate_stat wants
// summary.updateStats.minTimestamp, validate_odds wants the odds record's own
// Ts (its rs:20 check throws 6010 TimestampMismatch otherwise). The test
// fixture had both equal by coincidence; the live devnet audit of July 9,
// 2026 exposed the asymmetry.

import { BN } from "@coral-xyz/anchor";
import type { ScoresStatValidation, OddsValidation, ProofNode } from "@truebook/shared";
import {
  ANCHOR_CMP_EQUAL_TO,
  ANCHOR_CMP_GREATER_THAN,
  ANCHOR_CMP_LESS_THAN,
  ANCHOR_OP_ADD,
  ANCHOR_OP_SUBTRACT,
  type NormalizedMarketParams,
} from "@truebook/shared";

const mapProof = (nodes: ProofNode[]) =>
  nodes.map((node) => ({ hash: node.hash, isRightSibling: node.isRightSibling }));

function anchorComparison(params: NormalizedMarketParams) {
  if (params.comparison === "greaterThan") return ANCHOR_CMP_GREATER_THAN;
  if (params.comparison === "lessThan") return ANCHOR_CMP_LESS_THAN;
  return ANCHOR_CMP_EQUAL_TO;
}

function anchorOp(params: NormalizedMarketParams) {
  if (!params.hasStatB) return null;
  return params.op === "add" ? ANCHOR_OP_ADD : ANCHOR_OP_SUBTRACT;
}

export function buildStatArgs(proof: ScoresStatValidation, params: NormalizedMarketParams) {
  return {
    ts: new BN(proof.summary.updateStats.minTimestamp),
    fixtureSummary: {
      fixtureId: new BN(proof.summary.fixtureId),
      updateStats: {
        updateCount: proof.summary.updateStats.updateCount,
        minTimestamp: new BN(proof.summary.updateStats.minTimestamp),
        maxTimestamp: new BN(proof.summary.updateStats.maxTimestamp),
      },
      eventsSubTreeRoot: proof.summary.eventStatsSubTreeRoot,
    },
    fixtureProof: mapProof(proof.subTreeProof),
    mainTreeProof: mapProof(proof.mainTreeProof),
    predicate: { threshold: params.threshold, comparison: anchorComparison(params) },
    statA: {
      statToProve: proof.statToProve,
      eventStatRoot: proof.eventStatRoot,
      statProof: mapProof(proof.statProof),
    },
    statB:
      params.hasStatB && proof.statToProve2 && proof.statProof2
        ? {
            statToProve: proof.statToProve2,
            eventStatRoot: proof.eventStatRoot,
            statProof: mapProof(proof.statProof2),
          }
        : null,
    op: anchorOp(params),
  };
}

export function buildOddsArgs(validation: OddsValidation) {
  const odds = validation.odds;
  return {
    // The odds record's own Ts, not the batch minTimestamp (see header note).
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
