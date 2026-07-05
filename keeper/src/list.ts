// Read-only board listing: every market with its pubkey, state, quote, and
// kickoff, plus the house figures. Pure chain reads, no TxLINE auth, no fee.
// This is where the rig/settle commands get their <marketPubkey> argument.

import { PublicKey } from "@solana/web3.js";
import type { Program } from "@coral-xyz/anchor";
import type { Truebook } from "@truebook/shared";

// sourceRef: program odds convention, decimal odds in basis points (2.06 = 20600).
const ODDS_BPS_FACTOR = 10_000;
// sourceRef: USDT test mint on devnet, 6 decimals.
const USDT_DECIMAL_FACTOR = 1_000_000;

function marketStateLabel(state: object): string {
  return Object.keys(state)[0] ?? "unknown";
}

function formatOddsBps(oddsBps: number): string {
  return (oddsBps / ODDS_BPS_FACTOR).toFixed(2);
}

export async function listBoard(program: Program<Truebook>): Promise<void> {
  const house = PublicKey.findProgramAddressSync(
    [Buffer.from("house")],
    program.programId,
  )[0];
  const houseAccount = await program.account.house.fetchNullable(house);
  if (!houseAccount) {
    console.log("[listBoard] house not initialized; run setup first");
    return;
  }

  const vaultBalance = await program.provider.connection.getTokenAccountBalance(
    houseAccount.vault,
  );
  console.log(
    `[listBoard] house ${house.toBase58()} margin=${houseAccount.marginBps}bps ` +
      `vault=${vaultBalance.value.uiAmountString} USDT ` +
      `openExposure=${(houseAccount.openExposure.toNumber() / USDT_DECIMAL_FACTOR).toFixed(2)} USDT`,
  );

  const markets = await program.account.market.all();
  markets.sort((left, right) => left.account.marketId.cmp(right.account.marketId));
  console.log(`[listBoard] ${markets.length} market(s)`);

  for (const { publicKey: marketKey, account } of markets) {
    const kickoffIso = new Date(account.kickoffTs.toNumber() * 1000).toISOString();
    const hasQuote = account.quotePostedTs.toNumber() > 0;
    const quoteLabel = hasQuote
      ? `yes=${formatOddsBps(account.yesOddsBps)} no=${formatOddsBps(account.noOddsBps)}`
      : "no quote yet";
    console.log(
      `[listBoard] #${account.marketId.toString()} ${marketKey.toBase58()} ` +
        `fixture=${account.fixtureId.toString()} state=${marketStateLabel(account.state)} ` +
        `kickoff=${kickoffIso} ${quoteLabel}`,
    );
  }
}
