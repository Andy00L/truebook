/**
 * Server route: build the validate_odds evidence for a ticket's or cash-out's
 * stored quote, so the browser can submit an on-chain price audit WITHOUT ever
 * holding the TxLINE API token. The upstream fetch (and the trust boundary it
 * implements) lives in lib/server/txlineProofs.ts, shared with the receipt
 * route; the browser gets only the public odds record and its merkle proof,
 * which is exactly what the permissionless on-chain audit needs.
 */

import { fetchOddsValidationProof } from "@/lib/server/txlineProofs";
import { clientKeyFromRequest, isRateLimited } from "@/lib/server/rateLimit";

/** Generous for humans clicking audits; a wall for request floods. */
const AUDIT_ARGS_REQUESTS_PER_MINUTE = 30;

/** Anything crossing back to the browser: the public record and its proof. */
type AuditArgsResponse =
  | { ok: true; validation: unknown }
  | { ok: false; reason: string };

/** The odds MessageId is short and printable; reject anything that is not. */
function isValidMessageId(candidate: unknown): candidate is string {
  return (
    typeof candidate === "string" &&
    candidate.length > 0 &&
    candidate.length <= 64
  );
}

function isValidTs(candidate: unknown): candidate is number {
  return (
    typeof candidate === "number" &&
    Number.isFinite(candidate) &&
    candidate > 0 &&
    Number.isSafeInteger(candidate)
  );
}

function jsonResponse(body: AuditArgsResponse, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export async function POST(request: Request): Promise<Response> {
  if (isRateLimited(clientKeyFromRequest(request), AUDIT_ARGS_REQUESTS_PER_MINUTE)) {
    return jsonResponse(
      { ok: false, reason: "Too many audit requests. Wait a minute and retry." },
      429,
    );
  }
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return jsonResponse({ ok: false, reason: "Malformed request body." }, 400);
  }

  const messageId = (payload as { messageId?: unknown }).messageId;
  const ts = (payload as { ts?: unknown }).ts;
  if (!isValidMessageId(messageId) || !isValidTs(ts)) {
    return jsonResponse(
      { ok: false, reason: "A quote messageId and numeric ts are required." },
      400,
    );
  }

  const proofResult = await fetchOddsValidationProof(messageId, ts, "audit-args");
  if (proofResult.ok) {
    return jsonResponse({ ok: true, validation: proofResult.payload }, 200);
  }
  if (proofResult.kind === "unconfigured") {
    // The server was not configured with a TxLINE token, so it cannot fetch
    // proofs. Say so plainly instead of leaking a stack trace.
    return jsonResponse(
      {
        ok: false,
        reason:
          "This deployment cannot fetch audit proofs (no TxLINE token configured). Audit from the keeper CLI instead.",
      },
      503,
    );
  }
  if (proofResult.kind === "unreachable") {
    return jsonResponse(
      { ok: false, reason: "The TxLINE proof service is unreachable. Retry shortly." },
      502,
    );
  }
  if (proofResult.kind === "upstream") {
    // A just-posted quote is not yet in an anchored merkle batch, so the proof
    // endpoint answers 404 until the next batch lands; that is a "retry in a
    // moment", not a permanent failure. Other statuses are reported as-is.
    const reason =
      proofResult.status === 404
        ? "This quote is not anchored in a merkle batch yet. Wait for the next batch (about a minute) and retry."
        : `The proof service answered HTTP ${proofResult.status}. The quote could not be proven.`;
    return jsonResponse({ ok: false, reason }, 502);
  }
  return jsonResponse(
    { ok: false, reason: "The proof service returned an unreadable payload." },
    502,
  );
}
