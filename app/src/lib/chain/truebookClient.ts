/**
 * Read-only devnet client for the deployed TrueBook program. Maps on-chain
 * House, Market, and Ticket accounts onto the same view shapes the demo
 * provider fills, so the screens do not change when the source does.
 */

import { Program } from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
// Deep imports on purpose: the shared barrel pulls the TxLINE client whose
// .js-suffixed relative imports Turbopack does not resolve from TS sources.
import TRUEBOOK_IDL from "@truebook/shared/idl/truebook.json";
import type { Truebook } from "@truebook/shared/idl/truebook-type";
import type { MatchView } from "@/lib/data/types";
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
    const nowMs = Date.now();

    markets.sort((left, right) => left.account.marketId.cmp(right.account.marketId));

    const fixtures: MatchView[] = markets
      .filter((market) => enumVariant(market.account.state) === "open")
      .map(({ publicKey: marketAddress, account }) => {
        const fixtureId = account.fixtureId.toString();
        const names = getFixtureNames(fixtureId);
        const kickoffMs = account.kickoffTs.toNumber() * 1000;
        const hasQuote = account.quotePostedTs.toNumber() > 0;
        const servedYesOdds = account.yesOddsBps / ODDS_BPS_FACTOR;
        const servedNoOdds = account.noOddsBps / ODDS_BPS_FACTOR;
        // The chain stores served odds; the displayed consensus is recovered
        // from the committed margin (served = consensus minus margin).
        const marginFactor = 1 + house.marginBps / BPS_FACTOR;
        const kickoffLabel =
          kickoffMs > nowMs ? formatKickoff(kickoffMs) : "in play";

        return {
          fixtureId,
          competitionLine: names.competitionLine,
          homeTeam: names.homeTeam,
          awayTeam: names.awayTeam,
          homeScore: 0,
          awayScore: 0,
          clockSeconds: 0,
          phase: "upcoming" as const,
          periodNote: `Kickoff ${kickoffLabel}`,
          kickoffLabel,
          markets: [
            {
              marketKey: "homeWin",
              marketAddress: marketAddress.toBase58(),
              name: "Home win",
              groupLabel: "1x2",
              marginLabel,
              phase: "open" as const,
              outcomes: hasQuote
                ? [
                    {
                      outcomeKey: `${fixtureId}-yes`,
                      label: "Yes",
                      servedOdds: servedYesOdds,
                      consensusOdds: servedYesOdds * marginFactor,
                      isBest: true,
                    },
                    {
                      outcomeKey: `${fixtureId}-no`,
                      label: "No",
                      servedOdds: servedNoOdds,
                      consensusOdds: servedNoOdds * marginFactor,
                      isBest: false,
                    },
                  ]
                : [],
            },
          ],
          settledMarkets: [],
        };
      });

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
