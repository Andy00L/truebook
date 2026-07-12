/**
 * Wallet-signed cash-out: sell a live ticket back to the vault at the price
 * the program derives from the market's current on-chain quote. Same latency
 * discipline as placeBet.ts: every pre-signature read runs in ONE parallel
 * batch under deadlines, preflights fail fast with actionable messages, and
 * errors come back as values.
 */

import { PublicKey } from "@solana/web3.js";
import type { AnchorWallet } from "@solana/wallet-adapter-react";
import { TOKEN_PROGRAM_ID, getAssociatedTokenAddressSync } from "@solana/spl-token";
import { USDT_MINT_DEVNET } from "@truebook/shared/config";
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
  signSendAndConfirm,
  type ChainActionResult,
  type ChainStage,
} from "@/lib/chain/placeBet";

/** sourceRef: Solana runtime default fee, 5000 lamports per signature. */
const TRANSACTION_FEE_LAMPORTS = 5_000;
/**
 * Rent for the CashOutReceipt account the bettor pays to create. Read from
 * the cluster in the parallel batch; this is the size to price.
 * sourceRef: program state.rs CashOutReceipt (8 discriminator + INIT_SPACE).
 */
const CASHOUT_RECEIPT_ACCOUNT_BYTES = 8 + 32 * 4 + 8 + 4 + (4 + 64) + 8 + 8 + 1 + 8 + 1 + 1;

/**
 * The deployed program predates the cash-out upgrade. Anchor answers an
 * unknown instruction with InstructionFallbackNotFound (error code 101,
 * hex 0x65 in simulation logs).
 */
function isMissingInstructionError(reason: string): boolean {
  const lowered = reason.toLowerCase();
  return (
    lowered.includes("instructionfallbacknotfound") ||
    lowered.includes("fallback functions are not supported") ||
    lowered.includes("custom program error: 0x65")
  );
}

export async function cashOutTicketOnChain(
  wallet: AnchorWallet,
  ticketAddress: string,
  marketAddress: string,
  onStage?: (stage: ChainStage) => void,
): Promise<ChainActionResult> {
  try {
    onStage?.("preparing");
    const connection = createDevnetConnection();
    const program = buildReadOnlyTruebookProgram(connection);
    const ticket = new PublicKey(ticketAddress);
    const market = new PublicKey(marketAddress);
    const bettorTokenAccount = getAssociatedTokenAddressSync(
      USDT_MINT_DEVNET,
      wallet.publicKey,
      false,
      TOKEN_PROGRAM_ID,
    );

    // One parallel read batch: everything needed before the wallet prompt.
    const [lamports, receiptRentLamports, houseVault, latestBlockhash] =
      await Promise.all([
        withDeadline(
          connection.getBalance(wallet.publicKey),
          RPC_READ_TIMEOUT_MS,
          "The devnet RPC timed out while reading the wallet balance.",
        ),
        withDeadline(
          connection.getMinimumBalanceForRentExemption(CASHOUT_RECEIPT_ACCOUNT_BYTES),
          RPC_READ_TIMEOUT_MS,
          "The devnet RPC timed out while pricing the receipt account.",
        ),
        fetchHouseVault(program),
        fetchLatestBlockhash(connection),
      ]);

    if (lamports < TRANSACTION_FEE_LAMPORTS + receiptRentLamports) {
      return {
        ok: false,
        reason:
          "Not enough devnet SOL to create the cash-out receipt. Open Judge mode and request devnet SOL first.",
      };
    }

    const cashOutTransaction = await program.methods
      .cashOutTicket()
      .accounts({
        bettor: wallet.publicKey,
        market,
        ticket,
        vault: houseVault,
        bettorTokenAccount,
      })
      .transaction();
    return await signSendAndConfirm(
      connection,
      wallet,
      cashOutTransaction,
      latestBlockhash,
      onStage,
    );
  } catch (cashOutError) {
    const reason = describeChainError(cashOutError);
    if (isMissingInstructionError(reason)) {
      return {
        ok: false,
        reason:
          "Cash-out needs the upgraded devnet program. Deploy the new build, then retry.",
      };
    }
    return { ok: false, reason };
  }
}
