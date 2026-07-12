/**
 * Chain tickets provider: lists the connected wallet's Ticket accounts and
 * maps them onto the TicketView shape the tickets screen renders. Joins each
 * ticket with its market (for the name and the live cash-out offer) and, for
 * cashed-out tickets, with the CashOutReceipt (for the paid amount and the
 * audit verdict). The cash-out offer mirrors the on-chain math exactly, in
 * bigint, so the sheet shows the number the program will pay.
 */

import { PublicKey } from "@solana/web3.js";
import {
  describeMarketParams,
  normalizeMarketParams,
} from "@truebook/shared/marketCatalog";
import type { CashOutOffer, TicketView } from "@/lib/data/types";
import { formatAmount, formatMatchupLabel, formatOdds, formatOddsBps } from "@/lib/format";
import { getFixtureNames } from "@/lib/chain/fixtureNames";
import { createDevnetConnection, RPC_READ_TIMEOUT_MS, withDeadline } from "@/lib/chain/connection";
import { buildReadOnlyTruebookProgram } from "@/lib/chain/placeBet";

export type ChainTicketsResult =
  | { ok: true; tickets: TicketView[] }
  | { ok: false; reason: string };

/** sourceRef: USDT test mint on devnet, 6 decimals. */
const USDT_DECIMAL_FACTOR = 1_000_000;
/** sourceRef: program odds convention, decimal odds in bps (2.06 = 20600).
 * BigInt() calls, not literals: the app tsconfig targets below ES2020. */
const ODDS_BPS_FACTOR = BigInt(10_000);
const BPS_DENOMINATOR = BigInt(10_000);
const ZERO = BigInt(0);
/**
 * sourceRef: program/programs/truebook/src/constants.rs
 * (QUOTE_VALIDITY_SECONDS): a posted quote is placeable for 120 seconds.
 */
const QUOTE_VALIDITY_SECONDS = 120;
/** Ticket account layout: 8 discriminator + 32 market, then the bettor. */
const TICKET_BETTOR_OFFSET = 40;

function enumVariant(enumObject: object): string {
  return Object.keys(enumObject)[0] ?? "unknown";
}

/** "Jul 5 · 20:14:32 UTC" for receipt rows. */
function formatReceiptTimestamp(unixSeconds: number): string {
  const stampDate = new Date(unixSeconds * 1000);
  const dayLabel = stampDate.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
  const timeLabel = stampDate.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZone: "UTC",
  });
  return `${dayLabel} · ${timeLabel} UTC`;
}

/**
 * The exact value cash_out_ticket would pay right now, mirrored in bigint:
 * implied = floor(scale * denom / odds); value = floor(payout * (denom -
 * implied) / denom). sourceRef: program math.rs (implied_prob_bps,
 * cash_out_value).
 */
function cashOutValueRaw(payoutRaw: bigint, oppositeOddsBps: number): bigint | null {
  const oppositeOdds = BigInt(oppositeOddsBps);
  if (oppositeOdds <= ODDS_BPS_FACTOR) {
    return null;
  }
  const impliedBps = (ODDS_BPS_FACTOR * BPS_DENOMINATOR) / oppositeOdds;
  return (payoutRaw * (BPS_DENOMINATOR - impliedBps)) / BPS_DENOMINATOR;
}

export async function fetchChainTickets(
  ownerBase58: string,
): Promise<ChainTicketsResult> {
  try {
    const connection = createDevnetConnection();
    const program = buildReadOnlyTruebookProgram(connection);
    const tickets = await withDeadline(
      program.account.ticket.all([
        { memcmp: { offset: TICKET_BETTOR_OFFSET, bytes: ownerBase58 } },
      ]),
      RPC_READ_TIMEOUT_MS,
      "The devnet RPC timed out while listing tickets.",
    );
    if (tickets.length === 0) {
      return { ok: true, tickets: [] };
    }

    // Join markets and cash-out receipts in one parallel read pass.
    const marketKeys = [...new Set(tickets.map((entry) => entry.account.market.toBase58()))];
    const receiptPdas = tickets.map(
      (entry) =>
        PublicKey.findProgramAddressSync(
          [new TextEncoder().encode("cashout"), entry.publicKey.toBytes()],
          program.programId,
        )[0],
    );
    const [markets, receipts] = await Promise.all([
      withDeadline(
        program.account.market.fetchMultiple(marketKeys),
        RPC_READ_TIMEOUT_MS,
        "The devnet RPC timed out while reading markets.",
      ),
      withDeadline(
        program.account.cashOutReceipt.fetchMultiple(receiptPdas),
        RPC_READ_TIMEOUT_MS,
        "The devnet RPC timed out while reading cash-out receipts.",
      ),
    ]);
    const marketByKey = new Map(
      marketKeys.map((marketKey, index) => [marketKey, markets[index]]),
    );

    const nowSeconds = Math.floor(Date.now() / 1000);
    const views: TicketView[] = [];

    tickets.sort(
      (left, right) => right.account.createdTs.toNumber() - left.account.createdTs.toNumber(),
    );

    tickets.forEach((entry, ticketIndex) => {
      const ticket = entry.account;
      const ticketAddress = entry.publicKey.toBase58();
      const marketAddress = ticket.market.toBase58();
      const market = marketByKey.get(marketAddress) ?? null;
      const receipt = receipts[ticketIndex] ?? null;

      const descriptor = market
        ? describeMarketParams(normalizeMarketParams(market.params))
        : null;
      const names = market ? getFixtureNames(market.fixtureId.toString()) : null;
      const sideIsYes = enumVariant(ticket.side) === "yes";
      const pickLabel = descriptor
        ? sideIsYes
          ? descriptor.yesLabel
          : descriptor.noLabel
        : sideIsYes
          ? "Yes"
          : "No";

      const stateName = enumVariant(ticket.state);
      const status: TicketView["status"] =
        stateName === "live"
          ? "live"
          : stateName === "won" || stateName === "claimed"
            ? "won"
            : stateName === "lost"
              ? "lost"
              : stateName === "refundable"
                ? "refundable"
                : stateName === "refunded"
                  ? "refunded"
                  : "cashedOut";

      const stakeUi = ticket.stake.toNumber() / USDT_DECIMAL_FACTOR;
      const payoutUi = ticket.potentialPayout.toNumber() / USDT_DECIMAL_FACTOR;
      const cashOutPaidUi =
        receipt === null ? null : receipt.paidAmount.toNumber() / USDT_DECIMAL_FACTOR;

      // Live ticket on an open market with a fresh quote: a standing offer.
      let cashOut: CashOutOffer | undefined;
      if (status === "live" && market !== null && enumVariant(market.state) === "open") {
        const quoteAgeSeconds = nowSeconds - market.quotePostedTs.toNumber();
        const oppositeOddsBps = sideIsYes ? market.noOddsBps : market.yesOddsBps;
        const offerRaw = cashOutValueRaw(
          BigInt(ticket.potentialPayout.toString()),
          oppositeOddsBps,
        );
        if (
          market.quotePostedTs.toNumber() > 0 &&
          quoteAgeSeconds <= QUOTE_VALIDITY_SECONDS &&
          offerRaw !== null &&
          offerRaw > ZERO
        ) {
          const impliedBps = Number(
            (ODDS_BPS_FACTOR * BPS_DENOMINATOR) / BigInt(oppositeOddsBps),
          );
          cashOut = {
            ticketAddress,
            marketAddress,
            offerAmount: Number(offerRaw) / USDT_DECIMAL_FACTOR,
            payoutAmount: payoutUi,
            oppositeOddsLabel: formatOddsBps(oppositeOddsBps),
            oppositeImpliedPct: impliedBps / 100,
            quoteSecondsLeft: Math.max(0, QUOTE_VALIDITY_SECONDS - quoteAgeSeconds),
          };
        }
      }

      const amountColumnTitle: TicketView["amountColumnTitle"] =
        status === "live"
          ? "potential"
          : status === "refundable" || status === "refunded"
            ? "refunded"
            : status === "cashedOut"
              ? "cashed out"
              : "payout";
      const amountLabel =
        status === "live"
          ? formatAmount(payoutUi)
          : status === "won"
            ? formatAmount(payoutUi)
            : status === "refundable" || status === "refunded"
              ? formatAmount(stakeUi)
              : status === "cashedOut"
                ? formatAmount(cashOutPaidUi ?? 0)
                : formatAmount(0);

      const receiptRows: Array<{ label: string; value: string; tone?: "danger" }> = [
        { label: "Stake", value: `${formatAmount(stakeUi)} USDT` },
        { label: "Quoted odds", value: formatOddsBps(ticket.quotedOddsBps) },
      ];
      if (status === "live") {
        receiptRows.push({
          label: "Potential payout",
          value: `${formatAmount(payoutUi)} USDT`,
        });
      } else if (status === "won") {
        receiptRows.push({ label: "Payout", value: `${formatAmount(payoutUi)} USDT` });
      } else if (status === "lost") {
        receiptRows.push({ label: "Payout", value: "0.00 USDT" });
      } else if (status === "refundable") {
        receiptRows.push({
          label: "Refund due",
          value: `${formatAmount(stakeUi)} USDT`,
          tone: "danger",
        });
      } else if (status === "refunded") {
        receiptRows.push({
          label: "Refunded",
          value: `${formatAmount(stakeUi)} USDT`,
          tone: "danger",
        });
      } else if (status === "cashedOut" && cashOutPaidUi !== null) {
        receiptRows.push({
          label: "Cash-out received",
          value: `${formatAmount(cashOutPaidUi)} USDT`,
        });
        if (receipt !== null && enumVariant(receipt.auditStatus) === "violation") {
          receiptRows.push({
            label: receipt.madeWhole ? "Shortfall repaid" : "Shortfall owed",
            value: `${formatAmount(receipt.shortfallOwed.toNumber() / USDT_DECIMAL_FACTOR)} USDT`,
            tone: "danger",
          });
        }
      }
      receiptRows.push({
        label: "Placed",
        value: formatReceiptTimestamp(ticket.createdTs.toNumber()),
      });

      // The transparency line: consensus is recovered from the served odds
      // and the committed margin, same convention as the board.
      const servedOdds = ticket.quotedOddsBps / Number(ODDS_BPS_FACTOR);
      const priceLine =
        status === "cashedOut" && receipt !== null
          ? `cashed out against ${descriptor?.name ?? "the market"} · opposite side ${formatOddsBps(receipt.oppositeOddsBps)} · quote ${receipt.oddsMessageId.slice(0, 18)}…`
          : `your price ${formatOdds(servedOdds)} · quote ${ticket.oddsMessageId.slice(0, 18)}…`;

      const quoteId =
        status === "cashedOut" && receipt !== null
          ? receipt.oddsMessageId
          : ticket.oddsMessageId;

      views.push({
        ticketId: ticketAddress,
        marketName: descriptor?.name ?? "Custom market",
        pickLabel,
        fixtureLine: names
          ? formatMatchupLabel(names.homeTeam, names.awayTeam)
          : "Unknown fixture",
        status,
        stakeLabel: formatAmount(stakeUi),
        oddsLabel: formatOddsBps(ticket.quotedOddsBps),
        amountColumnTitle,
        amountLabel,
        receiptTitle: status === "live" ? "Open ticket" : "Proof receipt",
        receiptRows,
        priceLine,
        proof: {
          kind: "priceOnly",
          quoteId,
          auditHref: `https://explorer.solana.com/address/${ticketAddress}?cluster=devnet`,
          note:
            status === "cashedOut"
              ? "This cash-out price is auditable: anyone can prove the quote it derived from against TxLINE consensus. A proven lowball repays the difference and pays the auditor 5% of the stake."
              : "Anyone can prove this price against TxLINE consensus. A proven overcharge refunds the stake and pays the auditor 5% of it.",
        },
        cashOut,
      });
    });

    return { ok: true, tickets: views };
  } catch (fetchError) {
    return { ok: false, reason: String(fetchError) };
  }
}
