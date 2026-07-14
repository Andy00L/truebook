// Portable proof receipt for one TrueBook ticket: everything an outsider
// needs to re-verify the ticket's story (prices, outcome, payments) against
// devnet and the TxLINE oracle without trusting a TrueBook server. The
// keeper's export-receipt command and the app's /api/receipt route both build
// this shape; the keeper's verify-receipt command re-checks it.
//
// Bundler note: this module is deep-imported by the Next app, so its
// relative imports stay type-only (Turbopack does not resolve the shared
// package's .js-suffixed relative value imports from TS sources; see
// app/src/lib/chain/truebookClient.ts).

import { utils } from "@coral-xyz/anchor";
import type { Connection, PublicKey } from "@solana/web3.js";
import type { NormalizedMarketParams } from "./marketCatalog.js";
import type { OddsValidation, ScoresStatValidation } from "./txline/types.js";

export const TICKET_RECEIPT_SCHEMA = "truebook-ticket-receipt" as const;
export const TICKET_RECEIPT_VERSION = 1 as const;

// Instruction names of the TrueBook program a receipt cares about, camelCased
// from the IDL's snake_case names (sourceRef: idl/truebook.json instructions).
const RECEIPT_TRANSACTION_KINDS = [
  "placeBet",
  "postQuote",
  "lockMarket",
  "verifyMarket",
  "settleTicket",
  "auditTicket",
  "refundTicket",
  "cashOutTicket",
  "auditCashOut",
  "claimCashOutRepair",
] as const;

export type ReceiptTransactionKind =
  | (typeof RECEIPT_TRANSACTION_KINDS)[number]
  | "unknown";

export type ReceiptTransaction = {
  signature: string;
  kind: ReceiptTransactionKind;
  slot: number;
  blockTime: number | null;
};

export type TicketReceipt = {
  schema: typeof TICKET_RECEIPT_SCHEMA;
  version: typeof TICKET_RECEIPT_VERSION;
  network: "devnet";
  truebookProgram: string;
  txlineProgram: string;
  exportedAt: string;
  ticket: {
    address: string;
    market: string;
    bettor: string;
    side: "yes" | "no";
    // Raw u64 token amounts stay strings so no precision is lost in JSON.
    stakeRaw: string;
    quotedOddsBps: number;
    oddsMessageId: string;
    // TxLINE record timestamps are epoch milliseconds.
    oddsTsMs: number;
    potentialPayoutRaw: string;
    state: string;
    auditStatus: string;
    // On-chain clock timestamps are epoch seconds.
    createdTs: number;
  };
  market: {
    address: string;
    marketId: string;
    fixtureId: number;
    name: string | null;
    homeTeam: string | null;
    awayTeam: string | null;
    params: NormalizedMarketParams;
    outcomePriceIndex: number;
    kickoffTs: number;
    state: string;
  };
  outcome: {
    address: string;
    predicateHolds: boolean;
    seq: number;
    verifiedTs: number;
  } | null;
  cashOut: {
    address: string;
    paidAmountRaw: string;
    oppositeOddsBps: number;
    oddsMessageId: string;
    oddsTsMs: number;
    cashedTs: number;
    auditStatus: string;
    shortfallOwedRaw: string;
    madeWhole: boolean;
  } | null;
  dailyRoots: {
    oddsRootPda: string;
    oddsEpochDay: number;
    scoresRootPda: string | null;
    scoresEpochDay: number | null;
    cashOutOddsRootPda: string | null;
    cashOutOddsEpochDay: number | null;
  };
  transactions: ReceiptTransaction[];
  proofs: {
    oddsValidation: OddsValidation;
    statValidation: ScoresStatValidation | null;
    cashOutOddsValidation: OddsValidation | null;
  };
};

type IdlInstructionDef = { name: string; discriminator: number[] };

function camelCaseInstructionName(snakeName: string): string {
  return snakeName.replace(/_([a-z])/g, (_match, letter: string) =>
    letter.toUpperCase(),
  );
}

/**
 * Map one TrueBook instruction's raw data (base58, as the parsed-transaction
 * API returns unknown-program instructions) onto a receipt transaction kind
 * by its 8-byte Anchor discriminator.
 */
export function classifyTruebookInstructionData(
  idlInstructions: ReadonlyArray<IdlInstructionDef>,
  dataBase58: string,
): ReceiptTransactionKind {
  let dataBytes: Uint8Array;
  try {
    dataBytes = utils.bytes.bs58.decode(dataBase58);
  } catch {
    return "unknown";
  }
  for (const instruction of idlInstructions) {
    const discriminator = instruction.discriminator;
    if (dataBytes.length < discriminator.length) continue;
    const matchesDiscriminator = discriminator.every(
      (byte, byteIndex) => dataBytes[byteIndex] === byte,
    );
    if (!matchesDiscriminator) continue;
    const camelName = camelCaseInstructionName(instruction.name);
    return (RECEIPT_TRANSACTION_KINDS as ReadonlyArray<string>).includes(
      camelName,
    )
      ? (camelName as ReceiptTransactionKind)
      : "unknown";
  }
  return "unknown";
}

/**
 * Every transaction that touched the given accounts, classified by the
 * TrueBook instruction it carried, oldest first. Used by both receipt
 * builders so a ticket's bet, audit, settle, refund, and cash-out signatures
 * come from the chain, never from local bookkeeping.
 */
export async function collectTruebookTransactions(
  connection: Connection,
  addresses: ReadonlyArray<PublicKey>,
  truebookProgramBase58: string,
  idlInstructions: ReadonlyArray<IdlInstructionDef>,
): Promise<ReceiptTransaction[]> {
  const infoBySignature = new Map<
    string,
    { slot: number; blockTime: number | null }
  >();
  for (const address of addresses) {
    const signatureInfos = await connection.getSignaturesForAddress(address);
    for (const signatureInfo of signatureInfos) {
      infoBySignature.set(signatureInfo.signature, {
        slot: signatureInfo.slot,
        blockTime: signatureInfo.blockTime ?? null,
      });
    }
  }
  const signatures = [...infoBySignature.keys()];
  if (signatures.length === 0) {
    return [];
  }

  // One request per signature on purpose: getParsedTransactions issues a
  // batch RPC call, which free-tier devnet endpoints reject with 403.
  const transactions: ReceiptTransaction[] = [];
  for (const signature of signatures) {
    const info = infoBySignature.get(signature);
    let kind: ReceiptTransactionKind = "unknown";
    const parsed = await connection.getParsedTransaction(signature, {
      maxSupportedTransactionVersion: 0,
    });
    for (const instruction of parsed?.transaction.message.instructions ?? []) {
      if (instruction.programId.toBase58() !== truebookProgramBase58) {
        continue;
      }
      if (!("data" in instruction)) continue;
      const classified = classifyTruebookInstructionData(
        idlInstructions,
        instruction.data,
      );
      if (classified !== "unknown") {
        kind = classified;
        break;
      }
    }
    transactions.push({
      signature,
      kind,
      slot: info?.slot ?? 0,
      blockTime: info?.blockTime ?? null,
    });
  }
  transactions.sort((left, right) => left.slot - right.slot);
  return transactions;
}

export type ParsedReceiptResult =
  | { ok: true; receipt: TicketReceipt }
  | { ok: false; reason: string };

function isRecord(candidate: unknown): candidate is Record<string, unknown> {
  return typeof candidate === "object" && candidate !== null;
}

function hasStringField(
  record: Record<string, unknown>,
  field: string,
): boolean {
  return typeof record[field] === "string";
}

function hasNumberField(
  record: Record<string, unknown>,
  field: string,
): boolean {
  return typeof record[field] === "number" && Number.isFinite(record[field] as number);
}

/** Structural check of an OddsValidation payload from an untrusted source. */
export function oddsValidationLooksComplete(candidate: unknown): boolean {
  if (!isRecord(candidate)) return false;
  const odds = candidate.odds;
  const summary = candidate.summary;
  return (
    isRecord(odds) &&
    hasStringField(odds, "MessageId") &&
    hasNumberField(odds, "Ts") &&
    Array.isArray(odds.Prices) &&
    isRecord(summary) &&
    isRecord(summary.updateStats) &&
    Array.isArray(candidate.subTreeProof) &&
    Array.isArray(candidate.mainTreeProof)
  );
}

/** Structural check of a ScoresStatValidation payload from an untrusted source. */
export function statValidationLooksComplete(candidate: unknown): boolean {
  if (!isRecord(candidate)) return false;
  const summary = candidate.summary;
  return (
    isRecord(candidate.statToProve) &&
    Array.isArray(candidate.eventStatRoot) &&
    isRecord(summary) &&
    isRecord(summary.updateStats) &&
    hasNumberField(summary.updateStats as Record<string, unknown>, "minTimestamp") &&
    Array.isArray(candidate.statProof) &&
    Array.isArray(candidate.subTreeProof) &&
    Array.isArray(candidate.mainTreeProof)
  );
}

/**
 * Structural validation of an untrusted receipt file. Checks every field the
 * re-verifier dereferences, so a malformed file fails with a named field
 * instead of a crash mid-verification.
 */
export function parseTicketReceipt(raw: unknown): ParsedReceiptResult {
  const fail = (field: string): ParsedReceiptResult => ({
    ok: false,
    reason: `receipt field missing or malformed: ${field}`,
  });

  if (!isRecord(raw)) return fail("(root)");
  if (raw.schema !== TICKET_RECEIPT_SCHEMA) return fail("schema");
  if (raw.version !== TICKET_RECEIPT_VERSION) return fail("version");
  if (!hasStringField(raw, "truebookProgram")) return fail("truebookProgram");
  if (!hasStringField(raw, "txlineProgram")) return fail("txlineProgram");

  const ticket = raw.ticket;
  if (!isRecord(ticket)) return fail("ticket");
  for (const field of ["address", "market", "bettor", "stakeRaw", "oddsMessageId", "state", "auditStatus"]) {
    if (!hasStringField(ticket, field)) return fail(`ticket.${field}`);
  }
  if (ticket.side !== "yes" && ticket.side !== "no") return fail("ticket.side");
  for (const field of ["quotedOddsBps", "oddsTsMs", "createdTs"]) {
    if (!hasNumberField(ticket, field)) return fail(`ticket.${field}`);
  }

  const market = raw.market;
  if (!isRecord(market)) return fail("market");
  if (!hasStringField(market, "address")) return fail("market.address");
  for (const field of ["fixtureId", "outcomePriceIndex", "kickoffTs"]) {
    if (!hasNumberField(market, field)) return fail(`market.${field}`);
  }
  const params = market.params;
  if (!isRecord(params)) return fail("market.params");
  for (const field of ["statAKey", "statAPeriod", "statBKey", "statBPeriod", "threshold"]) {
    if (!hasNumberField(params, field)) return fail(`market.params.${field}`);
  }
  if (typeof params.hasStatB !== "boolean") return fail("market.params.hasStatB");
  if (!hasStringField(params, "op")) return fail("market.params.op");
  if (!hasStringField(params, "comparison")) return fail("market.params.comparison");

  const outcome = raw.outcome;
  if (outcome !== null) {
    if (!isRecord(outcome)) return fail("outcome");
    if (!hasStringField(outcome, "address")) return fail("outcome.address");
    if (typeof outcome.predicateHolds !== "boolean") return fail("outcome.predicateHolds");
    for (const field of ["seq", "verifiedTs"]) {
      if (!hasNumberField(outcome, field)) return fail(`outcome.${field}`);
    }
  }

  const cashOut = raw.cashOut;
  if (cashOut !== null) {
    if (!isRecord(cashOut)) return fail("cashOut");
    if (!hasStringField(cashOut, "oddsMessageId")) return fail("cashOut.oddsMessageId");
    if (!hasNumberField(cashOut, "oddsTsMs")) return fail("cashOut.oddsTsMs");
  }

  const dailyRoots = raw.dailyRoots;
  if (!isRecord(dailyRoots)) return fail("dailyRoots");
  if (!hasStringField(dailyRoots, "oddsRootPda")) return fail("dailyRoots.oddsRootPda");

  const transactions = raw.transactions;
  if (!Array.isArray(transactions)) return fail("transactions");
  for (const [transactionIndex, transaction] of transactions.entries()) {
    if (!isRecord(transaction) || !hasStringField(transaction, "signature")) {
      return fail(`transactions[${transactionIndex}].signature`);
    }
  }

  const proofs = raw.proofs;
  if (!isRecord(proofs)) return fail("proofs");
  if (!oddsValidationLooksComplete(proofs.oddsValidation)) {
    return fail("proofs.oddsValidation");
  }
  if (proofs.statValidation !== null && !statValidationLooksComplete(proofs.statValidation)) {
    return fail("proofs.statValidation");
  }
  if (
    proofs.cashOutOddsValidation !== null &&
    proofs.cashOutOddsValidation !== undefined &&
    !oddsValidationLooksComplete(proofs.cashOutOddsValidation)
  ) {
    return fail("proofs.cashOutOddsValidation");
  }

  // Every field the re-verifier reads has been checked above, so this
  // narrowing from the validated record is sound.
  return { ok: true, receipt: raw as TicketReceipt };
}
