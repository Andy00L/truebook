// One-command re-verifier for a portable proof receipt (plan P6): anyone
// with this repo and devnet access can re-check a ticket's story without a
// TxLINE token, a funded wallet, or a TrueBook server. Checks, in order:
//   1. the receipt file parses against the schema
//   2. every referenced transaction signature exists on devnet
//   3. the daily-root PDAs re-derive from the embedded proof timestamps
//   4. the embedded proofs bind to the quotes the on-chain accounts committed
//   5. validate_odds and validate_stat accept the proofs (free simulation:
//      the transaction is built unsigned and run via simulateTransaction)
//   6. the simulated predicate result matches the anchored outcome
// Prints PASS, or the first failing check, with a [verifyReceipt] prefix.

import { readFileSync } from "node:fs";
import { Program, type Idl } from "@coral-xyz/anchor";
import {
  ComputeBudgetProgram,
  Connection,
  PublicKey,
  Transaction,
  type TransactionInstruction,
} from "@solana/web3.js";
import {
  buildOddsArgs,
  buildStatArgs,
  parseTicketReceipt,
  type NormalizedMarketParams,
  type OddsValidation,
  type ScoresStatValidation,
  type TicketReceipt,
} from "@truebook/shared";
import txoracleIdl from "@truebook/shared/idl/txoracle" with { type: "json" };
import { dailyOddsRootPda, dailyScoresRootPda } from "./pdas.js";

// validate_odds runs about 180k CU on devnet; same ceiling as the live audits.
const SIMULATION_CU_LIMIT = 1_400_000;

type CheckResult = { ok: true } | { ok: false; reason: string };

function failCheck(reason: string): CheckResult {
  return { ok: false, reason };
}

// Build one unsigned transaction and simulate it; the boolean the TxLINE
// program leaves in return data is the validation verdict.
// sourceRef: program/programs/truebook/src/txline_cpi.rs (read_bool_return_data).
async function simulateValidation(
  connection: Connection,
  instruction: TransactionInstruction,
  feePayer: PublicKey,
  label: string,
): Promise<{ ok: true; verdict: boolean } | { ok: false; reason: string }> {
  const transaction = new Transaction();
  transaction.add(
    ComputeBudgetProgram.setComputeUnitLimit({ units: SIMULATION_CU_LIMIT }),
  );
  transaction.add(instruction);
  transaction.feePayer = feePayer;
  const latestBlockhash = await connection.getLatestBlockhash("confirmed");
  transaction.recentBlockhash = latestBlockhash.blockhash;

  const simulation = await connection.simulateTransaction(transaction);
  if (simulation.value.err !== null) {
    const logTail = (simulation.value.logs ?? []).slice(-3).join(" | ");
    return {
      ok: false,
      reason: `${label} simulation failed: ${JSON.stringify(simulation.value.err)} (${logTail})`,
    };
  }
  const returnData = simulation.value.returnData;
  if (!returnData) {
    return { ok: false, reason: `${label} simulation returned no data` };
  }
  const returnBytes = Buffer.from(returnData.data[0], "base64");
  return { ok: true, verdict: returnBytes[0] === 1 };
}

async function checkSignaturesExist(
  connection: Connection,
  receipt: TicketReceipt,
): Promise<CheckResult> {
  const signatures = receipt.transactions.map((transaction) => transaction.signature);
  if (signatures.length === 0) {
    return failCheck("the receipt lists no transactions");
  }
  const statuses = await connection.getSignatureStatuses(signatures, {
    searchTransactionHistory: true,
  });
  for (const [signatureIndex, status] of statuses.value.entries()) {
    if (status === null) {
      return failCheck(
        `transaction ${receipt.transactions[signatureIndex]?.kind ?? "unknown"} ${signatures[signatureIndex]} not found on devnet`,
      );
    }
  }
  console.log(`[verifyReceipt] ok: ${signatures.length} transaction(s) found on devnet`);
  return { ok: true };
}

function checkOddsBinding(
  label: string,
  validation: OddsValidation,
  committedMessageId: string,
  committedTsMs: number,
): CheckResult {
  if (validation.odds.MessageId !== committedMessageId) {
    return failCheck(
      `${label} proof is for record ${validation.odds.MessageId}, the account committed ${committedMessageId}`,
    );
  }
  if (validation.odds.Ts !== committedTsMs) {
    return failCheck(
      `${label} proof ts ${validation.odds.Ts} differs from the committed ts ${committedTsMs}`,
    );
  }
  console.log(`[verifyReceipt] ok: ${label} proof binds to the committed quote`);
  return { ok: true };
}

function checkDerivedRoot(
  label: string,
  derived: PublicKey,
  recorded: string,
): CheckResult {
  if (derived.toBase58() !== recorded) {
    return failCheck(
      `${label} root re-derives to ${derived.toBase58()}, the receipt recorded ${recorded}`,
    );
  }
  console.log(`[verifyReceipt] ok: ${label} root PDA re-derives from the proof timestamp`);
  return { ok: true };
}

export async function verifyTicketReceipt(
  connection: Connection,
  receiptPath: string,
): Promise<boolean> {
  const failAndReport = (reason: string): boolean => {
    console.error(`[verifyReceipt] FAIL: ${reason}`);
    return false;
  };

  // 1. Parse the untrusted file.
  let rawText: string;
  try {
    rawText = readFileSync(receiptPath, "utf8");
  } catch (readError) {
    return failAndReport(`cannot read ${receiptPath}: ${String(readError)}`);
  }
  let rawJson: unknown;
  try {
    rawJson = JSON.parse(rawText);
  } catch (parseError) {
    return failAndReport(`${receiptPath} is not valid JSON: ${String(parseError)}`);
  }
  const parsed = parseTicketReceipt(rawJson);
  if (!parsed.ok) {
    return failAndReport(parsed.reason);
  }
  const receipt = parsed.receipt;
  console.log(
    `[verifyReceipt] ok: schema v${receipt.version}, ticket ${receipt.ticket.address}`,
  );

  // 2. Every signature exists on chain.
  const signaturesCheck = await checkSignaturesExist(connection, receipt);
  if (!signaturesCheck.ok) return failAndReport(signaturesCheck.reason);

  // 3 + 4. Roots re-derive and proofs bind to the committed quotes.
  const txlineProgram = new PublicKey(receipt.txlineProgram);
  const oddsValidation = receipt.proofs.oddsValidation;
  const oddsBinding = checkOddsBinding(
    "opening quote",
    oddsValidation,
    receipt.ticket.oddsMessageId,
    receipt.ticket.oddsTsMs,
  );
  if (!oddsBinding.ok) return failAndReport(oddsBinding.reason);
  const oddsRootCheck = checkDerivedRoot(
    "daily odds",
    dailyOddsRootPda(txlineProgram, oddsValidation.odds.Ts),
    receipt.dailyRoots.oddsRootPda,
  );
  if (!oddsRootCheck.ok) return failAndReport(oddsRootCheck.reason);

  // 5. The TxLINE program accepts the proofs (simulated, no signer needed;
  // the bettor pays no fee because nothing is sent).
  const feePayer = new PublicKey(receipt.ticket.bettor);
  const txoracleProgram = new Program(txoracleIdl as Idl, { connection });
  const validateOddsMethod = txoracleProgram.methods.validateOdds;
  const validateStatMethod = txoracleProgram.methods.validateStat;
  if (!validateOddsMethod || !validateStatMethod) {
    return failAndReport("txoracle IDL is missing validate_odds or validate_stat");
  }

  const oddsArgs = buildOddsArgs(oddsValidation);
  const oddsInstruction = await validateOddsMethod(
    oddsArgs.ts,
    oddsArgs.oddsSnapshot,
    oddsArgs.summary,
    oddsArgs.subTreeProof,
    oddsArgs.mainTreeProof,
  )
    .accounts({
      dailyOddsMerkleRoots: dailyOddsRootPda(txlineProgram, oddsValidation.odds.Ts),
    })
    .instruction();
  const oddsSimulation = await simulateValidation(
    connection,
    oddsInstruction,
    feePayer,
    "validate_odds (opening quote)",
  );
  if (!oddsSimulation.ok) return failAndReport(oddsSimulation.reason);
  if (!oddsSimulation.verdict) {
    return failAndReport("validate_odds rejected the opening-quote proof");
  }
  console.log("[verifyReceipt] ok: validate_odds accepted the opening-quote proof");

  // 5b. Same for the cash-out quote when the ticket was sold back.
  const cashOutValidation: OddsValidation | null =
    receipt.proofs.cashOutOddsValidation ?? null;
  if (receipt.cashOut !== null) {
    if (cashOutValidation === null) {
      return failAndReport("the ticket was cashed out but the receipt embeds no cash-out proof");
    }
    const cashOutBinding = checkOddsBinding(
      "cash-out quote",
      cashOutValidation,
      receipt.cashOut.oddsMessageId,
      receipt.cashOut.oddsTsMs,
    );
    if (!cashOutBinding.ok) return failAndReport(cashOutBinding.reason);
    const cashOutArgs = buildOddsArgs(cashOutValidation);
    const cashOutInstruction = await validateOddsMethod(
      cashOutArgs.ts,
      cashOutArgs.oddsSnapshot,
      cashOutArgs.summary,
      cashOutArgs.subTreeProof,
      cashOutArgs.mainTreeProof,
    )
      .accounts({
        dailyOddsMerkleRoots: dailyOddsRootPda(txlineProgram, cashOutValidation.odds.Ts),
      })
      .instruction();
    const cashOutSimulation = await simulateValidation(
      connection,
      cashOutInstruction,
      feePayer,
      "validate_odds (cash-out quote)",
    );
    if (!cashOutSimulation.ok) return failAndReport(cashOutSimulation.reason);
    if (!cashOutSimulation.verdict) {
      return failAndReport("validate_odds rejected the cash-out-quote proof");
    }
    console.log("[verifyReceipt] ok: validate_odds accepted the cash-out-quote proof");
  }

  // 6. The settlement proof, when the market's outcome is anchored.
  const statValidation: ScoresStatValidation | null = receipt.proofs.statValidation;
  if (receipt.outcome !== null) {
    if (statValidation === null) {
      return failAndReport("the market is verified but the receipt embeds no settlement proof");
    }
    if (statValidation.summary.fixtureId !== receipt.market.fixtureId) {
      return failAndReport(
        `settlement proof is for fixture ${statValidation.summary.fixtureId}, the market committed ${receipt.market.fixtureId}`,
      );
    }
    const scoresMinTimestampMs = statValidation.summary.updateStats.minTimestamp;
    const derivedScoresRoot = dailyScoresRootPda(txlineProgram, scoresMinTimestampMs);
    if (receipt.dailyRoots.scoresRootPda !== null) {
      const scoresRootCheck = checkDerivedRoot(
        "daily scores",
        derivedScoresRoot,
        receipt.dailyRoots.scoresRootPda,
      );
      if (!scoresRootCheck.ok) return failAndReport(scoresRootCheck.reason);
    }

    const params: NormalizedMarketParams = receipt.market.params;
    const statArgs = buildStatArgs(statValidation, params);
    const statInstruction = await validateStatMethod(
      statArgs.ts,
      statArgs.fixtureSummary,
      statArgs.fixtureProof,
      statArgs.mainTreeProof,
      statArgs.predicate,
      statArgs.statA,
      statArgs.statB,
      statArgs.op,
    )
      .accounts({ dailyScoresMerkleRoots: derivedScoresRoot })
      .instruction();
    const statSimulation = await simulateValidation(
      connection,
      statInstruction,
      feePayer,
      "validate_stat",
    );
    if (!statSimulation.ok) return failAndReport(statSimulation.reason);
    if (statSimulation.verdict !== receipt.outcome.predicateHolds) {
      return failAndReport(
        `validate_stat evaluates the predicate to ${statSimulation.verdict}, the anchored outcome says ${receipt.outcome.predicateHolds}`,
      );
    }
    console.log(
      `[verifyReceipt] ok: validate_stat re-proves the outcome (predicate holds: ${statSimulation.verdict}, seq ${receipt.outcome.seq})`,
    );
  }

  console.log("[verifyReceipt] PASS: every check succeeded");
  return true;
}
