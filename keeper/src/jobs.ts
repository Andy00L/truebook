// Keeper jobs: keep the on-chain book in sync with the TxLINE feed.
//   createMarketsForFixtures  one home-win market per upcoming fixture
//   postQuotes                quote every open market from live StablePrice odds
//   lockDueMarkets            lock markets whose kickoff has passed
//   verifyAndSettleMarket     prove a locked market and pay its tickets

import { AnchorProvider, Program, BN } from "@coral-xyz/anchor";
import { ComputeBudgetProgram, PublicKey } from "@solana/web3.js";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";
import {
  type Truebook,
  type TxlineAuth,
  TXLINE_PROGRAM_ID,
  fixtureStartMs,
  getFixturesSnapshot,
  getOddsUpdates,
  getScoresSnapshot,
  getStatValidation,
} from "@truebook/shared";
import { dailyScoresRootPda } from "./pdas.js";
import { HOME_WIN, toMarketParams } from "./catalog.js";
import { houseQuoteFromConsensus, riggedQuoteFromConsensus } from "./pricing.js";
import { buildStatArgs } from "./proofArgs.js";

const CU_LIMIT = 1_400_000;

function keeperPubkey(program: Program<Truebook>): PublicKey {
  return (program.provider as AnchorProvider).wallet.publicKey;
}

async function fetchHouse(program: Program<Truebook>) {
  const house = new PublicKey(
    PublicKey.findProgramAddressSync([Buffer.from("house")], program.programId)[0],
  );
  const account = await program.account.house.fetchNullable(house);
  return account ? { house, account } : null;
}

export async function createMarketsForFixtures(
  program: Program<Truebook>,
  auth: TxlineAuth,
): Promise<number> {
  const houseInfo = await fetchHouse(program);
  if (!houseInfo) {
    console.log("[createMarketsForFixtures] house not initialized; run setup first");
    return 0;
  }
  const fixturesResult = await getFixturesSnapshot(auth);
  if (!fixturesResult.ok) {
    console.error(`[createMarketsForFixtures] ${fixturesResult.reason}`);
    return 0;
  }
  const nowMs = Date.now();
  const existingMarkets = await program.account.market.all();
  const existingFixtureIds = new Set(existingMarkets.map((entry) => entry.account.fixtureId.toString()));

  let createdCount = 0;
  for (const fixture of fixturesResult.value) {
    const startMs = fixtureStartMs(fixture.StartTime);
    if (startMs <= nowMs) continue;
    if (existingFixtureIds.has(fixture.FixtureId.toString())) continue;

    try {
      // Anchor resolves the market PDA from house.market_count at call time.
      await program.methods
        .createMarket(
          new BN(fixture.FixtureId),
          toMarketParams(HOME_WIN),
          HOME_WIN.outcomePriceIndex,
          new BN(Math.floor(startMs / 1000)),
        )
        .accounts({ authority: keeperPubkey(program) })
        .rpc();
      createdCount += 1;
      console.log(`[createMarketsForFixtures] ${fixture.Participant1} vs ${fixture.Participant2} (home win)`);
    } catch (createError) {
      console.error(`[createMarketsForFixtures] fixture ${fixture.FixtureId}: ${String(createError)}`);
    }
  }
  return createdCount;
}

export async function postQuotes(program: Program<Truebook>, auth: TxlineAuth): Promise<number> {
  const houseInfo = await fetchHouse(program);
  if (!houseInfo) return 0;
  const marginBps = houseInfo.account.marginBps;
  const markets = await program.account.market.all();

  let quotedCount = 0;
  for (const { publicKey: marketKey, account } of markets) {
    if (!("open" in account.state)) continue;
    const oddsResult = await getOddsUpdates(auth, account.fixtureId.toNumber());
    if (!oddsResult.ok) continue;
    const record = oddsResult.value.find((entry) => entry.SuperOddsType === HOME_WIN.superOddsType);
    const rawYesPrice = record?.Prices[HOME_WIN.outcomePriceIndex];
    if (!record || rawYesPrice === undefined || rawYesPrice <= 0) continue;

    const quote = houseQuoteFromConsensus(rawYesPrice, marginBps);
    try {
      await program.methods
        .postQuote(quote.yesOddsBps, quote.noOddsBps, record.MessageId, new BN(record.Ts))
        .accounts({ keeper: keeperPubkey(program), market: marketKey })
        .rpc();
      quotedCount += 1;
    } catch (quoteError) {
      console.error(`[postQuotes] ${marketKey.toBase58()}: ${String(quoteError)}`);
    }
  }
  return quotedCount;
}

// The sting: post one deliberately overcharged quote on a sacrificial market so
// the audit path can be shown catching a dishonest price. The YES side stays fair;
// the NO side is priced past the margin by rigFactor. Returns the market key on success.
export async function postRiggedQuote(
  program: Program<Truebook>,
  auth: TxlineAuth,
  marketKey: PublicKey,
  rigFactor: number,
): Promise<boolean> {
  const houseInfo = await fetchHouse(program);
  if (!houseInfo) return false;
  const market = await program.account.market.fetch(marketKey);
  if (!("open" in market.state)) {
    console.log(`[postRiggedQuote] ${marketKey.toBase58()} is not open`);
    return false;
  }
  const oddsResult = await getOddsUpdates(auth, market.fixtureId.toNumber());
  if (!oddsResult.ok) {
    console.error(`[postRiggedQuote] ${oddsResult.reason}`);
    return false;
  }
  const record = oddsResult.value.find((entry) => entry.SuperOddsType === HOME_WIN.superOddsType);
  const rawYesPrice = record?.Prices[HOME_WIN.outcomePriceIndex];
  if (!record || rawYesPrice === undefined || rawYesPrice <= 0) {
    console.error(`[postRiggedQuote] no ${HOME_WIN.superOddsType} price for fixture ${market.fixtureId.toString()}`);
    return false;
  }

  const quote = riggedQuoteFromConsensus(rawYesPrice, houseInfo.account.marginBps, rigFactor);
  await program.methods
    .postQuote(quote.yesOddsBps, quote.noOddsBps, record.MessageId, new BN(record.Ts))
    .accounts({ keeper: keeperPubkey(program), market: marketKey })
    .rpc();
  console.log(
    `[postRiggedQuote] rigged NO on ${marketKey.toBase58()}: yes=${quote.yesOddsBps} no=${quote.noOddsBps} (factor ${rigFactor})`,
  );
  return true;
}

export async function lockDueMarkets(program: Program<Truebook>): Promise<number> {
  const nowSeconds = Math.floor(Date.now() / 1000);
  const markets = await program.account.market.all();
  let lockedCount = 0;
  for (const { publicKey: marketKey, account } of markets) {
    if (!("open" in account.state)) continue;
    if (account.kickoffTs.toNumber() > nowSeconds) continue;
    try {
      await program.methods
        .lockMarket()
        .accounts({ cranker: keeperPubkey(program), market: marketKey })
        .rpc();
      lockedCount += 1;
    } catch (lockError) {
      console.error(`[lockDueMarkets] ${marketKey.toBase58()}: ${String(lockError)}`);
    }
  }
  return lockedCount;
}

// Prove a locked market's outcome and settle every live ticket on it.
export async function verifyAndSettleMarket(
  program: Program<Truebook>,
  auth: TxlineAuth,
  marketKey: PublicKey,
): Promise<boolean> {
  const houseInfo = await fetchHouse(program);
  if (!houseInfo) return false;
  const market = await program.account.market.fetch(marketKey);
  if (!("locked" in market.state)) {
    console.log(`[verifyAndSettleMarket] ${marketKey.toBase58()} is not locked`);
    return false;
  }
  const fixtureId = market.fixtureId.toNumber();

  const snapshotResult = await getScoresSnapshot(auth, fixtureId);
  if (!snapshotResult.ok) {
    console.error(`[verifyAndSettleMarket] ${snapshotResult.reason}`);
    return false;
  }
  const seqNumbers = snapshotResult.value
    .map((row) => row.Seq)
    .filter((value) => Number.isFinite(value));
  if (seqNumbers.length === 0) {
    console.error(`[verifyAndSettleMarket] no score updates for fixture ${fixtureId}`);
    return false;
  }
  const latestSeq = Math.max(...seqNumbers);

  const proofResult = await getStatValidation(auth, {
    fixtureId,
    seq: latestSeq,
    statKey: HOME_WIN.proofStatKeys[0],
    statKey2: HOME_WIN.proofStatKeys[1],
  });
  if (!proofResult.ok) {
    console.error(`[verifyAndSettleMarket] ${proofResult.reason}`);
    return false;
  }

  const statArgs = buildStatArgs(proofResult.value, HOME_WIN);
  const scoresRoot = dailyScoresRootPda(
    TXLINE_PROGRAM_ID,
    proofResult.value.summary.updateStats.minTimestamp,
  );

  // Anchor resolves verified_outcome (PDA of [outcome, market]) and the address-pinned
  // txoracle program; only the specific daily-root account must be supplied.
  await program.methods
    .verifyMarket(statArgs, latestSeq)
    .accounts({
      cranker: keeperPubkey(program),
      market: marketKey,
      dailyScoresMerkleRoots: scoresRoot,
    })
    .preInstructions([ComputeBudgetProgram.setComputeUnitLimit({ units: CU_LIMIT })])
    .rpc();
  console.log(`[verifyAndSettleMarket] verified ${marketKey.toBase58()}`);

  // Settle every live ticket that references this market (ticket.market at offset 8).
  const tickets = await program.account.ticket.all([
    { memcmp: { offset: 8, bytes: marketKey.toBase58() } },
  ]);
  let settledCount = 0;
  for (const { publicKey: ticketKey, account } of tickets) {
    if (!("live" in account.state)) continue;
    const bettorTokenAccount = getAssociatedTokenAddressSync(houseInfo.account.usdtMint, account.bettor);
    try {
      await program.methods
        .settleTicket()
        .accounts({
          cranker: keeperPubkey(program),
          market: marketKey,
          ticket: ticketKey,
          vault: houseInfo.account.vault,
          bettorTokenAccount,
        })
        .rpc();
      settledCount += 1;
    } catch (settleError) {
      console.error(`[verifyAndSettleMarket] ticket ${ticketKey.toBase58()}: ${String(settleError)}`);
    }
  }
  console.log(`[verifyAndSettleMarket] settled ${settledCount} ticket(s)`);
  return true;
}
