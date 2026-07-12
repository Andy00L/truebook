/**
 * Wallet-signed price audits from the browser: prove a ticket's or a
 * cash-out's served price against the TxLINE consensus, and collect what a
 * proven violation owes. This is the judge doing on-chain, from the UI, what
 * the keeper CLI does: audit_ticket (bounty paid inline), or audit_cash_out
 * followed by claim_cash_out_repair, and refund_ticket to reclaim a stake a
 * proven overcharge unlocked. The TxLINE proof comes from the server route
 * (auditArgs.ts); the token never touches the browser.
 */

import { Program } from "@coral-xyz/anchor";
import {
  ComputeBudgetProgram,
  PublicKey,
  Transaction,
} from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountIdempotentInstruction,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import type { AnchorWallet } from "@solana/wallet-adapter-react";
import {
  SEED_DAILY_BATCH_ROOTS,
  TXLINE_PROGRAM_ID,
  USDT_MINT_DEVNET,
} from "@truebook/shared/config";
import type { Truebook } from "@truebook/shared/idl/truebook-type";
import {
  RPC_READ_TIMEOUT_MS,
  createDevnetConnection,
  withDeadline,
} from "@/lib/chain/connection";
import {
  buildReadOnlyTruebookProgram,
  describeChainError,
  fetchHouseVault,
  fetchLatestBlockhash,
  readUsdtBalanceUi,
  signSendAndConfirm,
  type ChainActionResult,
  type ChainStage,
} from "@/lib/chain/placeBet";
import {
  buildOddsArgsFromRaw,
  epochDayLeBytes,
  fetchAuditArgs,
} from "@/lib/chain/auditArgs";

/** sourceRef: Solana runtime default fee, 5000 lamports per signature. */
const TRANSACTION_FEE_LAMPORTS = 5_000;
/** sourceRef: rent-exempt minimum for a 165-byte SPL token account. */
const TOKEN_ACCOUNT_RENT_LAMPORTS = 2_039_280;
/** validate_odds CPI is heavy (about 180k CU on devnet); lift the ceiling. */
const AUDIT_CU_LIMIT = 1_400_000;

export type AuditVerdict = "honest" | "violation";

export type AuditResult =
  | {
      ok: true;
      verdict: AuditVerdict;
      auditSignature: string;
      /** USDT the auditor's balance gained (the bounty), UI units. */
      bountyEarned: number;
      /** USDT repaid to the bettor on a cash-out violation, UI units. */
      shortfallRepaid: number;
      /** A ticket audit that flipped the ticket to Refundable. */
      becameRefundable: boolean;
      /** The claim/settlement transaction, when a second step ran. */
      settlementSignature: string | null;
    }
  | { ok: false; reason: string };

function dailyOddsRootPda(oddsTsMs: number): PublicKey {
  return PublicKey.findProgramAddressSync(
    [new TextEncoder().encode(SEED_DAILY_BATCH_ROOTS), epochDayLeBytes(oddsTsMs)],
    TXLINE_PROGRAM_ID,
  )[0];
}

function enumVariant(enumObject: object): string {
  return Object.keys(enumObject)[0] ?? "unknown";
}

function auditorUsdtAta(owner: PublicKey): PublicKey {
  return getAssociatedTokenAddressSync(USDT_MINT_DEVNET, owner, false, TOKEN_PROGRAM_ID);
}

/** Shared preamble: read the ticket, fetch its quote proof, build the args. */
async function loadTicketProof(
  program: Program<Truebook>,
  ticket: PublicKey,
): Promise<
  | {
      ok: true;
      account: Awaited<ReturnType<Program<Truebook>["account"]["ticket"]["fetch"]>>;
      args: ReturnType<typeof buildOddsArgsFromRaw>;
      oddsTsMs: number;
    }
  | { ok: false; reason: string }
> {
  const account = await withDeadline(
    program.account.ticket.fetch(ticket),
    RPC_READ_TIMEOUT_MS,
    "The devnet RPC timed out while reading the ticket.",
  );
  const argsResult = await fetchAuditArgs(
    account.oddsMessageId,
    account.oddsTs.toNumber(),
  );
  if (!argsResult.ok) {
    return { ok: false, reason: argsResult.reason };
  }
  return {
    ok: true,
    account,
    args: buildOddsArgsFromRaw(argsResult.validation),
    oddsTsMs: argsResult.validation.odds.Ts,
  };
}

/**
 * Audit a ticket's opening price. On a proven overcharge the program pays the
 * signer the 5 percent bounty inline and flags the ticket refundable.
 */
export async function auditTicketOnChain(
  wallet: AnchorWallet,
  ticketAddress: string,
  onStage?: (stage: ChainStage) => void,
): Promise<AuditResult> {
  try {
    onStage?.("preparing");
    const connection = createDevnetConnection();
    const program = buildReadOnlyTruebookProgram(connection);
    const ticket = new PublicKey(ticketAddress);

    const proof = await loadTicketProof(program, ticket);
    if (!proof.ok) {
      return { ok: false, reason: proof.reason };
    }

    const auditorAta = auditorUsdtAta(wallet.publicKey);
    const [ataInfo, lamports, houseVault, latestBlockhash, usdtBefore] =
      await Promise.all([
        withDeadline(
          connection.getAccountInfo(auditorAta),
          RPC_READ_TIMEOUT_MS,
          "The devnet RPC timed out while reading the USDT account.",
        ),
        withDeadline(
          connection.getBalance(wallet.publicKey),
          RPC_READ_TIMEOUT_MS,
          "The devnet RPC timed out while reading the wallet balance.",
        ),
        fetchHouseVault(program),
        fetchLatestBlockhash(connection),
        readUsdtBalanceUi(connection, auditorAta),
      ]);

    const needsAta = ataInfo === null;
    const lamportsNeeded =
      TRANSACTION_FEE_LAMPORTS + (needsAta ? TOKEN_ACCOUNT_RENT_LAMPORTS : 0);
    if (lamports < lamportsNeeded) {
      return {
        ok: false,
        reason:
          "Not enough devnet SOL to audit. Open Judge mode and request devnet SOL first.",
      };
    }

    const auditInstruction = await program.methods
      .auditTicket(proof.args)
      .accounts({
        cranker: wallet.publicKey,
        market: proof.account.market,
        ticket,
        vault: houseVault,
        auditorTokenAccount: auditorAta,
        dailyOddsMerkleRoots: dailyOddsRootPda(proof.oddsTsMs),
      })
      .instruction();

    const auditTransaction = new Transaction();
    auditTransaction.add(
      ComputeBudgetProgram.setComputeUnitLimit({ units: AUDIT_CU_LIMIT }),
    );
    if (needsAta) {
      // The bounty needs somewhere to land even when the verdict is honest
      // (the account constraint always requires a real token account).
      auditTransaction.add(
        createAssociatedTokenAccountIdempotentInstruction(
          wallet.publicKey,
          auditorAta,
          wallet.publicKey,
          USDT_MINT_DEVNET,
          TOKEN_PROGRAM_ID,
        ),
      );
    }
    auditTransaction.add(auditInstruction);

    const sent = await signSendAndConfirm(
      connection,
      wallet,
      auditTransaction,
      latestBlockhash,
      onStage,
    );
    if (!sent.ok) {
      return { ok: false, reason: sent.reason };
    }

    const auditedTicket = await program.account.ticket.fetch(ticket);
    const verdict: AuditVerdict =
      enumVariant(auditedTicket.auditStatus) === "violation" ? "violation" : "honest";
    const usdtAfter = await readUsdtBalanceUi(connection, auditorAta);
    return {
      ok: true,
      verdict,
      auditSignature: sent.signature,
      bountyEarned: Math.max(0, usdtAfter - usdtBefore),
      shortfallRepaid: 0,
      becameRefundable: enumVariant(auditedTicket.state) === "refundable",
      settlementSignature: null,
    };
  } catch (auditError) {
    return { ok: false, reason: describeChainError(auditError) };
  }
}

/**
 * Audit a cash-out's price, then, on a proven lowball, claim the repair: the
 * bettor's shortfall and the auditor's bounty. The verdict and the payout are
 * two transactions on purpose (the program keeps the oracle CPI and the token
 * transfers in separate instructions), so the wallet prompts twice.
 */
export async function auditCashOutOnChain(
  wallet: AnchorWallet,
  ticketAddress: string,
  onStage?: (stage: ChainStage) => void,
): Promise<AuditResult> {
  try {
    onStage?.("preparing");
    const connection = createDevnetConnection();
    const program = buildReadOnlyTruebookProgram(connection);
    const ticket = new PublicKey(ticketAddress);
    const receiptPda = PublicKey.findProgramAddressSync(
      [new TextEncoder().encode("cashout"), ticket.toBytes()],
      program.programId,
    )[0];

    const receipt = await withDeadline(
      program.account.cashOutReceipt.fetch(receiptPda),
      RPC_READ_TIMEOUT_MS,
      "The devnet RPC timed out while reading the cash-out receipt.",
    );
    const argsResult = await fetchAuditArgs(
      receipt.oddsMessageId,
      receipt.oddsTs.toNumber(),
    );
    if (!argsResult.ok) {
      return { ok: false, reason: argsResult.reason };
    }
    const args = buildOddsArgsFromRaw(argsResult.validation);

    const [lamports, latestBlockhash] = await Promise.all([
      withDeadline(
        connection.getBalance(wallet.publicKey),
        RPC_READ_TIMEOUT_MS,
        "The devnet RPC timed out while reading the wallet balance.",
      ),
      fetchLatestBlockhash(connection),
    ]);
    if (lamports < TRANSACTION_FEE_LAMPORTS * 2) {
      return {
        ok: false,
        reason:
          "Not enough devnet SOL to audit and claim. Open Judge mode and request devnet SOL first.",
      };
    }

    const auditTransaction = new Transaction();
    auditTransaction.add(
      ComputeBudgetProgram.setComputeUnitLimit({ units: AUDIT_CU_LIMIT }),
    );
    auditTransaction.add(
      await program.methods
        .auditCashOut(args)
        .accounts({
          cranker: wallet.publicKey,
          market: receipt.market,
          ticket,
          dailyOddsMerkleRoots: dailyOddsRootPda(argsResult.validation.odds.Ts),
        })
        .instruction(),
    );

    const audited = await signSendAndConfirm(
      connection,
      wallet,
      auditTransaction,
      latestBlockhash,
      onStage,
    );
    if (!audited.ok) {
      return { ok: false, reason: audited.reason };
    }

    const auditedReceipt = await program.account.cashOutReceipt.fetch(receiptPda);
    if (enumVariant(auditedReceipt.auditStatus) !== "violation") {
      return {
        ok: true,
        verdict: "honest",
        auditSignature: audited.signature,
        bountyEarned: 0,
        shortfallRepaid: 0,
        becameRefundable: false,
        settlementSignature: null,
      };
    }

    // A proven lowball: claim the shortfall for the bettor and the bounty for
    // the auditor (both are the connected wallet here). Bettor and auditor
    // ATAs already exist (the cash-out paid into the bettor's).
    onStage?.("preparing");
    const bettorAta = auditorUsdtAta(auditedReceipt.bettor);
    const auditorAta = auditorUsdtAta(auditedReceipt.auditor);
    const usdtBefore = await readUsdtBalanceUi(connection, auditorAta);
    const claimBlockhash = await fetchLatestBlockhash(connection);
    const claimInstruction = await program.methods
      .claimCashOutRepair()
      .accounts({
        cranker: wallet.publicKey,
        ticket,
        vault: await fetchHouseVault(program),
        bettorTokenAccount: bettorAta,
        auditorTokenAccount: auditorAta,
      })
      .instruction();
    const claimTransaction = new Transaction();
    claimTransaction.add(claimInstruction);
    const claimed = await signSendAndConfirm(
      connection,
      wallet,
      claimTransaction,
      claimBlockhash,
      onStage,
    );
    if (!claimed.ok) {
      // The verdict landed; only the payout failed. Report it honestly so the
      // judge knows the proof is on chain and the claim can be retried.
      return {
        ok: false,
        reason: `Overcharge proven (tx ${audited.signature.slice(0, 8)}…) but the repair payout failed: ${claimed.reason}`,
      };
    }

    const shortfallUi = auditedReceipt.shortfallOwed.toNumber() / 1_000_000;
    const usdtAfter = await readUsdtBalanceUi(connection, auditorAta);
    // The auditor is also the bettor here, so the balance gained is shortfall
    // plus bounty; the bounty is that gain minus the repaid shortfall.
    const totalGain = Math.max(0, usdtAfter - usdtBefore);
    return {
      ok: true,
      verdict: "violation",
      auditSignature: audited.signature,
      bountyEarned: Math.max(0, totalGain - shortfallUi),
      shortfallRepaid: shortfallUi,
      becameRefundable: false,
      settlementSignature: claimed.signature,
    };
  } catch (auditError) {
    return { ok: false, reason: describeChainError(auditError) };
  }
}

/** Reclaim the full stake of a ticket a proven overcharge made refundable. */
export async function refundTicketOnChain(
  wallet: AnchorWallet,
  ticketAddress: string,
  onStage?: (stage: ChainStage) => void,
): Promise<ChainActionResult> {
  try {
    onStage?.("preparing");
    const connection = createDevnetConnection();
    const program = buildReadOnlyTruebookProgram(connection);
    const ticket = new PublicKey(ticketAddress);

    const account = await withDeadline(
      program.account.ticket.fetch(ticket),
      RPC_READ_TIMEOUT_MS,
      "The devnet RPC timed out while reading the ticket.",
    );
    const [houseVault, latestBlockhash] = await Promise.all([
      fetchHouseVault(program),
      fetchLatestBlockhash(connection),
    ]);

    const refundTransaction = await program.methods
      .refundTicket()
      .accounts({
        cranker: wallet.publicKey,
        market: account.market,
        ticket,
        vault: houseVault,
        bettorTokenAccount: auditorUsdtAta(account.bettor),
      })
      .transaction();
    return await signSendAndConfirm(
      connection,
      wallet,
      refundTransaction,
      latestBlockhash,
      onStage,
    );
  } catch (refundError) {
    return { ok: false, reason: describeChainError(refundError) };
  }
}
