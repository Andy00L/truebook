// Convert TxLINE proof payloads into the argument shapes verify_market and
// audit_ticket expect. The seed ts differs per validator: validate_stat wants
// summary.updateStats.minTimestamp, validate_odds wants the odds record's own
// Ts (its rs:20 check throws 6010 TimestampMismatch otherwise). The test
// fixture had both equal by coincidence; the live devnet audit of July 9,
// 2026 exposed the asymmetry.

import { BN } from "@coral-xyz/anchor";
import type { ScoresStatValidation, OddsValidation, ProofNode } from "@truebook/shared";
import type { MarketDefinition } from "./catalog.js";

const mapProof = (nodes: ProofNode[]) =>
  nodes.map((node) => ({ hash: node.hash, isRightSibling: node.isRightSibling }));

export function buildStatArgs(proof: ScoresStatValidation, definition: MarketDefinition) {
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
    predicate: { threshold: definition.threshold, comparison: definition.comparison },
    statA: {
      statToProve: proof.statToProve,
      eventStatRoot: proof.eventStatRoot,
      statProof: mapProof(proof.statProof),
    },
    statB:
      definition.hasStatB && proof.statToProve2 && proof.statProof2
        ? {
            statToProve: proof.statToProve2,
            eventStatRoot: proof.eventStatRoot,
            statProof: mapProof(proof.statProof2),
          }
        : null,
    op: definition.hasStatB ? definition.op : null,
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
