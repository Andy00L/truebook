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
import { formatMarginBps } from "@/lib/format";
import { getFixtureNames } from "@/lib/chain/fixtureNames";
import { createDevnetConnection } from "@/lib/chain/connection";

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
): MarketView {
  const marketAddress = entry.publicKey.toBase58();
  const account = entry.account;
  const stateName = enumVariant(account.state);
  const hasQuote = account.quotePostedTs.toNumber() > 0;
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
      // The accent cell belongs to the first quoted open market of the board.
      const featuredAddress = describedMarkets.find(
        ({ entry }) =>
          enumVariant(entry.account.state) === "open" &&
          entry.account.quotePostedTs.toNumber() > 0,
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
