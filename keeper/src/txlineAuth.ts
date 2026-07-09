// Acquire a TxLINE data session for the keeper: guest JWT, on-chain subscribe to
// the free World Cup tier, then activate a long-lived API token. Ported from the
// verified devnet spike. sourceRef: docs/research/2026-07-02-spike-findings.md.

import { AnchorProvider, Program, Wallet, type Idl } from "@coral-xyz/anchor";
import { Connection, Keypair, PublicKey, SystemProgram } from "@solana/web3.js";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccountIdempotentInstruction,
} from "@solana/spl-token";
import { Transaction } from "@solana/web3.js";
import nacl from "tweetnacl";
import {
  ACCEPT_ENCODING_IDENTITY,
  API_TOKEN_PREFIX,
  SEED_PRICING_MATRIX,
  SEED_TOKEN_TREASURY_V2,
  SERVICE_LEVEL_ID_WORLD_CUP_FREE,
  SUBSCRIPTION_WEEKS_DEFAULT,
  TXLINE_API_ORIGIN,
  TXLINE_PROGRAM_ID,
  TXL_TOKEN_MINT,
  type TxlineAuth,
} from "@truebook/shared";
import txoracleIdl from "@truebook/shared/idl/txoracle" with { type: "json" };

type Result<TValue> = { ok: true; value: TValue } | { ok: false; reason: string };

async function startGuestSession(): Promise<Result<string>> {
  const response = await fetch(`${TXLINE_API_ORIGIN}/auth/guest/start`, { method: "POST" });
  const bodyText = await response.text();
  if (!response.ok) return { ok: false, reason: `[startGuestSession] HTTP ${response.status}: ${bodyText}` };
  const jwt = (JSON.parse(bodyText) as { token?: string }).token;
  if (!jwt) return { ok: false, reason: `[startGuestSession] no token in response` };
  return { ok: true, value: jwt };
}

async function subscribeOnChain(
  provider: AnchorProvider,
  keypair: Keypair,
): Promise<Result<string>> {
  const program = new Program(txoracleIdl as Idl, provider);
  const [pricingMatrixPda] = PublicKey.findProgramAddressSync(
    [Buffer.from(SEED_PRICING_MATRIX)],
    TXLINE_PROGRAM_ID,
  );
  const [tokenTreasuryPda] = PublicKey.findProgramAddressSync(
    [Buffer.from(SEED_TOKEN_TREASURY_V2)],
    TXLINE_PROGRAM_ID,
  );
  const tokenTreasuryVault = getAssociatedTokenAddressSync(
    TXL_TOKEN_MINT,
    tokenTreasuryPda,
    true,
    TOKEN_2022_PROGRAM_ID,
  );
  const userTokenAccount = getAssociatedTokenAddressSync(
    TXL_TOKEN_MINT,
    keypair.publicKey,
    false,
    TOKEN_2022_PROGRAM_ID,
  );
  // The subscribe instruction expects the user's TxL ATA to exist first.
  const createAtaInstruction = createAssociatedTokenAccountIdempotentInstruction(
    keypair.publicKey,
    userTokenAccount,
    keypair.publicKey,
    TXL_TOKEN_MINT,
    TOKEN_2022_PROGRAM_ID,
  );
  // The txoracle program is loaded from a generic IDL, so index its methods safely.
  const subscribeMethod = program.methods.subscribe;
  if (!subscribeMethod) {
    return { ok: false, reason: "[subscribeOnChain] txoracle IDL is missing the subscribe instruction" };
  }
  try {
    await provider.sendAndConfirm(new Transaction().add(createAtaInstruction));
    const txSignature = await subscribeMethod(SERVICE_LEVEL_ID_WORLD_CUP_FREE, SUBSCRIPTION_WEEKS_DEFAULT)
      .accounts({
        user: keypair.publicKey,
        pricingMatrix: pricingMatrixPda,
        tokenMint: TXL_TOKEN_MINT,
        userTokenAccount,
        tokenTreasuryVault,
        tokenTreasuryPda,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
    return { ok: true, value: txSignature };
  } catch (subscribeError) {
    return { ok: false, reason: `[subscribeOnChain] ${String(subscribeError)}` };
  }
}

async function activateApiToken(jwt: string, txSignature: string, keypair: Keypair): Promise<Result<string>> {
  // Activation message format: `${txSig}:${leagues}:${jwt}` (empty leagues here).
  const activationMessage = `${txSignature}::${jwt}`;
  const signatureBytes = nacl.sign.detached(new TextEncoder().encode(activationMessage), keypair.secretKey);
  const response = await fetch(`${TXLINE_API_ORIGIN}/api/token/activate`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${jwt}`,
      "Content-Type": "application/json",
      "Accept-Encoding": ACCEPT_ENCODING_IDENTITY,
    },
    body: JSON.stringify({
      txSig: txSignature,
      walletSignature: Buffer.from(signatureBytes).toString("base64"),
      leagues: [],
    }),
  });
  const bodyText = await response.text();
  if (!response.ok) return { ok: false, reason: `[activateApiToken] HTTP ${response.status}: ${bodyText}` };
  const apiToken = bodyText.trim().replace(/^"|"$/g, "");
  if (!apiToken.startsWith(API_TOKEN_PREFIX)) {
    return { ok: false, reason: `[activateApiToken] unexpected token body: ${bodyText.slice(0, 120)}` };
  }
  return { ok: true, value: apiToken };
}

// Run the full auth flow and return the credentials the data client needs.
// Env override first: /api/token/activate started returning HTTP 500 on
// July 9, 2026 while previously activated tokens kept working, so a stored
// TXLINE_API_TOKEN (with its paired TXLINE_JWT) bypasses the broken step.
export async function acquireTxlineAuth(
  connection: Connection,
  keypair: Keypair,
): Promise<Result<TxlineAuth>> {
  const envApiToken = process.env.TXLINE_API_TOKEN ?? "";
  if (envApiToken.length > 0) {
    console.log("[acquireTxlineAuth] using TXLINE_API_TOKEN from env, skipping activation");
    return { ok: true, value: { jwt: process.env.TXLINE_JWT ?? "", apiToken: envApiToken } };
  }

  const provider = new AnchorProvider(connection, new Wallet(keypair), { commitment: "confirmed" });

  const guestResult = await startGuestSession();
  if (!guestResult.ok) return guestResult;

  const subscribeResult = await subscribeOnChain(provider, keypair);
  if (!subscribeResult.ok) return subscribeResult;

  const activateResult = await activateApiToken(guestResult.value, subscribeResult.value, keypair);
  if (!activateResult.ok) return activateResult;

  return { ok: true, value: { jwt: guestResult.value, apiToken: activateResult.value } };
}
