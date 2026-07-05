/**
 * Devnet funds for the judge panel: read the connected wallet's SOL and test
 * USDT balances, and request a real SOL airdrop. Errors come back as values.
 */

import { Connection, LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import { DEVNET_RPC_URL, USDT_MINT_DEVNET } from "@truebook/shared/config";
import type { ChainActionResult } from "./placeBet";

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
    const connection = new Connection(DEVNET_RPC_URL, "confirmed");
    const lamports = await connection.getBalance(owner);
    const usdtAta = getAssociatedTokenAddressSync(
      USDT_MINT_DEVNET,
      owner,
      false,
      TOKEN_PROGRAM_ID,
    );
    // A wallet that never drew from the faucet has no ATA yet; that is 0.
    const ataInfo = await connection.getAccountInfo(usdtAta);
    let usdtUiAmount = 0;
    if (ataInfo !== null) {
      const balance = await connection.getTokenAccountBalance(usdtAta);
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
    const connection = new Connection(DEVNET_RPC_URL, "confirmed");
    const signature = await connection.requestAirdrop(owner, AIRDROP_LAMPORTS);
    const latestBlockhash = await connection.getLatestBlockhash("confirmed");
    await connection.confirmTransaction(
      { signature, ...latestBlockhash },
      "confirmed",
    );
    return { ok: true, signature };
  } catch (airdropError) {
    return { ok: false, reason: String(airdropError) };
  }
}
