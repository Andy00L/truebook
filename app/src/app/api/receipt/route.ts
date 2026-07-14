/**
 * Server route: assemble a ticket's portable proof receipt (plan P6) so the
 * tickets screen can offer a one-click download. Chain accounts and
 * transaction history come from devnet; the TxLINE proof payloads come from
 * the server-held credentials (lib/server/txlineProofs.ts), so the token
 * never reaches the browser. Everything returned is public: chain data and
 * merkle proofs only. The keeper's export-receipt command builds the same
 * schema; `bun run src/index.ts verify-receipt <file>` re-checks it.
 */

import { PublicKey } from "@solana/web3.js";
import {
  MILLISECONDS_PER_DAY,
  SEED_DAILY_BATCH_ROOTS,
  SEED_DAILY_SCORES_ROOTS,
  TXLINE_PROGRAM_ID,
} from "@truebook/shared/config";
import {
  TICKET_RECEIPT_SCHEMA,
  TICKET_RECEIPT_VERSION,
  collectTruebookTransactions,
  oddsValidationLooksComplete,
  statValidationLooksComplete,
  type TicketReceipt,
} from "@truebook/shared/receipt";
import {
  describeMarketParams,
  normalizeMarketParams,
} from "@truebook/shared/marketCatalog";
import type {
  OddsValidation,
  ScoresStatValidation,
} from "@truebook/shared/txline/types";
import TRUEBOOK_IDL from "@truebook/shared/idl/truebook.json";
import { createDevnetConnection } from "@/lib/chain/connection";
import { buildReadOnlyTruebookProgram } from "@/lib/chain/placeBet";
import { epochDayLeBytes } from "@/lib/chain/auditArgs";
import { getFixtureNames } from "@/lib/chain/fixtureNames";
import {
  fetchOddsValidationProof,
  fetchStatValidationProof,
  type TxlineProofResult,
} from "@/lib/server/txlineProofs";
import { clientKeyFromRequest, isRateLimited } from "@/lib/server/rateLimit";

/** Receipt assembly costs a dozen upstream calls; keep floods off it. */
const RECEIPT_REQUESTS_PER_MINUTE = 10;

type ReceiptFailure = { ok: false; reason: string };

function enumVariant(enumObject: object): string {
  return Object.keys(enumObject)[0] ?? "unknown";
}

function epochDayOf(timestampMs: number): number {
  return Math.floor(timestampMs / MILLISECONDS_PER_DAY);
}

function dailyRootPda(seed: string, timestampMs: number): PublicKey {
  return PublicKey.findProgramAddressSync(
    [new TextEncoder().encode(seed), epochDayLeBytes(timestampMs)],
    TXLINE_PROGRAM_ID,
  )[0];
}

function jsonFailure(reason: string, status: number): Response {
  const body: ReceiptFailure = { ok: false, reason };
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

/** Map a proof-service failure onto the same reasons audit-args reports. */
function proofFailureResponse(result: Extract<TxlineProofResult, { ok: false }>): Response {
  if (result.kind === "unconfigured") {
    return jsonFailure(
      "This deployment cannot fetch audit proofs (no TxLINE token configured). Export the receipt from the keeper CLI instead.",
      503,
    );
  }
  if (result.kind === "unreachable") {
    return jsonFailure("The TxLINE proof service is unreachable. Retry shortly.", 502);
  }
  if (result.kind === "upstream") {
    return jsonFailure(
      result.status === 404
        ? "A proof in this receipt is not anchored in a merkle batch yet. Wait a minute and retry."
        : `The proof service answered HTTP ${result.status}. The receipt could not be assembled.`,
      502,
    );
  }
  return jsonFailure("The proof service returned an unreadable payload.", 502);
}

export async function GET(request: Request): Promise<Response> {
  if (isRateLimited(clientKeyFromRequest(request), RECEIPT_REQUESTS_PER_MINUTE)) {
    return jsonFailure("Too many receipt requests. Wait a minute and retry.", 429);
  }
  const ticketParam = new URL(request.url).searchParams.get("ticket") ?? "";
  let ticketKey: PublicKey;
  try {
    ticketKey = new PublicKey(ticketParam);
  } catch {
    return jsonFailure("A valid ticket address is required.", 400);
  }

  try {
    const connection = createDevnetConnection();
    const program = buildReadOnlyTruebookProgram(connection);

    const ticket = await program.account.ticket.fetchNullable(ticketKey);
    if (ticket === null) {
      return jsonFailure("No ticket account exists at this address on devnet.", 404);
    }
    const market = await program.account.market.fetchNullable(ticket.market);
    if (market === null) {
      return jsonFailure("The ticket references a market that no longer exists.", 404);
    }

    const seedEncoder = new TextEncoder();
    const outcomeKey = PublicKey.findProgramAddressSync(
      [seedEncoder.encode("outcome"), ticket.market.toBytes()],
      program.programId,
    )[0];
    const cashOutKey = PublicKey.findProgramAddressSync(
      [seedEncoder.encode("cashout"), ticketKey.toBytes()],
      program.programId,
    )[0];
    const [outcome, cashOut] = await Promise.all([
      program.account.verifiedOutcome.fetchNullable(outcomeKey),
      program.account.cashOutReceipt.fetchNullable(cashOutKey),
    ]);

    const params = normalizeMarketParams(market.params);
    const descriptor = describeMarketParams(params);
    const fixtureId = market.fixtureId.toNumber();
    const names = getFixtureNames(fixtureId.toString());

    // The opening quote's proof: mandatory, it is what audit_ticket verifies.
    const oddsProof = await fetchOddsValidationProof(
      ticket.oddsMessageId,
      ticket.oddsTs.toNumber(),
      "receipt",
    );
    if (!oddsProof.ok) {
      return proofFailureResponse(oddsProof);
    }
    if (!oddsValidationLooksComplete(oddsProof.payload)) {
      return jsonFailure("The proof service returned an incomplete odds proof.", 502);
    }
    const oddsValidation = oddsProof.payload as OddsValidation;

    // The settlement proof, once verify_market anchored an outcome.
    let statValidation: ScoresStatValidation | null = null;
    if (outcome !== null && descriptor !== null) {
      const statProof = await fetchStatValidationProof(
        {
          fixtureId,
          seq: outcome.seq,
          statKey: descriptor.proofStatKeys[0],
          statKey2: params.hasStatB ? descriptor.proofStatKeys[1] : undefined,
        },
        "receipt",
      );
      if (!statProof.ok) {
        return proofFailureResponse(statProof);
      }
      if (!statValidationLooksComplete(statProof.payload)) {
        return jsonFailure("The proof service returned an incomplete settlement proof.", 502);
      }
      statValidation = statProof.payload as ScoresStatValidation;
    }

    // The cash-out quote's proof, when the ticket was sold back to the vault.
    let cashOutOddsValidation: OddsValidation | null = null;
    if (cashOut !== null) {
      const cashOutProof = await fetchOddsValidationProof(
        cashOut.oddsMessageId,
        cashOut.oddsTs.toNumber(),
        "receipt",
      );
      if (!cashOutProof.ok) {
        return proofFailureResponse(cashOutProof);
      }
      if (!oddsValidationLooksComplete(cashOutProof.payload)) {
        return jsonFailure("The proof service returned an incomplete cash-out proof.", 502);
      }
      cashOutOddsValidation = cashOutProof.payload as OddsValidation;
    }

    // Every bettor-facing transaction sits on the ticket account; the outcome
    // PDA contributes only the verify tx (its other signatures are sibling
    // tickets settling against the same outcome). The market account is
    // deliberately not watched: it would drag in every keeper quote tick.
    const transactions = await collectTruebookTransactions(
      connection,
      [ticketKey],
      program.programId.toBase58(),
      TRUEBOOK_IDL.instructions,
    );
    if (outcome !== null) {
      const outcomeTransactions = await collectTruebookTransactions(
        connection,
        [outcomeKey],
        program.programId.toBase58(),
        TRUEBOOK_IDL.instructions,
      );
      const knownSignatures = new Set(
        transactions.map((transaction) => transaction.signature),
      );
      transactions.push(
        ...outcomeTransactions.filter(
          (transaction) =>
            transaction.kind === "verifyMarket" &&
            !knownSignatures.has(transaction.signature),
        ),
      );
      transactions.sort((left, right) => left.slot - right.slot);
    }

    const oddsTsMs = oddsValidation.odds.Ts;
    const scoresMinTimestampMs =
      statValidation === null
        ? null
        : statValidation.summary.updateStats.minTimestamp;
    const cashOutOddsTsMs =
      cashOutOddsValidation === null ? null : cashOutOddsValidation.odds.Ts;

    const receipt: TicketReceipt = {
      schema: TICKET_RECEIPT_SCHEMA,
      version: TICKET_RECEIPT_VERSION,
      network: "devnet",
      truebookProgram: program.programId.toBase58(),
      txlineProgram: TXLINE_PROGRAM_ID.toBase58(),
      exportedAt: new Date().toISOString(),
      ticket: {
        address: ticketKey.toBase58(),
        market: ticket.market.toBase58(),
        bettor: ticket.bettor.toBase58(),
        side: enumVariant(ticket.side) === "yes" ? "yes" : "no",
        stakeRaw: ticket.stake.toString(),
        quotedOddsBps: ticket.quotedOddsBps,
        oddsMessageId: ticket.oddsMessageId,
        oddsTsMs: ticket.oddsTs.toNumber(),
        potentialPayoutRaw: ticket.potentialPayout.toString(),
        state: enumVariant(ticket.state),
        auditStatus: enumVariant(ticket.auditStatus),
        createdTs: ticket.createdTs.toNumber(),
      },
      market: {
        address: ticket.market.toBase58(),
        marketId: market.marketId.toString(),
        fixtureId,
        name: descriptor?.name ?? null,
        homeTeam: names.homeTeam,
        awayTeam: names.awayTeam.length > 0 ? names.awayTeam : null,
        params,
        outcomePriceIndex: market.outcomePriceIndex,
        kickoffTs: market.kickoffTs.toNumber(),
        state: enumVariant(market.state),
      },
      outcome:
        outcome === null
          ? null
          : {
              address: outcomeKey.toBase58(),
              predicateHolds: outcome.outcome,
              seq: outcome.seq,
              verifiedTs: outcome.verifiedTs.toNumber(),
            },
      cashOut:
        cashOut === null
          ? null
          : {
              address: cashOutKey.toBase58(),
              paidAmountRaw: cashOut.paidAmount.toString(),
              oppositeOddsBps: cashOut.oppositeOddsBps,
              oddsMessageId: cashOut.oddsMessageId,
              oddsTsMs: cashOut.oddsTs.toNumber(),
              cashedTs: cashOut.cashedTs.toNumber(),
              auditStatus: enumVariant(cashOut.auditStatus),
              shortfallOwedRaw: cashOut.shortfallOwed.toString(),
              madeWhole: cashOut.madeWhole,
            },
      dailyRoots: {
        oddsRootPda: dailyRootPda(SEED_DAILY_BATCH_ROOTS, oddsTsMs).toBase58(),
        oddsEpochDay: epochDayOf(oddsTsMs),
        scoresRootPda:
          scoresMinTimestampMs === null
            ? null
            : dailyRootPda(SEED_DAILY_SCORES_ROOTS, scoresMinTimestampMs).toBase58(),
        scoresEpochDay:
          scoresMinTimestampMs === null ? null : epochDayOf(scoresMinTimestampMs),
        cashOutOddsRootPda:
          cashOutOddsTsMs === null
            ? null
            : dailyRootPda(SEED_DAILY_BATCH_ROOTS, cashOutOddsTsMs).toBase58(),
        cashOutOddsEpochDay:
          cashOutOddsTsMs === null ? null : epochDayOf(cashOutOddsTsMs),
      },
      transactions,
      proofs: { oddsValidation, statValidation, cashOutOddsValidation },
    };

    return new Response(JSON.stringify(receipt, null, 2), {
      status: 200,
      headers: {
        "content-type": "application/json",
        "content-disposition": `attachment; filename="truebook-receipt-${ticketKey.toBase58().slice(0, 8)}.json"`,
      },
    });
  } catch (receiptError) {
    console.error(`[receipt] assembly failed: ${String(receiptError).slice(0, 200)}`);
    return jsonFailure(
      "The devnet RPC did not answer while assembling the receipt. Retry shortly.",
      502,
    );
  }
}
