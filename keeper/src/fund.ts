// Fund the house vault on devnet: draw test USDT from the TxLINE faucet
// (request_devnet_faucet), then deposit_liquidity into the TrueBook vault so
// place_bet has payouts to reserve against.

import { AnchorProvider, BN, Program, type Idl } from "@coral-xyz/anchor";
import { Keypair, PublicKey, SystemProgram, Transaction } from "@solana/web3.js";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountIdempotentInstruction,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import {
  SEED_FAUCET_TRACKER,
  SEED_USDT_TREASURY,
  TXLINE_PROGRAM_ID,
  USDT_MINT_DEVNET,
  type Truebook,
} from "@truebook/shared";
import txoracleIdl from "@truebook/shared/idl/txoracle" with { type: "json" };
import { housePda, vaultPda } from "./pdas.js";

// sourceRef: mint ELWTKspH... on devnet (classic SPL token, 6 decimals).
const USDT_DECIMAL_FACTOR = 1_000_000;

type Result<TValue> = { ok: true; value: TValue } | { ok: false; reason: string };

export async function requestFaucetUsdt(
  provider: AnchorProvider,
  keypair: Keypair,
): Promise<Result<string>> {
  const txoracleProgram = new Program(txoracleIdl as Idl, provider);
  const faucetMethod = txoracleProgram.methods.requestDevnetFaucet;
  if (!faucetMethod) {
    return { ok: false, reason: "[requestFaucetUsdt] txoracle IDL is missing request_devnet_faucet" };
  }

  const [faucetTrackerPda] = PublicKey.findProgramAddressSync(
    [Buffer.from(SEED_FAUCET_TRACKER), keypair.publicKey.toBuffer()],
    TXLINE_PROGRAM_ID,
  );
  const [usdtTreasuryPda] = PublicKey.findProgramAddressSync(
    [Buffer.from(SEED_USDT_TREASURY)],
    TXLINE_PROGRAM_ID,
  );
  const userUsdtAta = getAssociatedTokenAddressSync(
    USDT_MINT_DEVNET,
    keypair.publicKey,
    false,
    TOKEN_PROGRAM_ID,
  );
  // The faucet mints into the user's USDT ATA; make sure it exists first.
  const createAtaInstruction = createAssociatedTokenAccountIdempotentInstruction(
    keypair.publicKey,
    userUsdtAta,
    keypair.publicKey,
    USDT_MINT_DEVNET,
    TOKEN_PROGRAM_ID,
  );

  try {
    await provider.sendAndConfirm(new Transaction().add(createAtaInstruction));
    const txSignature = await faucetMethod()
      .accounts({
        user: keypair.publicKey,
        faucetTracker: faucetTrackerPda,
        usdtMint: USDT_MINT_DEVNET,
        userUsdtAta,
        usdtTreasuryPda,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
    return { ok: true, value: txSignature };
  } catch (faucetError) {
    return { ok: false, reason: `[requestFaucetUsdt] ${String(faucetError)}` };
  }
}

export async function readUsdtBalance(
  provider: AnchorProvider,
  owner: PublicKey,
): Promise<bigint> {
  const ownerAta = getAssociatedTokenAddressSync(USDT_MINT_DEVNET, owner, false, TOKEN_PROGRAM_ID);
  const balance = await provider.connection.getTokenAccountBalance(ownerAta);
  return BigInt(balance.value.amount);
}

/**
 * Faucet then deposit. Deposits the requested UI amount, or the full ATA
 * balance when no amount is given. Rerun it to stack more liquidity (the
 * faucet tracker rate-limits per wallet on the TxLINE side).
 */
export async function fundHouseVault(
  program: Program<Truebook>,
  keypair: Keypair,
  depositUiAmount: number | null,
): Promise<void> {
  const provider = program.provider as AnchorProvider;

  const faucetResult = await requestFaucetUsdt(provider, keypair);
  if (faucetResult.ok) {
    console.log(`[fundHouseVault] faucet granted, tx ${faucetResult.value}`);
  } else {
    // A rate-limited faucet is not fatal: deposit whatever the ATA holds.
    console.warn(`[fundHouseVault] faucet request failed, continuing with current balance: ${faucetResult.reason}`);
  }

  const ataBalanceRaw = await readUsdtBalance(provider, keypair.publicKey);
  console.log(`[fundHouseVault] wallet USDT balance: ${Number(ataBalanceRaw) / USDT_DECIMAL_FACTOR}`);
  if (ataBalanceRaw === 0n) {
    console.error("[fundHouseVault] nothing to deposit (ATA balance is 0)");
    process.exit(1);
  }

  const depositRaw =
    depositUiAmount === null
      ? ataBalanceRaw
      : BigInt(Math.round(depositUiAmount * USDT_DECIMAL_FACTOR));
  if (depositRaw > ataBalanceRaw) {
    console.error(
      `[fundHouseVault] requested ${depositUiAmount} exceeds wallet balance ${Number(ataBalanceRaw) / USDT_DECIMAL_FACTOR}`,
    );
    process.exit(1);
  }

  const house = housePda(program.programId);
  const vault = vaultPda(program.programId, house);
  const authorityTokenAccount = getAssociatedTokenAddressSync(
    USDT_MINT_DEVNET,
    keypair.publicKey,
    false,
    TOKEN_PROGRAM_ID,
  );

  const depositSignature = await program.methods
    .depositLiquidity(new BN(depositRaw.toString()))
    .accounts({
      authority: keypair.publicKey,
      vault,
      authorityTokenAccount,
    })
    .rpc();

  const vaultBalance = await provider.connection.getTokenAccountBalance(vault);
  console.log(
    `[fundHouseVault] deposited ${Number(depositRaw) / USDT_DECIMAL_FACTOR} USDT, tx ${depositSignature}`,
  );
  console.log(`[fundHouseVault] vault balance: ${vaultBalance.value.uiAmountString} USDT`);
}
