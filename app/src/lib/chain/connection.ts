/**
 * One devnet Connection recipe for every browser chain call. The public
 * devnet RPC rate-limits aggressively; retrying 429s silently is what made
 * flows look frozen, so rate-limit failures surface immediately and every
 * stage of a wallet flow runs under a deadline. No UI may spin forever.
 */

import { Connection } from "@solana/web3.js";
import { DEVNET_RPC_URL } from "@truebook/shared/config";

/** RPC reads answer in about a second on devnet; 15s means it is down. */
export const RPC_READ_TIMEOUT_MS = 15_000;
/** The wallet prompt is human-paced; past 90s the prompt is considered lost. */
export const WALLET_SIGNATURE_TIMEOUT_MS = 90_000;
/** Devnet confirms in seconds; after 60s the transaction outcome is unknown. */
export const CONFIRM_TIMEOUT_MS = 60_000;

export function createDevnetConnection(): Connection {
  return new Connection(DEVNET_RPC_URL, {
    commitment: "confirmed",
    // Fail fast on 429 so the caller can show a distinct rate-limit error
    // instead of web3.js retrying in the background with no feedback.
    disableRetryOnRateLimit: true,
  });
}

/**
 * Deadline wrapper for one chain stage. On timeout it throws the stage's own
 * message, so the top-level catch of the action returns an error value that
 * names exactly which stage stalled.
 */
export async function withDeadline<T>(
  work: Promise<T>,
  timeoutMs: number,
  timeoutMessage: string,
): Promise<T> {
  let timeoutHandle: ReturnType<typeof setTimeout> | null = null;
  const deadline = new Promise<never>((resolveNever, rejectDeadline) => {
    timeoutHandle = setTimeout(
      () => rejectDeadline(new Error(timeoutMessage)),
      timeoutMs,
    );
  });
  try {
    return await Promise.race([work, deadline]);
  } finally {
    if (timeoutHandle !== null) {
      clearTimeout(timeoutHandle);
    }
  }
}
