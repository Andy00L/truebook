// Keeper jobs: keep the on-chain book in sync with the TxLINE feed.
//   createMarketsForFixtures  the full pre-match catalog per upcoming fixture
//   postQuotes                quote every open market from live StablePrice odds
//   lockDueMarkets            lock markets whose betting deadline has passed
//   maintainInPlayMarkets     open micro-window totals lines during live games
//   settleFinishedFixtures    prove and pay every locked market of ended games
//   verifyAndSettleMarket     prove a locked market and pay its tickets
//   placeBetFromKeeper        ops bet from the keeper wallet (sting rehearsal)
//   cashOutFromKeeper         ops cash-out of a keeper ticket (rehearsal)
//   auditTicketWithProof      prove a ticket's served price against consensus
//   auditCashOutWithProof     prove a cash-out's price against consensus
//   refundTicketToBettor      refund a refundable ticket's stake
//   serveBoard                loop: markets + quotes + in-play + settle + re-rig

import { AnchorProvider, Program, BN } from "@coral-xyz/anchor";
import { ComputeBudgetProgram, Keypair, PublicKey } from "@solana/web3.js";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";
import { randomBytes } from "node:crypto";
import { setTimeout as sleepMs } from "node:timers/promises";
import {
  type MarketBlueprint,
  type MarketDescriptor,
  type NormalizedMarketParams,
  type ScoresSnapshotRow,
  type Truebook,
  type TxlineAuth,
  PREMATCH_CATALOG,
  TXLINE_PROGRAM_ID,
  describeMarketParams,
  fixtureStartMs,
  getFixturesSnapshot,
  getOddsUpdates,
  getOddsValidation,
  getScoresSnapshot,
  getStatValidation,
  inPlayTotalsBlueprint,
  normalizeMarketParams,
  pickConsensusRecord,
  toAnchorMarketParams,
} from "@truebook/shared";
import { cashOutReceiptPda, dailyOddsRootPda, dailyScoresRootPda, ticketPda } from "./pdas.js";
import { requestFaucetUsdt, readUsdtBalance } from "./fund.js";
import { houseQuoteFromConsensus, riggedQuoteFromConsensus } from "./pricing.js";
import { buildOddsArgs, buildStatArgs } from "./proofArgs.js";

const CU_LIMIT = 1_400_000;
// sourceRef: mint ELWTKspH... on devnet (classic SPL token, 6 decimals).
const USDT_DECIMAL_FACTOR = 1_000_000;
// Default NO overcharge for the sting: 1.5x the fair NO probability.
export const DEFAULT_RIG_FACTOR = 1.5;
// A live in-play line accepts bets for this long before it locks (seconds).
const IN_PLAY_WINDOW_SECONDS = 600;
// A fixture can still be in play this long after kickoff (90' + stoppage).
const IN_PLAY_MAX_SECONDS = 105 * 60;
// Auto-settle heuristic: the fixture is past full time AND the score feed has
// been quiet this long. GameState in the snapshot rows is unreliable (a
// mid-match capture still said "scheduled"), so silence is the whistle.
const FEED_QUIET_SECONDS = 10 * 60;

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

type OnChainMarket = Awaited<ReturnType<Program<Truebook>["account"]["market"]["all"]>>[number];

// The catalog descriptor of an on-chain market, or null for a predicate that
// predates the mapping (none exist on devnet, but stay defensive).
function describeOnChainMarket(market: OnChainMarket): {
  params: NormalizedMarketParams;
  descriptor: MarketDescriptor;
} | null {
  const params = normalizeMarketParams(market.account.params);
  const descriptor = describeMarketParams(params);
  return descriptor === null ? null : { params, descriptor };
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
  const existingCatalogKeys = new Set(
    existingMarkets
      .map((market) => {
        const described = describeOnChainMarket(market);
        return described === null
          ? null
          : `${market.account.fixtureId.toString()}:${described.descriptor.key}`;
      })
      .filter((catalogKey): catalogKey is string => catalogKey !== null),
  );

  let createdCount = 0;
  for (const fixture of fixturesResult.value) {
    const startMs = fixtureStartMs(fixture.StartTime);
    if (startMs <= nowMs) continue;

    for (const blueprint of PREMATCH_CATALOG) {
      const catalogKey = `${fixture.FixtureId}:${blueprint.descriptor.key}`;
      if (existingCatalogKeys.has(catalogKey)) continue;
      try {
        // Anchor resolves the market PDA from house.market_count at call time.
        await program.methods
          .createMarket(
            new BN(fixture.FixtureId),
            toAnchorMarketParams(blueprint.params),
            blueprint.descriptor.yesPriceIndex,
            new BN(Math.floor(startMs / 1000)),
          )
          .accounts({ authority: keeperPubkey(program) })
          .rpc();
        createdCount += 1;
        existingCatalogKeys.add(catalogKey);
        console.log(
          `[createMarketsForFixtures] ${fixture.Participant1} vs ${fixture.Participant2} (${blueprint.descriptor.name})`,
        );
      } catch (createError) {
        console.error(
          `[createMarketsForFixtures] fixture ${fixture.FixtureId} ${blueprint.descriptor.key}: ${String(createError)}`,
        );
      }
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

  // One odds fetch per fixture, shared by every market of that fixture.
  const oddsByFixture = new Map<string, Awaited<ReturnType<typeof getOddsUpdates>>>();

  let quotedCount = 0;
  for (const market of markets) {
    const { publicKey: marketKey, account } = market;
    if (!("open" in account.state)) continue;
    if (skippedMarkets.has(marketKey.toBase58())) {
      console.log(`[postQuotes] skipping rigged market ${marketKey.toBase58()}`);
      continue;
    }
    const described = describeOnChainMarket(market);
    if (described === null) {
      console.error(`[postQuotes] ${marketKey.toBase58()} has an unmapped predicate; skipping`);
      continue;
    }
    const fixtureKey = account.fixtureId.toString();
    let oddsResult = oddsByFixture.get(fixtureKey);
    if (oddsResult === undefined) {
      oddsResult = await getOddsUpdates(auth, account.fixtureId.toNumber());
      oddsByFixture.set(fixtureKey, oddsResult);
    }
    if (!oddsResult.ok) continue;
    const record = pickConsensusRecord(oddsResult.value, described.descriptor);
    if (record === null) continue;
    const rawYesPrice = record.Prices[described.descriptor.yesPriceIndex];
    if (rawYesPrice === undefined || rawYesPrice <= 0) continue;

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
// the NO side is priced past the margin by rigFactor. Returns true on success.
export async function postRiggedQuote(
  program: Program<Truebook>,
  auth: TxlineAuth,
  marketKey: PublicKey,
  rigFactor: number,
): Promise<boolean> {
  const houseInfo = await fetchHouse(program);
  if (!houseInfo) return false;
  const marketAccount = await program.account.market.fetch(marketKey);
  if (!("open" in marketAccount.state)) {
    console.log(`[postRiggedQuote] ${marketKey.toBase58()} is not open`);
    return false;
  }
  const described = describeOnChainMarket({
    publicKey: marketKey,
    account: marketAccount,
  } as OnChainMarket);
  if (described === null) {
    console.error(`[postRiggedQuote] ${marketKey.toBase58()} has an unmapped predicate`);
    return false;
  }
  const oddsResult = await getOddsUpdates(auth, marketAccount.fixtureId.toNumber());
  if (!oddsResult.ok) {
    console.error(`[postRiggedQuote] ${oddsResult.reason}`);
    return false;
  }
  const record = pickConsensusRecord(oddsResult.value, described.descriptor);
  const rawYesPrice = record?.Prices[described.descriptor.yesPriceIndex];
  if (!record || rawYesPrice === undefined || rawYesPrice <= 0) {
    console.error(
      `[postRiggedQuote] no ${described.descriptor.superOddsType} price for fixture ${marketAccount.fixtureId.toString()}`,
    );
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

// The latest score row of a fixture, or null when the feed has none yet.
function latestScoreRow(rows: ScoresSnapshotRow[]): ScoresSnapshotRow | null {
  let latest: ScoresSnapshotRow | null = null;
  for (const row of rows) {
    if (latest === null || row.Seq > latest.Seq) {
      latest = row;
    }
  }
  return latest;
}

// Current total goals from a score row's Stats map (keys "1" and "2" are the
// participants' Total-period goals; sourceRef .scratch/snapshot-18172379.json).
function totalGoalsFromRow(row: ScoresSnapshotRow): number | null {
  const stats = row.Stats;
  if (stats === null || typeof stats !== "object") return null;
  const statsMap = stats as Record<string, unknown>;
  const participant1Goals = statsMap["1"];
  const participant2Goals = statsMap["2"];
  if (typeof participant1Goals !== "number" || typeof participant2Goals !== "number") {
    return null;
  }
  return participant1Goals + participant2Goals;
}

/**
 * In-play micro-windows: for every fixture currently in play, keep one live
 * totals line open over the current score ("more goals than now?"), with a
 * short betting window (kickoff_ts = window close). Quotes then come from the
 * in-running Over/Under consensus records on the next postQuotes pass, and
 * settlement rides the normal full-time proof path.
 */
export async function maintainInPlayMarkets(
  program: Program<Truebook>,
  auth: TxlineAuth,
): Promise<number> {
  const houseInfo = await fetchHouse(program);
  if (!houseInfo) return 0;
  const fixturesResult = await getFixturesSnapshot(auth);
  if (!fixturesResult.ok) {
    console.error(`[maintainInPlayMarkets] ${fixturesResult.reason}`);
    return 0;
  }
  const nowMs = Date.now();
  const inPlayFixtures = fixturesResult.value.filter((fixture) => {
    const startMs = fixtureStartMs(fixture.StartTime);
    return startMs <= nowMs && nowMs <= startMs + IN_PLAY_MAX_SECONDS * 1000;
  });
  if (inPlayFixtures.length === 0) return 0;

  const markets = await program.account.market.all();
  let createdCount = 0;
  for (const fixture of inPlayFixtures) {
    const scoresResult = await getScoresSnapshot(auth, fixture.FixtureId);
    if (!scoresResult.ok) {
      console.error(`[maintainInPlayMarkets] fixture ${fixture.FixtureId}: ${scoresResult.reason}`);
      continue;
    }
    const latestRow = latestScoreRow(scoresResult.value);
    if (latestRow === null) continue;
    const totalGoals = totalGoalsFromRow(latestRow);
    if (totalGoals === null) continue;

    const blueprint: MarketBlueprint = inPlayTotalsBlueprint(totalGoals);
    const lineAlreadyOpen = markets.some((market) => {
      if (!("open" in market.account.state)) return false;
      if (market.account.fixtureId.toString() !== fixture.FixtureId.toString()) return false;
      const described = describeOnChainMarket(market);
      return described !== null && described.descriptor.key === blueprint.descriptor.key;
    });
    if (lineAlreadyOpen) continue;

    try {
      const windowCloseSeconds = Math.floor(nowMs / 1000) + IN_PLAY_WINDOW_SECONDS;
      await program.methods
        .createMarket(
          new BN(fixture.FixtureId),
          toAnchorMarketParams(blueprint.params),
          blueprint.descriptor.yesPriceIndex,
          new BN(windowCloseSeconds),
        )
        .accounts({ authority: keeperPubkey(program) })
        .rpc();
      createdCount += 1;
      console.log(
        `[maintainInPlayMarkets] ${fixture.Participant1} vs ${fixture.Participant2}: opened ${blueprint.descriptor.name} (window ${IN_PLAY_WINDOW_SECONDS / 60} min, ${totalGoals} goals so far)`,
      );
    } catch (createError) {
      console.error(
        `[maintainInPlayMarkets] fixture ${fixture.FixtureId}: ${String(createError)}`,
      );
    }
  }
  return createdCount;
}

/**
 * Auto-settlement: prove and pay every locked market of fixtures that look
 * finished. The feed's GameState is unreliable, so "finished" means the
 * earliest market deadline (the real kickoff) is past full time AND the score
 * feed has been quiet for FEED_QUIET_SECONDS. The proof walk in
 * verifyAndSettleMarket keeps a premature attempt from settling on a
 * non-final period encoding.
 */
export async function settleFinishedFixtures(
  program: Program<Truebook>,
  auth: TxlineAuth,
): Promise<number> {
  const markets = await program.account.market.all();
  const lockedMarkets = markets.filter((market) => "locked" in market.account.state);
  if (lockedMarkets.length === 0) return 0;

  // The real kickoff of a fixture is the earliest betting deadline among its
  // markets (in-play windows close later than the pre-match markets).
  const kickoffByFixture = new Map<string, number>();
  for (const market of markets) {
    const fixtureKey = market.account.fixtureId.toString();
    const kickoffSeconds = market.account.kickoffTs.toNumber();
    const knownKickoff = kickoffByFixture.get(fixtureKey);
    if (knownKickoff === undefined || kickoffSeconds < knownKickoff) {
      kickoffByFixture.set(fixtureKey, kickoffSeconds);
    }
  }

  const nowMs = Date.now();
  const finishedFixtures = new Map<string, number>();
  for (const market of lockedMarkets) {
    const fixtureKey = market.account.fixtureId.toString();
    if (finishedFixtures.has(fixtureKey)) continue;
    const kickoffSeconds = kickoffByFixture.get(fixtureKey);
    if (kickoffSeconds === undefined) continue;
    if (nowMs < (kickoffSeconds + IN_PLAY_MAX_SECONDS) * 1000) continue;

    const scoresResult = await getScoresSnapshot(auth, market.account.fixtureId.toNumber());
    if (!scoresResult.ok) continue;
    const latestRow = latestScoreRow(scoresResult.value);
    if (latestRow === null) continue;
    if (nowMs - latestRow.Ts < FEED_QUIET_SECONDS * 1000) continue;
    finishedFixtures.set(fixtureKey, latestRow.Ts);
  }

  let settledMarketCount = 0;
  for (const market of lockedMarkets) {
    const lastScoreTs = finishedFixtures.get(market.account.fixtureId.toString());
    if (lastScoreTs === undefined) continue;
    const settled = await verifyAndSettleMarket(program, auth, market.publicKey, lastScoreTs);
    if (settled) settledMarketCount += 1;
  }
  return settledMarketCount;
}

// Prove a locked market's outcome and settle every live ticket on it. The
// optional lastScoreTs feeds the settlement stopwatch log.
export async function verifyAndSettleMarket(
  program: Program<Truebook>,
  auth: TxlineAuth,
  marketKey: PublicKey,
  lastScoreTs?: number,
): Promise<boolean> {
  const stopwatchStartMs = Date.now();
  const houseInfo = await fetchHouse(program);
  if (!houseInfo) return false;
  const marketAccount = await program.account.market.fetch(marketKey);
  if (!("locked" in marketAccount.state)) {
    console.log(`[verifyAndSettleMarket] ${marketKey.toBase58()} is not locked`);
    return false;
  }
  const described = describeOnChainMarket({
    publicKey: marketKey,
    account: marketAccount,
  } as OnChainMarket);
  if (described === null) {
    console.error(`[verifyAndSettleMarket] ${marketKey.toBase58()} has an unmapped predicate`);
    return false;
  }
  const { params, descriptor } = described;
  const fixtureId = marketAccount.fixtureId.toNumber();

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
      statKey: descriptor.proofStatKeys[0],
      statKey2: params.hasStatB ? descriptor.proofStatKeys[1] : undefined,
    });
    if (!proofResult.ok) {
      console.error(`[verifyAndSettleMarket] seq ${candidateSeq}: ${proofResult.reason}`);
      continue;
    }
    const provenStat = proofResult.value.statToProve;
    const provenStatB = proofResult.value.statToProve2;
    const matchesPredicate =
      provenStat.key === params.statAKey &&
      provenStat.period === params.statAPeriod &&
      (!params.hasStatB ||
        (provenStatB !== undefined &&
          provenStatB.key === params.statBKey &&
          provenStatB.period === params.statBPeriod));
    if (matchesPredicate) {
      matchingProof = proofResult;
      matchingSeq = candidateSeq;
      break;
    }
    console.log(
      `[verifyAndSettleMarket] seq ${candidateSeq} proof (key ${provenStat.key}, period ${provenStat.period}) does not match the committed predicate, trying earlier seq`,
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

  const statArgs = buildStatArgs(proofResult.value, params);
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
  console.log(
    `[verifyAndSettleMarket] verified ${descriptor.name} ${marketKey.toBase58()} at seq ${latestSeq}, tx ${verifySignature}`,
  );

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
  // The settlement stopwatch: proof fetch to paid tickets, and (when known)
  // the distance from the feed's final score update. This is the demo number.
  const elapsedSeconds = ((Date.now() - stopwatchStartMs) / 1000).toFixed(1);
  const sinceWhistle =
    lastScoreTs === undefined
      ? ""
      : `, ${((Date.now() - lastScoreTs) / 1000).toFixed(1)}s after the feed's last score update`;
  console.log(
    `[verifyAndSettleMarket] settled ${settledCount} ticket(s) in ${elapsedSeconds}s end-to-end${sinceWhistle}`,
  );
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

// Ops cash-out of a keeper-owned live ticket: rehearses the provable cash-out
// loop (bet, cash out at the current quote, audit the receipt) end to end.
export async function cashOutFromKeeper(
  program: Program<Truebook>,
  keypair: Keypair,
  ticketKey: PublicKey,
): Promise<boolean> {
  const houseInfo = await fetchHouse(program);
  if (!houseInfo) {
    console.error("[cashOutFromKeeper] house not initialized");
    return false;
  }
  const ticket = await program.account.ticket.fetch(ticketKey);
  if (!ticket.bettor.equals(keypair.publicKey)) {
    console.error("[cashOutFromKeeper] the keeper wallet does not own this ticket");
    return false;
  }
  const bettorTokenAccount = getAssociatedTokenAddressSync(
    houseInfo.account.usdtMint,
    keypair.publicKey,
  );

  const signature = await program.methods
    .cashOutTicket()
    .accounts({
      bettor: keypair.publicKey,
      market: ticket.market,
      ticket: ticketKey,
      vault: houseInfo.account.vault,
      bettorTokenAccount,
    })
    .rpc();

  const receiptKey = cashOutReceiptPda(program.programId, ticketKey);
  const receipt = await program.account.cashOutReceipt.fetch(receiptKey);
  console.log(`[cashOutFromKeeper] cashed out, tx ${signature}`);
  console.log(
    `[cashOutFromKeeper] receipt ${receiptKey.toBase58()} paid=${(
      receipt.paidAmount.toNumber() / USDT_DECIMAL_FACTOR
    ).toFixed(2)} USDT from quote ${receipt.oddsMessageId}`,
  );
  return true;
}

// Prove a ticket's served price against the anchored TxLINE consensus record.
// Permissionless: fetches the odds validation for the exact record the ticket
// referenced, CPIs validate_odds, and prints the audit verdict. A proven
// violation pays the audit-to-earn bounty to the keeper's own USDT account.
export async function auditTicketWithProof(
  program: Program<Truebook>,
  auth: TxlineAuth,
  ticketKey: PublicKey,
): Promise<boolean> {
  const houseInfo = await fetchHouse(program);
  if (!houseInfo) {
    console.error("[auditTicketWithProof] house not initialized");
    return false;
  }
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
  const auditorTokenAccount = getAssociatedTokenAddressSync(
    houseInfo.account.usdtMint,
    (program.provider as AnchorProvider).wallet.publicKey,
  );

  // Anchor resolves house (const seed) and the address-pinned txoracle program.
  const signature = await program.methods
    .auditTicket(oddsArgs)
    .accounts({
      cranker: (program.provider as AnchorProvider).wallet.publicKey,
      market: ticket.market,
      ticket: ticketKey,
      vault: houseInfo.account.vault,
      auditorTokenAccount,
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

// Prove a cash-out's price against consensus: validates the exact quote the
// receipt references. On a proven violation, the follow-up claim transaction
// repays the bettor the shortfall and pays the auditor the bounty.
export async function auditCashOutWithProof(
  program: Program<Truebook>,
  auth: TxlineAuth,
  receiptKey: PublicKey,
): Promise<boolean> {
  const houseInfo = await fetchHouse(program);
  if (!houseInfo) {
    console.error("[auditCashOutWithProof] house not initialized");
    return false;
  }
  const receipt = await program.account.cashOutReceipt.fetch(receiptKey);
  const validationResult = await getOddsValidation(
    auth,
    receipt.oddsMessageId,
    receipt.oddsTs.toNumber(),
  );
  if (!validationResult.ok) {
    console.error(`[auditCashOutWithProof] ${validationResult.reason}`);
    return false;
  }
  const oddsArgs = buildOddsArgs(validationResult.value);
  const dailyOddsRoots = dailyOddsRootPda(
    TXLINE_PROGRAM_ID,
    validationResult.value.odds.Ts,
  );

  // Anchor resolves cash_out_receipt (PDA of [cashout, ticket]), house, and
  // the address-pinned txoracle program.
  const auditSignature = await program.methods
    .auditCashOut(oddsArgs)
    .accounts({
      cranker: (program.provider as AnchorProvider).wallet.publicKey,
      market: receipt.market,
      ticket: receipt.ticket,
      dailyOddsMerkleRoots: dailyOddsRoots,
    })
    .preInstructions([ComputeBudgetProgram.setComputeUnitLimit({ units: CU_LIMIT })])
    .rpc();

  const auditedReceipt = await program.account.cashOutReceipt.fetch(receiptKey);
  const auditStatus = Object.keys(auditedReceipt.auditStatus)[0];
  console.log(`[auditCashOutWithProof] audited, tx ${auditSignature}`);
  console.log(
    `[auditCashOutWithProof] verdict: auditStatus=${auditStatus} shortfallOwed=${(
      auditedReceipt.shortfallOwed.toNumber() / USDT_DECIMAL_FACTOR
    ).toFixed(2)} USDT`,
  );

  if (auditStatus !== "violation" || auditedReceipt.madeWhole) {
    return true;
  }
  const bettorTokenAccount = getAssociatedTokenAddressSync(
    houseInfo.account.usdtMint,
    auditedReceipt.bettor,
  );
  const auditorTokenAccount = getAssociatedTokenAddressSync(
    houseInfo.account.usdtMint,
    auditedReceipt.auditor,
  );
  const claimSignature = await program.methods
    .claimCashOutRepair()
    .accounts({
      cranker: (program.provider as AnchorProvider).wallet.publicKey,
      ticket: receipt.ticket,
      vault: houseInfo.account.vault,
      bettorTokenAccount,
      auditorTokenAccount,
    })
    .rpc();
  console.log(
    `[auditCashOutWithProof] shortfall and bounty paid, tx ${claimSignature}`,
  );
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
// two minutes later. Each cycle: new pre-match markets, locks, in-play
// windows, fresh quotes, auto-settlement of finished fixtures, and a re-rig
// of every market listed in KEEPER_RIG_SKIP (the same set postQuotes skips).
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
      const inPlayCount = await maintainInPlayMarkets(program, auth);
      const quotedCount = await postQuotes(program, auth);
      const settledCount = await settleFinishedFixtures(program, auth);
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
        `[serveBoard] cycle ${cycleIndex}: +${createdCount} markets, +${inPlayCount} in-play, ${lockedCount} locked, ${quotedCount} quoted, ${settledCount} settled, ${riggedCount} re-rigged`,
      );
    } catch (cycleError) {
      // One failed cycle (RPC hiccup, feed gap) must not kill the loop.
      console.error(`[serveBoard] cycle ${cycleIndex} failed: ${String(cycleError)}`);
    }
    await sleepMs(intervalSeconds * 1000);
  }
}
