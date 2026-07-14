/**
 * Server-only TxLINE proof fetches, shared by the audit-args and receipt
 * routes. The API token lives in server env (never NEXT_PUBLIC_, never
 * returned, never logged); the browser only ever receives public records and
 * their merkle proofs. This mirrors the shared txline client's request shape
 * with a plain fetch on purpose: the client is exported for Node tooling and
 * pulling its barrel through the app bundler has bit us before (see
 * app/src/app/api/audit-args/route.ts).
 */

import {
  ACCEPT_ENCODING_IDENTITY,
  TXLINE_API_ORIGIN,
} from "@truebook/shared/config";

export type TxlineProofResult =
  | { ok: true; payload: unknown }
  | {
      ok: false;
      kind: "unconfigured" | "unreachable" | "upstream" | "unparseable";
      status?: number;
    };

/** GET one TxLINE proof endpoint with the server-held credentials. */
export async function fetchTxlineProof(
  pathWithQuery: string,
  logPrefix: string,
): Promise<TxlineProofResult> {
  const apiToken = process.env.TXLINE_API_TOKEN ?? "";
  if (apiToken.length === 0) {
    return { ok: false, kind: "unconfigured" };
  }
  const jwt = process.env.TXLINE_JWT ?? "";

  let upstream: Response;
  try {
    upstream = await fetch(`${TXLINE_API_ORIGIN}${pathWithQuery}`, {
      headers: {
        Authorization: `Bearer ${jwt}`,
        "X-Api-Token": apiToken,
        "Accept-Encoding": ACCEPT_ENCODING_IDENTITY,
      },
      cache: "no-store",
    });
  } catch (networkError) {
    console.error(
      `[${logPrefix}] TxLINE unreachable: ${String(networkError).slice(0, 200)}`,
    );
    return { ok: false, kind: "unreachable" };
  }

  const bodyText = await upstream.text();
  if (!upstream.ok) {
    // Distinct, actionable, and free of the token: report the upstream status.
    console.error(`[${logPrefix}] TxLINE HTTP ${upstream.status}`);
    return { ok: false, kind: "upstream", status: upstream.status };
  }
  try {
    return { ok: true, payload: JSON.parse(bodyText) };
  } catch {
    return { ok: false, kind: "unparseable" };
  }
}

/** The validate_odds evidence for one quote (messageId + record ts). */
export function fetchOddsValidationProof(
  messageId: string,
  ts: number,
  logPrefix: string,
): Promise<TxlineProofResult> {
  const query = `?messageId=${encodeURIComponent(messageId)}&ts=${ts}`;
  return fetchTxlineProof(`/api/odds/validation${query}`, logPrefix);
}

/** The validate_stat evidence for one or two stats at a given seq. */
export function fetchStatValidationProof(
  params: { fixtureId: number; seq: number; statKey: number; statKey2?: number },
  logPrefix: string,
): Promise<TxlineProofResult> {
  const statKey2Query =
    params.statKey2 === undefined ? "" : `&statKey2=${params.statKey2}`;
  return fetchTxlineProof(
    `/api/scores/stat-validation?fixtureId=${params.fixtureId}&seq=${params.seq}&statKey=${params.statKey}${statKey2Query}`,
    logPrefix,
  );
}
