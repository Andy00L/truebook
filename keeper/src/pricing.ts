// Convert a TxLINE StablePrice consensus into the house's served odds.
// StablePrice raw price = decimal odds * 1000. Internal odds are decimal * 10000
// (basis points), matching the on-chain program (ODDS_BPS_SCALE).

import { ODDS_DECIMAL_SCALE } from "@truebook/shared";

const ODDS_BPS_SCALE = 10_000; // decimal odds * 10_000, matches the program
const BPS_DENOMINATOR = 10_000;
const PRICE_TO_ODDS_BPS = ODDS_BPS_SCALE / ODDS_DECIMAL_SCALE; // raw price * 10

// Implied probability (fraction 0..1) of a raw StablePrice price.
function impliedProbFromRawPrice(rawPrice: number): number {
  const oddsBps = rawPrice * PRICE_TO_ODDS_BPS;
  return ODDS_BPS_SCALE / oddsBps;
}

// Odds in bps from an implied probability, applying the house margin.
function houseOddsBpsFromImplied(consensusImplied: number, marginBps: number): number {
  const houseImplied = consensusImplied * (1 + marginBps / BPS_DENOMINATOR);
  return Math.floor(ODDS_BPS_SCALE / houseImplied);
}

export type HouseQuote = { yesOddsBps: number; noOddsBps: number };

// Given the consensus price of the YES outcome, produce the house's yes/no odds.
// NO consensus is the demargined complement of the YES implied probability.
export function houseQuoteFromConsensus(rawYesPrice: number, marginBps: number): HouseQuote {
  const yesImplied = impliedProbFromRawPrice(rawYesPrice);
  const noImplied = 1 - yesImplied;
  return {
    yesOddsBps: houseOddsBpsFromImplied(yesImplied, marginBps),
    noOddsBps: houseOddsBpsFromImplied(noImplied, marginBps),
  };
}
