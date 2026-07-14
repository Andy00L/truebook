// Build and export a portable proof receipt for one ticket (plan P6): the
// ticket, market, verified outcome, and cash-out accounts as they sit on
// devnet, every TrueBook transaction that touched them, the daily-root PDAs,
// and the raw TxLINE proof payloads fetched at export time. The written JSON
// is public evidence: chain data and merkle proofs only, no credentials.

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import type { Program } from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
import {
  MILLISECONDS_PER_DAY,
  TXLINE_PROGRAM_ID,
  TICKET_RECEIPT_SCHEMA,
  TICKET_RECEIPT_VERSION,
  collectTruebookTransactions,
  describeMarketParams,
  getFixturesSnapshot,
  getOddsValidation,
  getStatValidation,
  normalizeMarketParams,
  type OddsValidation,
  type ScoresStatValidation,
  type TicketReceipt,
  type Truebook,
  type TxlineAuth,
} from "@truebook/shared";
import TRUEBOOK_IDL_JSON from "@truebook/shared/idl/truebook.json" with { type: "json" };
import { cashOutReceiptPda, dailyOddsRootPda, dailyScoresRootPda, outcomePda } from "./pdas.js";

type Result<TValue> = { ok: true; value: TValue } | { ok: false; reason: string };

function enumVariant(enumObject: object): string {
  return Object.keys(enumObject)[0] ?? "unknown";
}

function epochDayOf(timestampMs: number): number {
  return Math.floor(timestampMs / MILLISECONDS_PER_DAY);
}

// The fixture's team names from the live TxLINE snapshot; null when the
// fixture has aged out of the feed (the receipt stays verifiable without them).
async function fetchFixtureNames(
  auth: TxlineAuth,
  fixtureId: number,
): Promise<{ homeTeam: string | null; awayTeam: string | null }> {
  const fixturesResult = await getFixturesSnapshot(auth);
  if (!fixturesResult.ok) {
    console.error(`[fetchFixtureNames] ${fixturesResult.reason}`);
    return { homeTeam: null, awayTeam: null };
  }
  const fixture = fixturesResult.value.find(
    (candidate) => candidate.FixtureId === fixtureId,
  );
  return fixture
    ? { homeTeam: fixture.Participant1, awayTeam: fixture.Participant2 }
    : { homeTeam: null, awayTeam: null };
}

export async function buildTicketReceipt(
  program: Program<Truebook>,
  auth: TxlineAuth,
  ticketKey: PublicKey,
): Promise<Result<TicketReceipt>> {
  const connection = program.provider.connection;

  const ticket = await program.account.ticket.fetchNullable(ticketKey);
  if (ticket === null) {
    return { ok: false, reason: `no ticket account at ${ticketKey.toBase58()}` };
  }
  const market = await program.account.market.fetchNullable(ticket.market);
  if (market === null) {
    return { ok: false, reason: `ticket references a missing market ${ticket.market.toBase58()}` };
  }

  const outcomeKey = outcomePda(program.programId, ticket.market);
  const cashOutKey = cashOutReceiptPda(program.programId, ticketKey);
  const [outcome, cashOut] = await Promise.all([
    program.account.verifiedOutcome.fetchNullable(outcomeKey),
    program.account.cashOutReceipt.fetchNullable(cashOutKey),
  ]);

  const params = normalizeMarketParams(market.params);
  const descriptor = describeMarketParams(params);
  const fixtureId = market.fixtureId.toNumber();
  const names = await fetchFixtureNames(auth, fixtureId);

  // The opening quote's proof: mandatory, it is what audit_ticket verifies.
  const oddsResult = await getOddsValidation(
    auth,
    ticket.oddsMessageId,
    ticket.oddsTs.toNumber(),
  );
  if (!oddsResult.ok) {
    return { ok: false, reason: `odds proof fetch failed: ${oddsResult.reason}` };
  }
  const oddsValidation: OddsValidation = oddsResult.value;

  // The settlement proof: only exists once verify_market anchored an outcome.
  let statValidation: ScoresStatValidation | null = null;
  if (outcome !== null) {
    if (descriptor === null) {
      console.error(
        "[buildTicketReceipt] unmapped predicate; exporting without the settlement proof",
      );
    } else {
      const statResult = await getStatValidation(auth, {
        fixtureId,
        seq: outcome.seq,
        statKey: descriptor.proofStatKeys[0],
        statKey2: params.hasStatB ? descriptor.proofStatKeys[1] : undefined,
      });
      if (!statResult.ok) {
        return { ok: false, reason: `stat proof fetch failed: ${statResult.reason}` };
      }
      statValidation = statResult.value;
    }
  }

  // The cash-out quote's proof, when the ticket was sold back to the vault.
  let cashOutOddsValidation: OddsValidation | null = null;
  if (cashOut !== null) {
    const cashOutOddsResult = await getOddsValidation(
      auth,
      cashOut.oddsMessageId,
      cashOut.oddsTs.toNumber(),
    );
    if (!cashOutOddsResult.ok) {
      return {
        ok: false,
        reason: `cash-out odds proof fetch failed: ${cashOutOddsResult.reason}`,
      };
    }
    cashOutOddsValidation = cashOutOddsResult.value;
  }

  // The ticket account sits in every bettor-facing transaction (bet, settle,
  // audit, refund, cash-out, repair); the outcome PDA contributes only the
  // verify tx (its other signatures are sibling tickets settling against the
  // same outcome). The market account is deliberately NOT watched: it would
  // drag in every keeper quote tick.
  const transactions = await collectTruebookTransactions(
    connection,
    [ticketKey],
    program.programId.toBase58(),
    TRUEBOOK_IDL_JSON.instructions,
  );
  if (outcome !== null) {
    const outcomeTransactions = await collectTruebookTransactions(
      connection,
      [outcomeKey],
      program.programId.toBase58(),
      TRUEBOOK_IDL_JSON.instructions,
    );
    const knownSignatures = new Set(
      transactions.map((transaction) => transaction.signature),
    );
    transactions.push(
      ...outcomeTransactions.filter(
        (transaction) =>
          transaction.kind === "verifyMarket" &&
          !knownSignatures.has(transaction.signature),
      ),
    );
    transactions.sort((left, right) => left.slot - right.slot);
  }

  const oddsTsMs = oddsValidation.odds.Ts;
  const scoresMinTimestampMs =
    statValidation === null
      ? null
      : statValidation.summary.updateStats.minTimestamp;
  const cashOutOddsTsMs =
    cashOutOddsValidation === null ? null : cashOutOddsValidation.odds.Ts;

  const receipt: TicketReceipt = {
    schema: TICKET_RECEIPT_SCHEMA,
    version: TICKET_RECEIPT_VERSION,
    network: "devnet",
    truebookProgram: program.programId.toBase58(),
    txlineProgram: TXLINE_PROGRAM_ID.toBase58(),
    exportedAt: new Date().toISOString(),
    ticket: {
      address: ticketKey.toBase58(),
      market: ticket.market.toBase58(),
      bettor: ticket.bettor.toBase58(),
      side: enumVariant(ticket.side) === "yes" ? "yes" : "no",
      stakeRaw: ticket.stake.toString(),
      quotedOddsBps: ticket.quotedOddsBps,
      oddsMessageId: ticket.oddsMessageId,
      oddsTsMs: ticket.oddsTs.toNumber(),
      potentialPayoutRaw: ticket.potentialPayout.toString(),
      state: enumVariant(ticket.state),
      auditStatus: enumVariant(ticket.auditStatus),
      createdTs: ticket.createdTs.toNumber(),
    },
    market: {
      address: ticket.market.toBase58(),
      marketId: market.marketId.toString(),
      fixtureId,
      name: descriptor?.name ?? null,
      homeTeam: names.homeTeam,
      awayTeam: names.awayTeam,
      params,
      outcomePriceIndex: market.outcomePriceIndex,
      kickoffTs: market.kickoffTs.toNumber(),
      state: enumVariant(market.state),
    },
    outcome:
      outcome === null
        ? null
        : {
            address: outcomeKey.toBase58(),
            predicateHolds: outcome.outcome,
            seq: outcome.seq,
            verifiedTs: outcome.verifiedTs.toNumber(),
          },
    cashOut:
      cashOut === null
        ? null
        : {
            address: cashOutKey.toBase58(),
            paidAmountRaw: cashOut.paidAmount.toString(),
            oppositeOddsBps: cashOut.oppositeOddsBps,
            oddsMessageId: cashOut.oddsMessageId,
            oddsTsMs: cashOut.oddsTs.toNumber(),
            cashedTs: cashOut.cashedTs.toNumber(),
            auditStatus: enumVariant(cashOut.auditStatus),
            shortfallOwedRaw: cashOut.shortfallOwed.toString(),
            madeWhole: cashOut.madeWhole,
          },
    dailyRoots: {
      oddsRootPda: dailyOddsRootPda(TXLINE_PROGRAM_ID, oddsTsMs).toBase58(),
      oddsEpochDay: epochDayOf(oddsTsMs),
      scoresRootPda:
        scoresMinTimestampMs === null
          ? null
          : dailyScoresRootPda(TXLINE_PROGRAM_ID, scoresMinTimestampMs).toBase58(),
      scoresEpochDay:
        scoresMinTimestampMs === null ? null : epochDayOf(scoresMinTimestampMs),
      cashOutOddsRootPda:
        cashOutOddsTsMs === null
          ? null
          : dailyOddsRootPda(TXLINE_PROGRAM_ID, cashOutOddsTsMs).toBase58(),
      cashOutOddsEpochDay:
        cashOutOddsTsMs === null ? null : epochDayOf(cashOutOddsTsMs),
    },
    transactions,
    proofs: { oddsValidation, statValidation, cashOutOddsValidation },
  };
  return { ok: true, value: receipt };
}

// Export one ticket's receipt to a JSON file (created directories included).
export async function exportTicketReceipt(
  program: Program<Truebook>,
  auth: TxlineAuth,
  ticketKey: PublicKey,
  outFile: string,
): Promise<boolean> {
  const receiptResult = await buildTicketReceipt(program, auth, ticketKey);
  if (!receiptResult.ok) {
    console.error(`[exportTicketReceipt] ${receiptResult.reason}`);
    return false;
  }
  const resolvedPath = resolve(outFile);
  mkdirSync(dirname(resolvedPath), { recursive: true });
  writeFileSync(resolvedPath, `${JSON.stringify(receiptResult.value, null, 2)}\n`);
  console.log(`[exportTicketReceipt] wrote ${resolvedPath}`);
  console.log(
    `[exportTicketReceipt] re-verify with: bun run src/index.ts verify-receipt ${outFile}`,
  );
  return true;
}
