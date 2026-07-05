/**
 * Wallet-signed devnet actions: place a bet on a market and draw test USDT
 * from the TxLINE faucet. Errors come back as values for the UI to render.
 */

import { AnchorProvider, BN, Program, type Idl } from "@coral-xyz/anchor";
import type { AnchorWallet } from "@solana/wallet-adapter-react";
import { Connection, PublicKey, SystemProgram, Transaction } from "@solana/web3.js";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountIdempotentInstruction,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import {
  DEVNET_RPC_URL,
  SEED_FAUCET_TRACKER,
  SEED_USDT_TREASURY,
  TXLINE_PROGRAM_ID,
  USDT_MINT_DEVNET,
} from "@truebook/shared/config";
import TRUEBOOK_IDL from "@truebook/shared/idl/truebook.json";
import type { Truebook } from "@truebook/shared/idl/truebook-type";
import TXORACLE_IDL from "@truebook/shared/idl/txoracle";

export type ChainActionResult =
  | { ok: true; signature: string }
  | { ok: false; reason: string };

/** sourceRef: USDT test mint on devnet, 6 decimals. */
const USDT_DECIMAL_FACTOR = 1_000_000;

function buildWalletProvider(wallet: AnchorWallet): AnchorProvider {
  const connection = new Connection(DEVNET_RPC_URL, "confirmed");
  return new AnchorProvider(connection, wallet, { commitment: "confirmed" });
}

function randomNonce(): BN {
  const nonceBytes = new Uint8Array(8);
  crypto.getRandomValues(nonceBytes);
  // Clear the top bit so the value stays within u64 as a positive BN.
  nonceBytes[7] &= 0x7f;
  return new BN(nonceBytes, "le");
}

export async function placeBetOnChain(
  wallet: AnchorWallet,
  marketAddress: string,
  side: "yes" | "no",
  stakeUiAmount: number,
): Promise<ChainActionResult> {
  try {
    const provider = buildWalletProvider(wallet);
    const program = new Program<Truebook>(TRUEBOOK_IDL as Truebook, provider);
    const market = new PublicKey(marketAddress);

    const housePda = PublicKey.findProgramAddressSync(
      [new TextEncoder().encode("house")],
      program.programId,
    )[0];
    const house = await program.account.house.fetch(housePda);
    const bettorTokenAccount = getAssociatedTokenAddressSync(
      USDT_MINT_DEVNET,
      wallet.publicKey,
      false,
      TOKEN_PROGRAM_ID,
    );

    const stakeRaw = new BN(Math.round(stakeUiAmount * USDT_DECIMAL_FACTOR));
    const sideArg = side === "yes" ? { yes: {} } : { no: {} };

    const signature = await program.methods
      .placeBet(randomNonce(), sideArg, stakeRaw)
      .accounts({
        bettor: wallet.publicKey,
        market,
        vault: house.vault,
        bettorTokenAccount,
      })
      .rpc();
    return { ok: true, signature };
  } catch (betError) {
    return { ok: false, reason: String(betError) };
  }
}

/** The judge-panel faucet: mints test USDT to the connected wallet's ATA. */
export async function requestFaucetUsdtForWallet(
  wallet: AnchorWallet,
): Promise<ChainActionResult> {
  try {
    const provider = buildWalletProvider(wallet);
    const txoracleProgram = new Program(TXORACLE_IDL as Idl, provider);
    const faucetMethod = txoracleProgram.methods.requestDevnetFaucet;
    if (!faucetMethod) {
      return { ok: false, reason: "txoracle IDL is missing request_devnet_faucet" };
    }

    const seedEncoder = new TextEncoder();
    const [faucetTrackerPda] = PublicKey.findProgramAddressSync(
      [seedEncoder.encode(SEED_FAUCET_TRACKER), wallet.publicKey.toBytes()],
      TXLINE_PROGRAM_ID,
    );
    const [usdtTreasuryPda] = PublicKey.findProgramAddressSync(
      [seedEncoder.encode(SEED_USDT_TREASURY)],
      TXLINE_PROGRAM_ID,
    );
    const userUsdtAta = getAssociatedTokenAddressSync(
      USDT_MINT_DEVNET,
      wallet.publicKey,
      false,
      TOKEN_PROGRAM_ID,
    );
    const createAtaInstruction = createAssociatedTokenAccountIdempotentInstruction(
      wallet.publicKey,
      userUsdtAta,
      wallet.publicKey,
      USDT_MINT_DEVNET,
      TOKEN_PROGRAM_ID,
    );

    await provider.sendAndConfirm(new Transaction().add(createAtaInstruction));
    const signature = await faucetMethod()
      .accounts({
        user: wallet.publicKey,
        faucetTracker: faucetTrackerPda,
        usdtMint: USDT_MINT_DEVNET,
        userUsdtAta,
        usdtTreasuryPda,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
    return { ok: true, signature };
  } catch (faucetError) {
    return { ok: false, reason: String(faucetError) };
  }
}
