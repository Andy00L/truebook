// TrueBook keeper entry point. Commands:
//   setup                initialize the house (one time, by the operator)
//   fund [amount]        faucet test USDT then deposit into the house vault
//   list                 print house figures and every market with its pubkey
//   tick (default)       create markets, lock due ones, refresh quotes from TxLINE
//   settle <market>      prove a locked market's outcome and pay its tickets
//   rig <market> [factor] post one overcharged NO quote for the sting demo

import { PublicKey } from "@solana/web3.js";
import { BN } from "@coral-xyz/anchor";
import { USDT_MINT_DEVNET } from "@truebook/shared";
import { buildProgram, getConnection, loadKeeperKeypair } from "./env.js";
import { fundHouseVault } from "./fund.js";
import { listBoard } from "./list.js";
import { acquireTxlineAuth } from "./txlineAuth.js";
import {
  createMarketsForFixtures,
  lockDueMarkets,
  postQuotes,
  postRiggedQuote,
  verifyAndSettleMarket,
} from "./jobs.js";

// Default house margin in basis points (2 percent), used at setup.
const DEFAULT_MARGIN_BPS_VALUE = 200;
// Default NO overcharge for the sting: 1.5x the fair NO probability, far past margin.
const DEFAULT_RIG_FACTOR = 1.5;

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
  console.log(`[main] keeper ${keypair.publicKey.toBase58()} on ${connection.rpcEndpoint}`);

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
  // tick, settle, and rig all authenticate to TxLINE first.
  await runTickOrSettle(command, process.argv[3]);
}

main().catch((error: unknown) => {
  console.error("[main] fatal error:", error);
  process.exit(1);
});
