// TrueBook keeper entry point. Commands:
//   setup                initialize the house (one time, by the operator)
//   fund [amount]        faucet test USDT then deposit into the house vault
//   list                 print house figures and every market with its pubkey
//   tick (default)       create markets, lock due ones, refresh quotes from TxLINE
//   settle <market>      prove a locked market's outcome and pay its tickets
//   rig <market> [factor] post one overcharged NO quote for the sting demo
//   bet <market> <yes|no> <stake>  ops bet from the keeper wallet (rehearsal)
//   cashout <ticket>     ops cash-out of a keeper ticket at the current quote
//   audit <ticket>       prove the ticket's served price against consensus
//   audit-cashout <receipt>  prove a cash-out's price against consensus
//   refund <ticket>      refund a refundable ticket's stake to its bettor
//   serve [seconds]      loop markets + in-play + quotes + settle + re-rig
//   export-receipt <ticket> [outFile]  write the ticket's portable proof receipt
//   verify-receipt <file.json>         re-verify a receipt (no token, no keypair)

import { PublicKey } from "@solana/web3.js";
import { BN } from "@coral-xyz/anchor";
import { USDT_MINT_DEVNET } from "@truebook/shared";
import { buildProgram, getConnection, loadKeeperKeypair } from "./env.js";
import { fundHouseVault } from "./fund.js";
import { listBoard } from "./list.js";
import { exportTicketReceipt } from "./receipt.js";
import { verifyTicketReceipt } from "./verifyReceipt.js";
import { acquireTxlineAuth } from "./txlineAuth.js";
import {
  DEFAULT_RIG_FACTOR,
  auditCashOutWithProof,
  auditTicketWithProof,
  cashOutFromKeeper,
  createMarketsForFixtures,
  lockDueMarkets,
  placeBetFromKeeper,
  postQuotes,
  postRiggedQuote,
  refundTicketToBettor,
  serveBoard,
  verifyAndSettleMarket,
} from "./jobs.js";

// Default house margin in basis points (2 percent), used at setup.
const DEFAULT_MARGIN_BPS_VALUE = 200;
// Default serve-loop refresh, comfortably inside the 120 s quote validity.
const DEFAULT_SERVE_INTERVAL_SECONDS = 60;

async function runSetup(): Promise<void> {
  const connection = getConnection();
  const keypair = loadKeeperKeypair();
  const program = buildProgram(connection, keypair);
  const usdtMint = new PublicKey(process.env.KEEPER_USDT_MINT ?? USDT_MINT_DEVNET.toBase58());

  await program.methods
    .initializeHouse(DEFAULT_MARGIN_BPS_VALUE, new BN(1_000_000_000_000), new BN(1_000_000_000_000))
    .accounts({ authority: keypair.publicKey, usdtMint })
    .rpc();
  console.log(`[runSetup] house initialized with mint ${usdtMint.toBase58()}`);
}

async function runTickOrSettle(command: string, marketArg: string | undefined): Promise<void> {
  const connection = getConnection();
  const keypair = loadKeeperKeypair();
  const program = buildProgram(connection, keypair);
  // The endpoint may carry an api-key query param (Helius); never log it.
  console.log(
    `[main] keeper ${keypair.publicKey.toBase58()} on ${connection.rpcEndpoint.split("?")[0]}`,
  );

  const authResult = await acquireTxlineAuth(connection, keypair);
  if (!authResult.ok) {
    console.error(`[main] TxLINE auth failed: ${authResult.reason}`);
    process.exit(1);
  }
  const auth = authResult.value;
  console.log("[main] TxLINE authenticated");

  if (command === "settle") {
    if (!marketArg) {
      console.error("[main] usage: settle <marketPubkey>");
      process.exit(1);
    }
    await verifyAndSettleMarket(program, auth, new PublicKey(marketArg));
    return;
  }

  if (command === "audit") {
    if (!marketArg) {
      console.error("[main] usage: audit <ticketPubkey>");
      process.exit(1);
    }
    await auditTicketWithProof(program, auth, new PublicKey(marketArg));
    return;
  }

  if (command === "audit-cashout") {
    if (!marketArg) {
      console.error("[main] usage: audit-cashout <receiptPubkey>");
      process.exit(1);
    }
    await auditCashOutWithProof(program, auth, new PublicKey(marketArg));
    return;
  }

  if (command === "export-receipt") {
    if (!marketArg) {
      console.error("[main] usage: export-receipt <ticketPubkey> [outFile]");
      process.exit(1);
    }
    const outFile = process.argv[4] ?? `../docs/receipts/${marketArg}.json`;
    const exported = await exportTicketReceipt(
      program,
      auth,
      new PublicKey(marketArg),
      outFile,
    );
    if (!exported) process.exit(1);
    return;
  }

  if (command === "serve") {
    const intervalArg = marketArg === undefined ? DEFAULT_SERVE_INTERVAL_SECONDS : Number(marketArg);
    if (!Number.isFinite(intervalArg) || intervalArg < 15) {
      console.error("[main] usage: serve [intervalSeconds >= 15]");
      process.exit(1);
    }
    await serveBoard(program, auth, intervalArg);
    return;
  }

  if (command === "rig") {
    if (!marketArg) {
      console.error("[main] usage: rig <marketPubkey> [factor]");
      process.exit(1);
    }
    const factorArg = process.argv[4];
    const rigFactor = factorArg ? Number(factorArg) : DEFAULT_RIG_FACTOR;
    if (!Number.isFinite(rigFactor) || rigFactor <= 1) {
      console.error("[main] rig factor must be a number greater than 1");
      process.exit(1);
    }
    await postRiggedQuote(program, auth, new PublicKey(marketArg), rigFactor);
    return;
  }

  const createdCount = await createMarketsForFixtures(program, auth);
  const lockedCount = await lockDueMarkets(program);
  const quotedCount = await postQuotes(program, auth);
  console.log(`[main] tick: +${createdCount} markets, ${lockedCount} locked, ${quotedCount} quoted`);
}

async function runFund(amountArg: string | undefined): Promise<void> {
  const connection = getConnection();
  const keypair = loadKeeperKeypair();
  const program = buildProgram(connection, keypair);
  let depositUiAmount: number | null = null;
  if (amountArg !== undefined) {
    depositUiAmount = Number(amountArg);
    if (!Number.isFinite(depositUiAmount) || depositUiAmount <= 0) {
      console.error("[runFund] usage: fund [amountUsdt > 0]");
      process.exit(1);
    }
  }
  await fundHouseVault(program, keypair, depositUiAmount);
}

async function main(): Promise<void> {
  const command = process.argv[2] ?? "tick";
  // verify-receipt needs neither a keypair nor a TxLINE token: the proofs
  // are embedded in the file and the chain checks are free simulations.
  if (command === "verify-receipt") {
    const receiptFileArg = process.argv[3];
    if (!receiptFileArg) {
      console.error("[main] usage: verify-receipt <receipt.json>");
      process.exit(1);
    }
    const receiptPassed = await verifyTicketReceipt(getConnection(), receiptFileArg);
    process.exit(receiptPassed ? 0 : 1);
  }
  if (command === "setup") {
    await runSetup();
    return;
  }
  if (command === "fund") {
    await runFund(process.argv[3]);
    return;
  }
  if (command === "list") {
    const connection = getConnection();
    const keypair = loadKeeperKeypair();
    await listBoard(buildProgram(connection, keypair));
    return;
  }
  // bet and refund talk only to Solana; no TxLINE auth needed.
  if (command === "bet") {
    const marketArg = process.argv[3];
    const sideArg = process.argv[4];
    const stakeArg = Number(process.argv[5]);
    if (!marketArg || (sideArg !== "yes" && sideArg !== "no") || !Number.isFinite(stakeArg) || stakeArg <= 0) {
      console.error("[main] usage: bet <marketPubkey> <yes|no> <stakeUsdt > 0>");
      process.exit(1);
    }
    const connection = getConnection();
    const keypair = loadKeeperKeypair();
    const program = buildProgram(connection, keypair);
    const betPlaced = await placeBetFromKeeper(program, keypair, new PublicKey(marketArg), sideArg, stakeArg);
    if (!betPlaced) process.exit(1);
    return;
  }
  if (command === "cashout") {
    const ticketArg = process.argv[3];
    if (!ticketArg) {
      console.error("[main] usage: cashout <ticketPubkey>");
      process.exit(1);
    }
    const connection = getConnection();
    const keypair = loadKeeperKeypair();
    const program = buildProgram(connection, keypair);
    const cashedOut = await cashOutFromKeeper(program, keypair, new PublicKey(ticketArg));
    if (!cashedOut) process.exit(1);
    return;
  }
  if (command === "refund") {
    const ticketArg = process.argv[3];
    if (!ticketArg) {
      console.error("[main] usage: refund <ticketPubkey>");
      process.exit(1);
    }
    const connection = getConnection();
    const keypair = loadKeeperKeypair();
    const program = buildProgram(connection, keypair);
    const refunded = await refundTicketToBettor(program, new PublicKey(ticketArg));
    if (!refunded) process.exit(1);
    return;
  }
  // tick, settle, rig, audit, audit-cashout, export-receipt, and serve
  // authenticate to TxLINE first.
  await runTickOrSettle(command, process.argv[3]);
}

main().catch((error: unknown) => {
  console.error("[main] fatal error:", error);
  process.exit(1);
});
