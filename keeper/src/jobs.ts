// Keeper jobs: keep the on-chain book in sync with the TxLINE feed.
//   createMarketsForFixtures  one home-win market per upcoming fixture
//   postQuotes                quote every open market from live StablePrice odds
//   lockDueMarkets            lock markets whose kickoff has passed
//   verifyAndSettleMarket     prove a locked market and pay its tickets
//   placeBetFromKeeper        ops bet from the keeper wallet (sting rehearsal)
//   auditTicketWithProof      prove a ticket's served price against consensus
//   refundTicketToBettor      refund a refundable ticket's stake
//   serveBoard                loop: lock + fresh quotes + re-rig, judges can bet

import { AnchorProvider, Program, BN } from "@coral-xyz/anchor";
import { ComputeBudgetProgram, Keypair, PublicKey } from "@solana/web3.js";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";
import { randomBytes } from "node:crypto";
import { setTimeout as sleepMs } from "node:timers/promises";
import {
  type Truebook,
  type TxlineAuth,
  TXLINE_PROGRAM_ID,
  fixtureStartMs,
  getFixturesSnapshot,
  getOddsUpdates,
  getOddsValidation,
  getScoresSnapshot,
  getStatValidation,
} from "@truebook/shared";
import { dailyOddsRootPda, dailyScoresRootPda, ticketPda } from "./pdas.js";
import { requestFaucetUsdt, readUsdtBalance } from "./fund.js";
import { HOME_WIN, toMarketParams } from "./catalog.js";
import { houseQuoteFromConsensus, riggedQuoteFromConsensus } from "./pricing.js";
import { buildOddsArgs, buildStatArgs } from "./proofArgs.js";

const CU_LIMIT = 1_400_000;
// sourceRef: mint ELWTKspH... on devnet (classic SPL token, 6 decimals).
const USDT_DECIMAL_FACTOR = 1_000_000;
// Default NO overcharge for the sting: 1.5x the fair NO probability.
export const DEFAULT_RIG_FACTOR = 1.5;

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

// Markets the tick must never re-quote, so a rigged sting quote survives
// until someone bets on it. Comma-separated pubkeys.
function riggedMarketsToSkip(): Set<string> {
  const rawList = process.env.KEEPER_RIG_SKIP ?? "";
  return new Set(
    rawList
      .split(",")
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0),
  );
}

export async function postQuotes(program: Program<Truebook>, auth: TxlineAuth): Promise<number> {
  const houseInfo = await fetchHouse(program);
  if (!houseInfo) return 0;
  const marginBps = houseInfo.account.marginBps;
  const markets = await program.account.market.all();
  const skippedMarkets = riggedMarketsToSkip();

  let quotedCount = 0;
  for (const { publicKey: marketKey, account } of markets) {
    if (!("open" in account.state)) continue;
    if (skippedMarkets.has(marketKey.toBase58())) {
      console.log(`[postQuotes] skipping rigged market ${marketKey.toBase58()}`);
      continue;
    }
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

  // Walk candidate seqs from the latest down: post-match rows can carry the
  // final values under a different period encoding (observed live: period 100
  // full-time confirmation vs the committed Total period 0), and verify_market
  // rightly rejects a proof whose period differs from the committed predicate.
  const descendingSeqs = [...new Set(seqNumbers)].sort(
    (firstSeq, secondSeq) => secondSeq - firstSeq,
  );
  const MAX_SEQ_ATTEMPTS = 12;
  let matchingProof: Awaited<ReturnType<typeof getStatValidation>> | null = null;
  let matchingSeq = 0;
  for (const candidateSeq of descendingSeqs.slice(0, MAX_SEQ_ATTEMPTS)) {
    const proofResult = await getStatValidation(auth, {
      fixtureId,
      seq: candidateSeq,
      statKey: HOME_WIN.proofStatKeys[0],
      statKey2: HOME_WIN.proofStatKeys[1],
    });
    if (!proofResult.ok) {
      console.error(`[verifyAndSettleMarket] seq ${candidateSeq}: ${proofResult.reason}`);
      continue;
    }
    const provenStat = proofResult.value.statToProve;
    const provenStatB = proofResult.value.statToProve2;
    const matchesPredicate =
      provenStat.key === HOME_WIN.statAKey &&
      provenStat.period === HOME_WIN.statAPeriod &&
      (!HOME_WIN.hasStatB ||
        (provenStatB !== undefined &&
          provenStatB.key === HOME_WIN.statBKey &&
          provenStatB.period === HOME_WIN.statBPeriod));
    if (matchesPredicate) {
      matchingProof = proofResult;
      matchingSeq = candidateSeq;
      break;
    }
    console.log(
      `[verifyAndSettleMarket] seq ${candidateSeq} proof period ${provenStat.period} does not match committed period ${HOME_WIN.statAPeriod}, trying earlier seq`,
    );
  }
  if (matchingProof === null || !matchingProof.ok) {
    console.error(
      `[verifyAndSettleMarket] no proof matching the committed predicate in the last ${MAX_SEQ_ATTEMPTS} updates`,
    );
    return false;
  }
  const latestSeq = matchingSeq;
  const proofResult = matchingProof;

  const statArgs = buildStatArgs(proofResult.value, HOME_WIN);
  const scoresRoot = dailyScoresRootPda(
    TXLINE_PROGRAM_ID,
    proofResult.value.summary.updateStats.minTimestamp,
  );

  // Anchor resolves verified_outcome (PDA of [outcome, market]) and the address-pinned
  // txoracle program; only the specific daily-root account must be supplied.
  const verifySignature = await program.methods
    .verifyMarket(statArgs, latestSeq)
    .accounts({
      cranker: keeperPubkey(program),
      market: marketKey,
      dailyScoresMerkleRoots: scoresRoot,
    })
    .preInstructions([ComputeBudgetProgram.setComputeUnitLimit({ units: CU_LIMIT })])
    .rpc();
  console.log(`[verifyAndSettleMarket] verified ${marketKey.toBase58()} at seq ${latestSeq}, tx ${verifySignature}`);

  // Settle every live ticket that references this market (ticket.market at offset 8).
  const tickets = await program.account.ticket.all([
    { memcmp: { offset: 8, bytes: marketKey.toBase58() } },
  ]);
  let settledCount = 0;
  for (const { publicKey: ticketKey, account } of tickets) {
    if (!("live" in account.state)) continue;
    const bettorTokenAccount = getAssociatedTokenAddressSync(houseInfo.account.usdtMint, account.bettor);
    try {
      const settleSignature = await program.methods
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
      console.log(`[verifyAndSettleMarket] settled ticket ${ticketKey.toBase58()}, tx ${settleSignature}`);
    } catch (settleError) {
      console.error(`[verifyAndSettleMarket] ticket ${ticketKey.toBase58()}: ${String(settleError)}`);
    }
  }
  console.log(`[verifyAndSettleMarket] settled ${settledCount} ticket(s)`);
  return true;
}

// Ops bet from the keeper wallet: rehearses the sting loop (rig, bet within
// the 120 s quote window, audit, refund) without a browser wallet. Draws from
// the TxLINE faucet when the wallet's USDT balance cannot cover the stake.
export async function placeBetFromKeeper(
  program: Program<Truebook>,
  keypair: Keypair,
  marketKey: PublicKey,
  side: "yes" | "no",
  stakeUiAmount: number,
): Promise<boolean> {
  const houseInfo = await fetchHouse(program);
  if (!houseInfo) {
    console.error("[placeBetFromKeeper] house not initialized");
    return false;
  }
  const provider = program.provider as AnchorProvider;
  const stakeRaw = BigInt(Math.round(stakeUiAmount * USDT_DECIMAL_FACTOR));

  const walletBalanceRaw = await readUsdtBalance(provider, keypair.publicKey);
  if (walletBalanceRaw < stakeRaw) {
    console.log("[placeBetFromKeeper] wallet USDT below stake, drawing from the faucet");
    const faucetResult = await requestFaucetUsdt(provider, keypair);
    if (!faucetResult.ok) {
      console.error(`[placeBetFromKeeper] ${faucetResult.reason}`);
      return false;
    }
    console.log(`[placeBetFromKeeper] faucet granted, tx ${faucetResult.value}`);
  }

  // Random u64 nonce with the top bit cleared, same scheme as the app.
  const nonceBytes = randomBytes(8);
  const nonceTopByte = nonceBytes[7] ?? 0;
  nonceBytes[7] = nonceTopByte & 0x7f;
  const nonce = new BN(nonceBytes, "le");
  const sideArg = side === "yes" ? { yes: {} } : { no: {} };
  const bettorTokenAccount = getAssociatedTokenAddressSync(
    houseInfo.account.usdtMint,
    keypair.publicKey,
  );

  const signature = await program.methods
    .placeBet(nonce, sideArg, new BN(stakeRaw.toString()))
    .accounts({
      bettor: keypair.publicKey,
      market: marketKey,
      vault: houseInfo.account.vault,
      bettorTokenAccount,
    })
    .rpc();
  const ticketKey = ticketPda(program.programId, marketKey, keypair.publicKey, nonce);
  console.log(`[placeBetFromKeeper] bet placed, tx ${signature}`);
  console.log(`[placeBetFromKeeper] ticket ${ticketKey.toBase58()} side=${side} stake=${stakeUiAmount} USDT`);
  return true;
}

// Prove a ticket's served price against the anchored TxLINE consensus record.
// Permissionless: fetches the odds validation for the exact record the ticket
// referenced, CPIs validate_odds, and prints the audit verdict.
export async function auditTicketWithProof(
  program: Program<Truebook>,
  auth: TxlineAuth,
  ticketKey: PublicKey,
): Promise<boolean> {
  const ticket = await program.account.ticket.fetch(ticketKey);
  const validationResult = await getOddsValidation(
    auth,
    ticket.oddsMessageId,
    ticket.oddsTs.toNumber(),
  );
  if (!validationResult.ok) {
    console.error(`[auditTicketWithProof] ${validationResult.reason}`);
    return false;
  }
  const oddsArgs = buildOddsArgs(validationResult.value);
  // Root day follows the args ts, which for validate_odds is the record's own
  // Ts (audit_ticket re-derives the PDA from args.ts and must find this one).
  const dailyOddsRoots = dailyOddsRootPda(
    TXLINE_PROGRAM_ID,
    validationResult.value.odds.Ts,
  );

  // Anchor resolves house (const seed) and the address-pinned txoracle program.
  const signature = await program.methods
    .auditTicket(oddsArgs)
    .accounts({
      cranker: (program.provider as AnchorProvider).wallet.publicKey,
      market: ticket.market,
      ticket: ticketKey,
      dailyOddsMerkleRoots: dailyOddsRoots,
    })
    .preInstructions([ComputeBudgetProgram.setComputeUnitLimit({ units: CU_LIMIT })])
    .rpc();

  const auditedTicket = await program.account.ticket.fetch(ticketKey);
  const auditStatus = Object.keys(auditedTicket.auditStatus)[0];
  const ticketState = Object.keys(auditedTicket.state)[0];
  console.log(`[auditTicketWithProof] audited, tx ${signature}`);
  console.log(`[auditTicketWithProof] verdict: auditStatus=${auditStatus} state=${ticketState}`);
  return true;
}

// Refund a refundable (or voided-market live) ticket's full stake to its bettor.
export async function refundTicketToBettor(
  program: Program<Truebook>,
  ticketKey: PublicKey,
): Promise<boolean> {
  const houseInfo = await fetchHouse(program);
  if (!houseInfo) {
    console.error("[refundTicketToBettor] house not initialized");
    return false;
  }
  const ticket = await program.account.ticket.fetch(ticketKey);
  const bettorTokenAccount = getAssociatedTokenAddressSync(
    houseInfo.account.usdtMint,
    ticket.bettor,
  );

  const signature = await program.methods
    .refundTicket()
    .accounts({
      cranker: (program.provider as AnchorProvider).wallet.publicKey,
      market: ticket.market,
      ticket: ticketKey,
      vault: houseInfo.account.vault,
      bettorTokenAccount,
    })
    .rpc();

  const refundedTicket = await program.account.ticket.fetch(ticketKey);
  const balance = await (program.provider as AnchorProvider).connection.getTokenAccountBalance(
    bettorTokenAccount,
  );
  console.log(`[refundTicketToBettor] refunded, tx ${signature}`);
  console.log(
    `[refundTicketToBettor] ticket state=${Object.keys(refundedTicket.state)[0]}, bettor balance ${balance.value.uiAmountString} USDT`,
  );
  return true;
}

// Keep the board alive so anyone can bet at any moment: place_bet rejects
// quotes older than 120 seconds, so a one-shot tick leaves the book unbettable
// two minutes later. Loops lock + fresh quotes + re-rig of every market listed
// in KEEPER_RIG_SKIP (the same set postQuotes skips), until Ctrl-C.
export async function serveBoard(
  program: Program<Truebook>,
  auth: TxlineAuth,
  intervalSeconds: number,
): Promise<void> {
  console.log(`[serveBoard] refreshing every ${intervalSeconds}s, Ctrl-C to stop`);
  let cycleIndex = 0;
  for (;;) {
    cycleIndex += 1;
    try {
      const createdCount = await createMarketsForFixtures(program, auth);
      const lockedCount = await lockDueMarkets(program);
      const quotedCount = await postQuotes(program, auth);
      let riggedCount = 0;
      for (const riggedMarket of riggedMarketsToSkip()) {
        const rigged = await postRiggedQuote(
          program,
          auth,
          new PublicKey(riggedMarket),
          DEFAULT_RIG_FACTOR,
        );
        if (rigged) riggedCount += 1;
      }
      console.log(
        `[serveBoard] cycle ${cycleIndex}: +${createdCount} markets, ${lockedCount} locked, ${quotedCount} quoted, ${riggedCount} re-rigged`,
      );
    } catch (cycleError) {
      // One failed cycle (RPC hiccup, feed gap) must not kill the loop.
      console.error(`[serveBoard] cycle ${cycleIndex} failed: ${String(cycleError)}`);
    }
    await sleepMs(intervalSeconds * 1000);
  }
}
