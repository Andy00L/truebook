// TxLINE off-chain data client. All calls return errors as values.
// Ports the request handling verified in the devnet spike:
//   - Accept-Encoding: identity (Bun/undici fail on TxLINE's zstd)
//   - /api/token/activate returns the token as plain text, not JSON
// sourceRef: docs/research/2026-07-02-spike-findings.md.

import {
  TXLINE_API_ORIGIN,
  ACCEPT_ENCODING_IDENTITY,
} from "../config.js";
import type {
  TxlineAuth,
  FixtureSnapshot,
  ScoresSnapshotRow,
  ScoresStatValidation,
  OddsRecord,
  OddsValidation,
} from "./types.js";

export type Result<TValue> =
  | { ok: true; value: TValue }
  | { ok: false; reason: string };

function authHeaders(auth: TxlineAuth): Record<string, string> {
  return {
    Authorization: `Bearer ${auth.jwt}`,
    "X-Api-Token": auth.apiToken,
    "Accept-Encoding": ACCEPT_ENCODING_IDENTITY,
  };
}

// Fetch and parse a JSON body from an authenticated TxLINE endpoint.
async function getJson<TResponse>(path: string, auth: TxlineAuth): Promise<Result<TResponse>> {
  let response: Response;
  try {
    response = await fetch(`${TXLINE_API_ORIGIN}${path}`, { headers: authHeaders(auth) });
  } catch (networkError) {
    return { ok: false, reason: `[getJson] network error on ${path}: ${String(networkError)}` };
  }
  const bodyText = await response.text();
  if (!response.ok) {
    return { ok: false, reason: `[getJson] ${path} HTTP ${response.status}: ${bodyText.slice(0, 300)}` };
  }
  try {
    return { ok: true, value: JSON.parse(bodyText) as TResponse };
  } catch (parseError) {
    return { ok: false, reason: `[getJson] ${path} invalid JSON: ${String(parseError)}` };
  }
}

// Fetch a raw text body (for SSE historical replay).
export async function getText(path: string, auth: TxlineAuth): Promise<Result<string>> {
  let response: Response;
  try {
    response = await fetch(`${TXLINE_API_ORIGIN}${path}`, {
      headers: { ...authHeaders(auth), Accept: "text/event-stream" },
    });
  } catch (networkError) {
    return { ok: false, reason: `[getText] network error on ${path}: ${String(networkError)}` };
  }
  const bodyText = await response.text();
  if (!response.ok) {
    return { ok: false, reason: `[getText] ${path} HTTP ${response.status}: ${bodyText.slice(0, 300)}` };
  }
  return { ok: true, value: bodyText };
}

// GET /api/fixtures/snapshot (optionally filtered by competition).
export function getFixturesSnapshot(auth: TxlineAuth, competitionId?: number): Promise<Result<FixtureSnapshot[]>> {
  const query = competitionId === undefined ? "" : `?competitionId=${competitionId}`;
  return getJson<FixtureSnapshot[]>(`/api/fixtures/snapshot${query}`, auth);
}

// GET /api/scores/snapshot/{fixtureId} returns the cumulative score rows.
export function getScoresSnapshot(auth: TxlineAuth, fixtureId: number): Promise<Result<ScoresSnapshotRow[]>> {
  return getJson<ScoresSnapshotRow[]>(`/api/scores/snapshot/${fixtureId}`, auth);
}

// GET /api/scores/stat-validation for one or two stats at a given seq.
export function getStatValidation(
  auth: TxlineAuth,
  params: { fixtureId: number; seq: number; statKey: number; statKey2?: number },
): Promise<Result<ScoresStatValidation>> {
  const statKey2Query = params.statKey2 === undefined ? "" : `&statKey2=${params.statKey2}`;
  return getJson<ScoresStatValidation>(
    `/api/scores/stat-validation?fixtureId=${params.fixtureId}&seq=${params.seq}&statKey=${params.statKey}${statKey2Query}`,
    auth,
  );
}

// GET /api/odds/updates/{fixtureId} returns recent StablePrice records.
export function getOddsUpdates(auth: TxlineAuth, fixtureId: number): Promise<Result<OddsRecord[]>> {
  return getJson<OddsRecord[]>(`/api/odds/updates/${fixtureId}`, auth);
}

// GET /api/odds/validation for a specific odds record (messageId + ts).
export function getOddsValidation(auth: TxlineAuth, messageId: string, ts: number): Promise<Result<OddsValidation>> {
  return getJson<OddsValidation>(
    `/api/odds/validation?messageId=${encodeURIComponent(messageId)}&ts=${ts}`,
    auth,
  );
}
