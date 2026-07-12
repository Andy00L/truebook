/**
 * Devnet funds for the judge panel: read the connected wallet's SOL and test
 * USDT balances, and request a real SOL airdrop. Every RPC call runs under a
 * deadline (connection.ts) and errors come back as values.
 */

import { LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import { USDT_MINT_DEVNET } from "@truebook/shared/config";
import type { ChainActionResult } from "./placeBet";
import {
  CONFIRM_TIMEOUT_MS,
  RPC_READ_TIMEOUT_MS,
  createDevnetConnection,
  withDeadline,
} from "@/lib/chain/connection";

export type WalletFunds = {
  sol: number;
  usdt: number;
};

export type WalletFundsResult =
  | { ok: true; funds: WalletFunds }
  | { ok: false; reason: string };

const AIRDROP_LAMPORTS = 1 * LAMPORTS_PER_SOL;

export async function fetchWalletFunds(
  owner: PublicKey,
): Promise<WalletFundsResult> {
  try {
    const connection = createDevnetConnection();
    const lamports = await withDeadline(
      connection.getBalance(owner),
      RPC_READ_TIMEOUT_MS,
      "The devnet RPC timed out while reading the wallet balance.",
    );
    const usdtAta = getAssociatedTokenAddressSync(
      USDT_MINT_DEVNET,
      owner,
      false,
      TOKEN_PROGRAM_ID,
    );
    // A wallet that never drew from the faucet has no ATA yet; that is 0.
    const ataInfo = await withDeadline(
      connection.getAccountInfo(usdtAta),
      RPC_READ_TIMEOUT_MS,
      "The devnet RPC timed out while reading the USDT account.",
    );
    let usdtUiAmount = 0;
    if (ataInfo !== null) {
      const balance = await withDeadline(
        connection.getTokenAccountBalance(usdtAta),
        RPC_READ_TIMEOUT_MS,
        "The devnet RPC timed out while reading the USDT balance.",
      );
      usdtUiAmount = balance.value.uiAmount ?? 0;
    }
    return {
      ok: true,
      funds: { sol: lamports / LAMPORTS_PER_SOL, usdt: usdtUiAmount },
    };
  } catch (fundsError) {
    return { ok: false, reason: String(fundsError) };
  }
}

/** Devnet-only airdrop; the public faucet rate-limits, so failures are expected. */
export async function requestDevnetSolAirdrop(
  owner: PublicKey,
): Promise<ChainActionResult> {
  try {
    const connection = createDevnetConnection();
    const signature = await withDeadline(
      connection.requestAirdrop(owner, AIRDROP_LAMPORTS),
      RPC_READ_TIMEOUT_MS,
      "The devnet airdrop request timed out. Try faucet.solana.com instead.",
    );
    const latestBlockhash = await withDeadline(
      connection.getLatestBlockhash("confirmed"),
      RPC_READ_TIMEOUT_MS,
      "The devnet RPC timed out while confirming the airdrop.",
    );
    await withDeadline(
      connection.confirmTransaction(
        { signature, ...latestBlockhash },
        "confirmed",
      ),
      CONFIRM_TIMEOUT_MS,
      "The airdrop was sent but not confirmed in time. Check the balance in a moment.",
    );
    return { ok: true, signature };
  } catch (airdropError) {
    return { ok: false, reason: String(airdropError) };
  }
}
