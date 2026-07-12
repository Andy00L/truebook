/**
 * Number and string formatting for TrueBook screens.
 * Conventions: odds at 2 decimals, USDC amounts at 2 decimals with digit
 * grouping, clocks as m:ss, 32-byte hashes truncated in the middle.
 */

/** 100.5 -> "100.50", 1234567.8 -> "1,234,567.80" */
export function formatAmount(amount: number): string {
  return amount.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/** Decimal odds always at two decimals: 2.06 -> "2.06" */
export function formatOdds(decimalOdds: number): string {
  return decimalOdds.toFixed(2);
}

/**
 * Odds stored in basis points of decimal odds (20600 -> "2.06").
 * sourceRef: program/programs/truebook/src/math.rs (odds_bps convention)
 */
export function formatOddsBps(oddsBps: number): string {
  return formatOdds(oddsBps / 10_000);
}

/** 4032 seconds -> "67:12" (match clock, minutes never padded) */
export function formatClock(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  return `${minutes}:${seconds}`;
}

/** Percentage of a basis-point margin: 200 -> "2.0%" */
export function formatMarginBps(marginBps: number): string {
  return `${(marginBps / 100).toFixed(1)}%`;
}

/** "France vs Spain", or the home label alone when the away side is unknown
 * (a chain fixture missing from the names table must not render "X vs "). */
export function formatMatchupLabel(homeTeam: string, awayTeam: string): string {
  return awayTeam ? `${homeTeam} vs ${awayTeam}` : homeTeam;
}

/** "4d2c70b8...101033" style middle truncation for hashes and signatures */
export function truncateMiddle(
  value: string,
  head: number = 6,
  tail: number = 6,
): string {
  if (value.length <= head + tail + 1) {
    return value;
  }
  return `${value.slice(0, head)}…${value.slice(-tail)}`;
}
