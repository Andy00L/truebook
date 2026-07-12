/**
 * Wallet-signed devnet actions: place a bet on a market and draw test USDT
 * from the TxLINE faucet. Every RPC read, the wallet signature, and the
 * confirmation each run under their own deadline (connection.ts), balances
 * are preflighted so a wallet funded on mainnet but empty on devnet gets an
 * actionable message instead of a frozen spinner, and errors come back as
 * values for the UI to render.
 */

import { BN, Program, type Idl } from "@coral-xyz/anchor";
import type { AnchorWallet } from "@solana/wallet-adapter-react";
import {
  Connection,
  PublicKey,
  SystemProgram,
  Transaction,
} from "@solana/web3.js";
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
} from "@truebook/shared/config";
import TRUEBOOK_IDL from "@truebook/shared/idl/truebook.json";
import type { Truebook } from "@truebook/shared/idl/truebook-type";
import TXORACLE_IDL from "@truebook/shared/idl/txoracle";
import {
  CONFIRM_TIMEOUT_MS,
  RPC_READ_TIMEOUT_MS,
  WALLET_SIGNATURE_TIMEOUT_MS,
  createDevnetConnection,
  withDeadline,
} from "@/lib/chain/connection";

export type ChainActionResult =
  | { ok: true; signature: string }
  | { ok: false; reason: string };

/** The UI mirrors these so the spinner says what it is waiting for. */
export type ChainStage = "preparing" | "signing" | "confirming";

/** sourceRef: USDT test mint on devnet, 6 decimals. */
const USDT_DECIMAL_FACTOR = 1_000_000;
/** sourceRef: Solana runtime default fee, 5000 lamports per signature. */
const TRANSACTION_FEE_LAMPORTS = 5_000;
/** sourceRef: rent-exempt minimum for a 165-byte SPL token account. */
const TOKEN_ACCOUNT_RENT_LAMPORTS = 2_039_280;

const DEVNET_HINT =
  "TrueBook runs on Solana devnet; mainnet balances do not count here.";

/** Maps raw wallet/RPC failures onto distinct, actionable messages. */
function describeChainError(chainError: unknown): string {
  const text =
    chainError instanceof Error ? chainError.message : String(chainError);
  const lowered = text.toLowerCase();
  if (
    lowered.includes("user rejected") ||
    lowered.includes("rejected the request") ||
    lowered.includes("declined")
  ) {
    return "Signature request declined in the wallet.";
  }
  if (lowered.includes("429") || lowered.includes("too many requests")) {
    return "The devnet RPC rate-limited the request. Wait a few seconds and retry.";
  }
  if (
    lowered.includes("failed to fetch") ||
    lowered.includes("networkerror") ||
    lowered.includes("load failed")
  ) {
    return "The devnet RPC is unreachable. Check the connection and retry.";
  }
  return text;
}

function buildReadOnlyTruebookProgram(connection: Connection): Program<Truebook> {
  return new Program<Truebook>(TRUEBOOK_IDL as Truebook, { connection });
}

function randomNonce(): BN {
  const nonceBytes = new Uint8Array(8);
  crypto.getRandomValues(nonceBytes);
  // Clear the top bit so the value stays within u64 as a positive BN.
  nonceBytes[7] &= 0x7f;
  return new BN(nonceBytes, "le");
}

/**
 * Shared tail of every wallet flow: blockhash, wallet signature, send,
 * confirm. Each step has its own deadline and failure message so a stall
 * names the stage instead of spinning.
 */
async function signSendAndConfirm(
  connection: Connection,
  wallet: AnchorWallet,
  transaction: Transaction,
  onStage?: (stage: ChainStage) => void,
): Promise<ChainActionResult> {
  const latestBlockhash = await withDeadline(
    connection.getLatestBlockhash("confirmed"),
    RPC_READ_TIMEOUT_MS,
    "The devnet RPC timed out while preparing the transaction.",
  );
  transaction.feePayer = wallet.publicKey;
  transaction.recentBlockhash = latestBlockhash.blockhash;

  onStage?.("signing");
  const signedTransaction = await withDeadline(
    wallet.signTransaction(transaction),
    WALLET_SIGNATURE_TIMEOUT_MS,
    "The wallet never answered the signature request. Unlock the wallet extension and retry.",
  );

  onStage?.("confirming");
  const signature = await withDeadline(
    connection.sendRawTransaction(signedTransaction.serialize()),
    RPC_READ_TIMEOUT_MS,
    "The devnet RPC timed out while sending the transaction.",
  );
  const confirmation = await withDeadline(
    connection.confirmTransaction({ signature, ...latestBlockhash }, "confirmed"),
    CONFIRM_TIMEOUT_MS,
    `Sent but not confirmed within ${CONFIRM_TIMEOUT_MS / 1000}s. Look up ${signature} on the explorer before retrying.`,
  );
  if (confirmation.value.err !== null) {
    return {
      ok: false,
      reason: `The transaction failed on devnet: ${JSON.stringify(confirmation.value.err)}`,
    };
  }
  return { ok: true, signature };
}

/**
 * Fails fast, before any wallet prompt, when the connected wallet cannot pay
 * for the bet on devnet. This is the mainnet-wallet trap: funds on mainnet,
 * zero on devnet, and without this check the flow dies in wallet simulation.
 */
async function preflightBetFunds(
  connection: Connection,
  owner: PublicKey,
  stakeUiAmount: number,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const lamports = await withDeadline(
    connection.getBalance(owner),
    RPC_READ_TIMEOUT_MS,
    "The devnet RPC timed out while reading the wallet balance.",
  );
  if (lamports < TRANSACTION_FEE_LAMPORTS) {
    return {
      ok: false,
      reason: `No devnet SOL to pay the network fee. Open Judge mode and request devnet SOL first. ${DEVNET_HINT}`,
    };
  }
  const bettorTokenAccount = getAssociatedTokenAddressSync(
    USDT_MINT_DEVNET,
    owner,
    false,
    TOKEN_PROGRAM_ID,
  );
  const tokenAccountInfo = await withDeadline(
    connection.getAccountInfo(bettorTokenAccount),
    RPC_READ_TIMEOUT_MS,
    "The devnet RPC timed out while reading the USDT balance.",
  );
  if (tokenAccountInfo === null) {
    return {
      ok: false,
      reason: `No test USDT in this wallet yet. Open Judge mode and request test USDT first. ${DEVNET_HINT}`,
    };
  }
  const tokenBalance = await withDeadline(
    connection.getTokenAccountBalance(bettorTokenAccount),
    RPC_READ_TIMEOUT_MS,
    "The devnet RPC timed out while reading the USDT balance.",
  );
  const usdtAvailable = tokenBalance.value.uiAmount ?? 0;
  if (usdtAvailable < stakeUiAmount) {
    return {
      ok: false,
      reason: `Stake exceeds the devnet USDT balance (${usdtAvailable.toFixed(2)} available). Request more in Judge mode.`,
    };
  }
  return { ok: true };
}

export async function placeBetOnChain(
  wallet: AnchorWallet,
  marketAddress: string,
  side: "yes" | "no",
  stakeUiAmount: number,
  onStage?: (stage: ChainStage) => void,
): Promise<ChainActionResult> {
  try {
    onStage?.("preparing");
    const connection = createDevnetConnection();
    const program = buildReadOnlyTruebookProgram(connection);
    const market = new PublicKey(marketAddress);

    const fundsCheck = await preflightBetFunds(
      connection,
      wallet.publicKey,
      stakeUiAmount,
    );
    if (!fundsCheck.ok) {
      return fundsCheck;
    }

    const housePda = PublicKey.findProgramAddressSync(
      [new TextEncoder().encode("house")],
      program.programId,
    )[0];
    const house = await withDeadline(
      program.account.house.fetch(housePda),
      RPC_READ_TIMEOUT_MS,
      "The devnet RPC timed out while reading the house account.",
    );
    const bettorTokenAccount = getAssociatedTokenAddressSync(
      USDT_MINT_DEVNET,
      wallet.publicKey,
      false,
      TOKEN_PROGRAM_ID,
    );

    const stakeRaw = new BN(Math.round(stakeUiAmount * USDT_DECIMAL_FACTOR));
    const sideArg = side === "yes" ? { yes: {} } : { no: {} };

    const betTransaction = await program.methods
      .placeBet(randomNonce(), sideArg, stakeRaw)
      .accounts({
        bettor: wallet.publicKey,
        market,
        vault: house.vault,
        bettorTokenAccount,
      })
      .transaction();
    return await signSendAndConfirm(connection, wallet, betTransaction, onStage);
  } catch (betError) {
    return { ok: false, reason: describeChainError(betError) };
  }
}

/**
 * The judge-panel faucet: mints test USDT to the connected wallet's ATA.
 * ATA creation and the faucet draw ride one transaction, so the wallet
 * prompts once instead of twice.
 */
export async function requestFaucetUsdtForWallet(
  wallet: AnchorWallet,
  onStage?: (stage: ChainStage) => void,
): Promise<ChainActionResult> {
  try {
    onStage?.("preparing");
    const connection = createDevnetConnection();
    const txoracleProgram = new Program(TXORACLE_IDL as Idl, { connection });
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

    const ataInfo = await withDeadline(
      connection.getAccountInfo(userUsdtAta),
      RPC_READ_TIMEOUT_MS,
      "The devnet RPC timed out while reading the USDT account.",
    );
    const lamports = await withDeadline(
      connection.getBalance(wallet.publicKey),
      RPC_READ_TIMEOUT_MS,
      "The devnet RPC timed out while reading the wallet balance.",
    );
    const lamportsNeeded =
      TRANSACTION_FEE_LAMPORTS +
      (ataInfo === null ? TOKEN_ACCOUNT_RENT_LAMPORTS : 0);
    if (lamports < lamportsNeeded) {
      return {
        ok: false,
        reason: `Not enough devnet SOL to pay the faucet fee. Request devnet SOL below first. ${DEVNET_HINT}`,
      };
    }

    const faucetInstruction = await faucetMethod()
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
      .instruction();

    const faucetTransaction = new Transaction();
    if (ataInfo === null) {
      faucetTransaction.add(
        createAssociatedTokenAccountIdempotentInstruction(
          wallet.publicKey,
          userUsdtAta,
          wallet.publicKey,
          USDT_MINT_DEVNET,
          TOKEN_PROGRAM_ID,
        ),
      );
    }
    faucetTransaction.add(faucetInstruction);
    return await signSendAndConfirm(
      connection,
      wallet,
      faucetTransaction,
      onStage,
    );
  } catch (faucetError) {
    return { ok: false, reason: describeChainError(faucetError) };
  }
}
