// TrueBook keeper entry point. Commands:
//   setup            initialize the house (one time, by the operator)
//   tick (default)   create markets, lock due ones, refresh quotes from TxLINE
//   settle <market>  prove a locked market's outcome and pay its tickets

import { PublicKey } from "@solana/web3.js";
import { BN } from "@coral-xyz/anchor";
import { USDT_MINT_DEVNET } from "@truebook/shared";
import { buildProgram, getConnection, loadKeeperKeypair } from "./env.js";

// Default house margin in basis points (2 percent), used at setup.
const DEFAULT_MARGIN_BPS_VALUE = 200;
import { acquireTxlineAuth } from "./txlineAuth.js";
import {
  createMarketsForFixtures,
  lockDueMarkets,
  postQuotes,
  verifyAndSettleMarket,
} from "./jobs.js";

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

  const createdCount = await createMarketsForFixtures(program, auth);
  const lockedCount = await lockDueMarkets(program);
  const quotedCount = await postQuotes(program, auth);
  console.log(`[main] tick: +${createdCount} markets, ${lockedCount} locked, ${quotedCount} quoted`);
}

async function main(): Promise<void> {
  const command = process.argv[2] ?? "tick";
  if (command === "setup") {
    await runSetup();
    return;
  }
  await runTickOrSettle(command, process.argv[3]);
}

main().catch((error: unknown) => {
  console.error("[main] fatal error:", error);
  process.exit(1);
});
