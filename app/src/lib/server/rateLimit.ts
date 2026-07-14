/**
 * Minimal per-IP fixed-window rate limiter for the public API routes. The
 * map lives per serverless instance, so this is defense-in-depth against
 * naive request floods (each receipt assembly costs a dozen RPC and TxLINE
 * calls), not a hard global quota; the RPC provider's own limits remain the
 * backstop.
 */

/** Window length for request counting (one minute). */
const WINDOW_MS = 60_000;
/** Prune bookkeeping once the map holds this many distinct clients. */
const MAX_TRACKED_CLIENTS = 10_000;

const requestLog = new Map<string, number[]>();

/** The client key for a request: the first hop of x-forwarded-for. */
export function clientKeyFromRequest(request: Request): string {
  const forwardedFor = request.headers.get("x-forwarded-for") ?? "";
  const firstHop = forwardedFor.split(",")[0]?.trim() ?? "";
  return firstHop.length > 0 ? firstHop : "unknown";
}

/**
 * True when this client already made maxPerMinute requests in the current
 * window; otherwise records the request and lets it pass.
 */
export function isRateLimited(clientKey: string, maxPerMinute: number): boolean {
  const now = Date.now();
  const windowStart = now - WINDOW_MS;

  if (requestLog.size >= MAX_TRACKED_CLIENTS) {
    // Unbounded growth guard: drop all bookkeeping rather than leak memory.
    requestLog.clear();
  }

  const recentRequests = (requestLog.get(clientKey) ?? []).filter(
    (requestTs) => requestTs > windowStart,
  );
  if (recentRequests.length >= maxPerMinute) {
    requestLog.set(clientKey, recentRequests);
    return true;
  }
  recentRequests.push(now);
  requestLog.set(clientKey, recentRequests);
  return false;
}
