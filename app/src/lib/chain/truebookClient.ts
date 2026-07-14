/**
 * Read-only devnet client for the deployed TrueBook program. Maps on-chain
 * House, Market, and Ticket accounts onto the same view shapes the demo
 * provider fills, so the screens do not change when the source does. Markets
 * are grouped per fixture: one MatchView carries the fixture's whole board
 * (1x2, totals, margin, in-play windows), named from the shared catalog.
 */

import { Program } from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
// Deep imports on purpose: the shared barrel pulls the TxLINE client whose
// .js-suffixed relative imports Turbopack does not resolve from TS sources.
import TRUEBOOK_IDL from "@truebook/shared/idl/truebook.json";
import type { Truebook } from "@truebook/shared/idl/truebook-type";
import {
  PREMATCH_CATALOG,
  describeMarketParams,
  normalizeMarketParams,
  type MarketDescriptor,
} from "@truebook/shared/marketCatalog";
import type { MarketView, MatchView } from "@/lib/data/types";
import { explorerAddressUrl } from "@/lib/data/types";
import type { VerifyMarketView } from "@/lib/data/demoVerify";
import { formatMarginBps, formatUtcTimestamp } from "@/lib/format";
import { getFixtureNames } from "@/lib/chain/fixtureNames";
import {
  RPC_READ_TIMEOUT_MS,
  createDevnetConnection,
  withDeadline,
} from "@/lib/chain/connection";

export type ChainHouseStats = {
  vaultLabel: string;
  openExposureLabel: string;
  marginLabel: string;
  ticketsAuditedLabel: string;
  violationsFoundLabel: string;
};

export type ChainBoard = {
  houseStats: ChainHouseStats;
  fixtures: MatchView[];
};

export type ChainBoardResult =
  | { ok: true; board: ChainBoard }
  | { ok: false; reason: string };

/** sourceRef: program odds convention, decimal odds in bps (2.06 = 20600). */
const ODDS_BPS_FACTOR = 10_000;
const BPS_FACTOR = 10_000;
/** sourceRef: program constants.rs QUOTE_VALIDITY_SECONDS (place_bet window). */
const QUOTE_VALIDITY_SECONDS = 120;
/** Match the bet slip's client-side safety buffer (BetSlip QUOTE_SAFETY_SECONDS). */
const QUOTE_SAFETY_SECONDS = 15;

/**
 * A quote is only offered on the board while it is still safely placeable. A
 * market whose quote has aged out (a keeper gap, or a market whose consensus
 * line left the feed) shows "Awaiting quote" instead of a stale price the
 * program would reject as QuoteExpired.
 */
function isQuoteFresh(quotePostedTs: number, nowMs: number): boolean {
  if (quotePostedTs <= 0) {
    return false;
  }
  const ageSeconds = Math.floor(nowMs / 1000) - quotePostedTs;
  return ageSeconds <= QUOTE_VALIDITY_SECONDS - QUOTE_SAFETY_SECONDS;
}

/** Board order of the catalog groups; in-play windows land last. */
const CATALOG_ORDER = new Map(
  PREMATCH_CATALOG.map((blueprint, index) => [blueprint.descriptor.key, index]),
);

function buildReadOnlyProgram(): Program<Truebook> {
  const connection = createDevnetConnection();
  return new Program<Truebook>(TRUEBOOK_IDL as Truebook, { connection });
}

function enumVariant(enumObject: object): string {
  return Object.keys(enumObject)[0] ?? "unknown";
}

/** "Jul 6 · 00:00" in UTC, matching the lobby kickoff convention. */
function formatKickoff(kickoffMs: number): string {
  const kickoffDate = new Date(kickoffMs);
  const dayLabel = kickoffDate.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
  const timeLabel = kickoffDate.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "UTC",
  });
  return `${dayLabel} · ${timeLabel}`;
}

type OnChainMarketEntry = Awaited<
  ReturnType<Program<Truebook>["account"]["market"]["all"]>
>[number];

function describeChainMarket(entry: OnChainMarketEntry): MarketDescriptor | null {
  return describeMarketParams(normalizeMarketParams(entry.account.params));
}

/**
 * One market card view. The featured market (the fixture's home win) carries
 * the accent cell; every other card stays calm so the accent reads as one pop.
 */
function toMarketView(
  entry: OnChainMarketEntry,
  descriptor: MarketDescriptor | null,
  marginLabel: string,
  marginFactor: number,
  isFeatured: boolean,
  isInPlay: boolean,
  nowMs: number,
): MarketView {
  const marketAddress = entry.publicKey.toBase58();
  const account = entry.account;
  const stateName = enumVariant(account.state);
  const quotePostedTs = account.quotePostedTs.toNumber();
  const hasQuote = isQuoteFresh(quotePostedTs, nowMs);
  const servedYesOdds = account.yesOddsBps / ODDS_BPS_FACTOR;
  const servedNoOdds = account.noOddsBps / ODDS_BPS_FACTOR;

  return {
    marketKey: marketAddress,
    marketAddress,
    name: descriptor?.name ?? "Custom market",
    groupLabel: isInPlay ? "in-play" : (descriptor?.groupLabel ?? "custom"),
    marginLabel,
    phase: stateName === "locked" ? "locked" : "open",
    phaseNote:
      stateName === "locked"
        ? "Bets closed. Settlement proof lands after full time."
        : undefined,
    isInPlay,
    closesAtMs: account.kickoffTs.toNumber() * 1000,
    quotePostedTsMs: hasQuote ? quotePostedTs * 1000 : undefined,
    outcomes: hasQuote
      ? [
          {
            outcomeKey: `${marketAddress}-yes`,
            label: descriptor?.yesLabel ?? "Yes",
            servedOdds: servedYesOdds,
            // The chain stores served odds; the displayed consensus is
            // recovered from the committed margin (served = consensus minus
            // margin).
            consensusOdds: servedYesOdds * marginFactor,
            isBest: isFeatured,
          },
          {
            outcomeKey: `${marketAddress}-no`,
            label: descriptor?.noLabel ?? "No",
            servedOdds: servedNoOdds,
            consensusOdds: servedNoOdds * marginFactor,
            isBest: false,
          },
        ]
      : [],
  };
}

export type ChainVerifyResult =
  | { ok: true; view: VerifyMarketView | null }
  | { ok: false; reason: string };

/**
 * Index of the daily_scores_merkle_roots account in verify_market's account
 * list, so the ACTUAL root the proof ran against comes out of the on-chain
 * transaction instead of being re-guessed from a timestamp.
 * sourceRef: packages/shared/src/idl/truebook.json (verify_market accounts:
 * cranker, house, market, verified_outcome, daily_scores_merkle_roots, ...).
 */
const VERIFY_MARKET_SCORES_ROOT_ACCOUNT_INDEX = 4;

/**
 * The market's verification story for the public /verify/[market] page:
 * the Market account, its VerifiedOutcome PDA (["outcome", market], absent
 * until verify_market runs), the verify transaction (the outcome account is
 * written once, so its oldest signature IS that transaction), and the daily
 * scores root the proof was checked against. One-shot fetch; the screen
 * offers a retry button instead of polling.
 */
export async function fetchChainVerify(
  marketAddress: string,
  pageOrigin: string,
): Promise<ChainVerifyResult> {
  let market: PublicKey;
  try {
    market = new PublicKey(marketAddress);
  } catch {
    // Not a devnet address at all: same "nothing anchored here" screen as an
    // unknown demo slug, not an RPC error.
    return { ok: true, view: null };
  }
  try {
    const program = buildReadOnlyProgram();
    const connection = program.provider.connection;
    const marketAccount = await withDeadline(
      program.account.market.fetchNullable(market),
      RPC_READ_TIMEOUT_MS,
      "The devnet RPC timed out while reading the market.",
    );
    if (marketAccount === null) {
      return { ok: true, view: null };
    }

    const outcomePda = PublicKey.findProgramAddressSync(
      [new TextEncoder().encode("outcome"), market.toBytes()],
      program.programId,
    )[0];
    const outcome = await withDeadline(
      program.account.verifiedOutcome.fetchNullable(outcomePda),
      RPC_READ_TIMEOUT_MS,
      "The devnet RPC timed out while reading the verified outcome.",
    );

    const descriptor = describeMarketParams(
      normalizeMarketParams(marketAccount.params),
    );
    const names = getFixtureNames(marketAccount.fixtureId.toString());
    const fixtureName = names.awayTeam
      ? `${names.homeTeam} vs ${names.awayTeam}`
      : names.homeTeam;
    const baseView = {
      slug: marketAddress,
      fixtureName,
      marketName: descriptor?.name ?? "Custom market",
      competitionLine: names.competitionLine,
      pageLink: `${pageOrigin}/verify/${marketAddress}`,
    };

    if (outcome === null) {
      return {
        ok: true,
        view: {
          ...baseView,
          status: "awaiting",
          kickoffLine: `${formatKickoff(marketAccount.kickoffTs.toNumber() * 1000)} UTC`,
        },
      };
    }

    const outcomeSignatures = await withDeadline(
      connection.getSignaturesForAddress(outcomePda),
      RPC_READ_TIMEOUT_MS,
      "The devnet RPC timed out while looking up the verify transaction.",
    );
    const verifyTx =
      outcomeSignatures.length > 0
        ? outcomeSignatures[outcomeSignatures.length - 1].signature
        : undefined;

    // Pull the daily scores root the verify transaction actually referenced.
    // Best effort: a failed transaction lookup only hides the root row.
    let dayRoot: string | undefined;
    let dayRootHref: string | undefined;
    if (verifyTx !== undefined) {
      try {
        const verifyTransaction = await withDeadline(
          connection.getParsedTransaction(verifyTx, {
            maxSupportedTransactionVersion: 0,
          }),
          RPC_READ_TIMEOUT_MS,
          "The devnet RPC timed out while reading the verify transaction.",
        );
        for (const instruction of verifyTransaction?.transaction.message
          .instructions ?? []) {
          if (!instruction.programId.equals(program.programId)) continue;
          if (!("accounts" in instruction)) continue;
          const scoresRoot =
            instruction.accounts[VERIFY_MARKET_SCORES_ROOT_ACCOUNT_INDEX];
          if (scoresRoot !== undefined) {
            dayRoot = scoresRoot.toBase58();
            dayRootHref = explorerAddressUrl(dayRoot);
          }
          break;
        }
      } catch (rootLookupError) {
        console.warn(
          `[fetchChainVerify] verify tx lookup failed, omitting the day root: ${String(rootLookupError).slice(0, 120)}`,
        );
      }
    }

    const predicateHolds = outcome.outcome;
    return {
      ok: true,
      view: {
        ...baseView,
        status: "verified",
        settledLine: `settled ${formatUtcTimestamp(outcome.verifiedTs.toNumber())}`,
        outcomeLabel: predicateHolds ? "YES" : "NO",
        outcomeStatement: `${descriptor?.name ?? "predicate"} ${predicateHolds ? "holds" : "does not hold"} · proof seq ${outcome.seq}`,
        dayRoot,
        dayRootHref,
        verifyTx,
      },
    };
  } catch (fetchError) {
    return { ok: false, reason: String(fetchError) };
  }
}

export async function fetchChainBoard(): Promise<ChainBoardResult> {
  try {
    const program = buildReadOnlyProgram();
    // TextEncoder, not Buffer: this module also runs in the browser bundle.
    const housePda = PublicKey.findProgramAddressSync(
      [new TextEncoder().encode("house")],
      program.programId,
    )[0];
    const house = await program.account.house.fetchNullable(housePda);
    if (!house) {
      return { ok: false, reason: "house account not found on devnet" };
    }

    const [vaultBalance, markets, tickets] = await Promise.all([
      program.provider.connection.getTokenAccountBalance(house.vault),
      program.account.market.all(),
      program.account.ticket.all(),
    ]);

    const auditedCount = tickets.filter(
      (ticket) => enumVariant(ticket.account.auditStatus) !== "unaudited",
    ).length;
    const violationCount = tickets.filter(
      (ticket) => enumVariant(ticket.account.auditStatus) === "violation",
    ).length;

    const marginLabel = formatMarginBps(house.marginBps);
    const marginFactor = 1 + house.marginBps / BPS_FACTOR;
    const nowMs = Date.now();

    markets.sort((left, right) => left.account.marketId.cmp(right.account.marketId));

    // Group the bettable board (open and locked markets) by fixture.
    const marketsByFixture = new Map<string, OnChainMarketEntry[]>();
    for (const entry of markets) {
      const stateName = enumVariant(entry.account.state);
      if (stateName !== "open" && stateName !== "locked") continue;
      const fixtureKey = entry.account.fixtureId.toString();
      const fixtureMarkets = marketsByFixture.get(fixtureKey);
      if (fixtureMarkets === undefined) {
        marketsByFixture.set(fixtureKey, [entry]);
      } else {
        fixtureMarkets.push(entry);
      }
    }

    const fixtures: MatchView[] = [];
    for (const [fixtureId, fixtureMarkets] of marketsByFixture) {
      // Fixtures with no open market left have nothing to bet; skip them.
      if (!fixtureMarkets.some((entry) => enumVariant(entry.account.state) === "open")) {
        continue;
      }
      const names = getFixtureNames(fixtureId);
      // The real kickoff is the earliest deadline; in-play windows close later.
      const kickoffMs =
        Math.min(
          ...fixtureMarkets.map((entry) => entry.account.kickoffTs.toNumber()),
        ) * 1000;
      const isUnderway = kickoffMs <= nowMs;
      const kickoffLabel = isUnderway ? "in play" : formatKickoff(kickoffMs);

      const describedMarkets = fixtureMarkets.map((entry) => ({
        entry,
        descriptor: describeChainMarket(entry),
        isInPlay: entry.account.kickoffTs.toNumber() * 1000 > kickoffMs,
      }));
      describedMarkets.sort((left, right) => {
        const leftOrder =
          (left.isInPlay ? 100 : 0) +
          (CATALOG_ORDER.get(left.descriptor?.key ?? "") ?? 50);
        const rightOrder =
          (right.isInPlay ? 100 : 0) +
          (CATALOG_ORDER.get(right.descriptor?.key ?? "") ?? 50);
        return leftOrder - rightOrder;
      });
      // The accent cell belongs to the first freshly-quoted open market.
      const featuredAddress = describedMarkets.find(
        ({ entry }) =>
          enumVariant(entry.account.state) === "open" &&
          isQuoteFresh(entry.account.quotePostedTs.toNumber(), nowMs),
      )?.entry.publicKey.toBase58();

      fixtures.push({
        fixtureId,
        competitionLine: names.competitionLine,
        homeTeam: names.homeTeam,
        awayTeam: names.awayTeam,
        homeScore: 0,
        awayScore: 0,
        clockSeconds: 0,
        phase: isUnderway ? "live" : "upcoming",
        periodNote: isUnderway ? "In play" : `Kickoff ${kickoffLabel}`,
        kickoffLabel,
        markets: describedMarkets.map(({ entry, descriptor, isInPlay }) =>
          toMarketView(
            entry,
            descriptor,
            marginLabel,
            marginFactor,
            entry.publicKey.toBase58() === featuredAddress,
            isInPlay,
            nowMs,
          ),
        ),
        settledMarkets: [],
      });
    }
    fixtures.sort((left, right) => left.fixtureId.localeCompare(right.fixtureId));

    return {
      ok: true,
      board: {
        houseStats: {
          vaultLabel: `${vaultBalance.value.uiAmountString ?? "0"} USDT`,
          openExposureLabel: `${(house.openExposure.toNumber() / 1_000_000).toFixed(2)} USDT`,
          marginLabel,
          ticketsAuditedLabel: String(auditedCount),
          violationsFoundLabel: String(violationCount),
        },
        fixtures,
      },
    };
  } catch (fetchError) {
    return { ok: false, reason: String(fetchError) };
  }
}
