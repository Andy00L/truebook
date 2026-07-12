/**
 * Server route: build the validate_odds evidence for a ticket's or cash-out's
 * stored quote, so the browser can submit an on-chain price audit WITHOUT ever
 * holding the TxLINE API token. The token is read from the server-only env
 * (never NEXT_PUBLIC_, never returned, never logged); the browser gets only
 * the public odds record and its merkle proof, which is exactly what the
 * permissionless on-chain audit needs.
 *
 * This trust boundary is deliberately a small, self-contained fetch rather
 * than a reuse of the shared TxLINE client: the client is exported for Node
 * tooling (the keeper) and pulling its barrel through the app bundler has bit
 * us before. The request shape mirrors getOddsValidation in
 * packages/shared/src/txline/client.ts.
 */

import {
  ACCEPT_ENCODING_IDENTITY,
  TXLINE_API_ORIGIN,
} from "@truebook/shared/config";

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

  const apiToken = process.env.TXLINE_API_TOKEN ?? "";
  if (apiToken.length === 0) {
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
  const jwt = process.env.TXLINE_JWT ?? "";

  const query = `?messageId=${encodeURIComponent(messageId)}&ts=${ts}`;
  let upstream: Response;
  try {
    upstream = await fetch(`${TXLINE_API_ORIGIN}/api/odds/validation${query}`, {
      headers: {
        Authorization: `Bearer ${jwt}`,
        "X-Api-Token": apiToken,
        "Accept-Encoding": ACCEPT_ENCODING_IDENTITY,
      },
      // The proof is deterministic for a fixed record; let the edge cache it.
      cache: "no-store",
    });
  } catch (networkError) {
    console.error(
      `[audit-args] TxLINE unreachable: ${String(networkError).slice(0, 200)}`,
    );
    return jsonResponse(
      { ok: false, reason: "The TxLINE proof service is unreachable. Retry shortly." },
      502,
    );
  }

  const bodyText = await upstream.text();
  if (!upstream.ok) {
    // Distinct, actionable, and free of the token: report the upstream status.
    console.error(`[audit-args] TxLINE HTTP ${upstream.status}`);
    // A just-posted quote is not yet in an anchored merkle batch, so the proof
    // endpoint answers 404 until the next batch lands; that is a "retry in a
    // moment", not a permanent failure. Other statuses are reported as-is.
    const reason =
      upstream.status === 404
        ? "This quote is not anchored in a merkle batch yet. Wait for the next batch (about a minute) and retry."
        : `The proof service answered HTTP ${upstream.status}. The quote could not be proven.`;
    return jsonResponse({ ok: false, reason }, 502);
  }

  try {
    return jsonResponse({ ok: true, validation: JSON.parse(bodyText) }, 200);
  } catch {
    return jsonResponse(
      { ok: false, reason: "The proof service returned an unreadable payload." },
      502,
    );
  }
}
