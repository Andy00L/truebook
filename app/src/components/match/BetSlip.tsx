"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { HashRow } from "@/components/ui/HashRow";
import { Stamp } from "@/components/ui/Stamp";
import { formatAmount, formatClock, formatOdds } from "@/lib/format";
import { DEMO_BET_TX, DEMO_QUOTE_ID } from "@/lib/data/demoFixtures";
import { explorerTxUrl } from "@/lib/data/types";

export type SlipQuote = {
  outcomeKey: string;
  marketName: string;
  outcomeLabel: string;
  servedOdds: number;
  consensusOdds: number;
  marginLabel: string;
};

type PlacementStatus = "pending" | "confirmed";

type BetSlipProps = {
  quote: SlipQuote;
  onClose: () => void;
  /** Re-snapshots the quote at the current served price. */
  onRefreshQuote: () => void;
};

/**
 * sourceRef: program/programs/truebook/src/constants.rs
 * (QUOTE_VALIDITY_SECONDS): a posted quote is placeable for 120 seconds.
 */
const QUOTE_VALIDITY_SECONDS = 120;
const DEMO_CONFIRM_MS = 1400;

/**
 * The bet slip: right drawer on wide screens, bottom sheet on narrow ones.
 * Demo placement flow; the chain provider will swap the fake confirm for a
 * real place_bet transaction without touching this layout.
 */
export function BetSlip({ quote, onClose, onRefreshQuote }: BetSlipProps) {
  const [stakeText, setStakeText] = useState("");
  const [quoteSecondsLeft, setQuoteSecondsLeft] = useState(
    QUOTE_VALIDITY_SECONDS,
  );
  const [placement, setPlacement] = useState<PlacementStatus | null>(null);
  const confirmTimerRef = useRef<number | null>(null);

  // Reset the countdown whenever a fresh quote snapshot arrives (the React
  // adjust-state-during-render pattern, no effect involved).
  const quoteIdentity = `${quote.outcomeKey}:${quote.servedOdds}`;
  const [lastQuoteIdentity, setLastQuoteIdentity] = useState(quoteIdentity);
  if (lastQuoteIdentity !== quoteIdentity) {
    setLastQuoteIdentity(quoteIdentity);
    setQuoteSecondsLeft(QUOTE_VALIDITY_SECONDS);
  }

  // Quote freshness countdown (browser timer).
  useEffect(() => {
    if (placement !== null) {
      return;
    }
    const countdownTimer = window.setInterval(() => {
      setQuoteSecondsLeft((secondsLeft) => Math.max(0, secondsLeft - 1));
    }, 1000);
    return () => window.clearInterval(countdownTimer);
  }, [placement]);

  // Escape closes the slip; window keyboard events live outside React.
  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

  // Demo confirmation timer cleanup (browser timer).
  useEffect(() => {
    return () => {
      if (confirmTimerRef.current !== null) {
        window.clearTimeout(confirmTimerRef.current);
      }
    };
  }, []);

  const stakeAmount = Number.parseFloat(stakeText) || 0;
  const potentialPayout = stakeAmount * quote.servedOdds;
  const isQuoteExpired = quoteSecondsLeft <= 0;
  const canPlaceBet = stakeAmount > 0 && !isQuoteExpired && placement === null;

  const handlePlaceBet = () => {
    if (!canPlaceBet) {
      return;
    }
    setPlacement("pending");
    confirmTimerRef.current = window.setTimeout(() => {
      setPlacement((currentStatus) =>
        currentStatus === "pending" ? "confirmed" : currentStatus,
      );
    }, DEMO_CONFIRM_MS);
  };

  return (
    <>
      <div
        className="fixed inset-0 z-50 animate-fade-in bg-scrim"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-label="Bet slip"
        className="fixed inset-x-0 bottom-0 z-60 max-h-[85dvh] animate-slip-up overflow-y-auto rounded-t-lg border-x border-t border-border bg-elevated p-5 text-ink shadow-elevated lg:inset-y-4 lg:bottom-auto lg:left-auto lg:right-4 lg:h-auto lg:max-h-none lg:w-100 lg:animate-slip-in lg:rounded-lg lg:border"
      >
        <div className="flex items-center justify-between">
          <span className="text-base font-semibold text-ink">Bet slip</span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close bet slip"
            className="focus-ring -my-3 -mr-3.5 flex size-11 cursor-pointer items-center justify-center rounded-sm border border-transparent bg-transparent text-lg text-ink-muted hover:text-ink"
          >
            ✕
          </button>
        </div>

        {placement === null ? (
          <>
            <div className="mt-4 rounded-md border border-border bg-surface p-4">
              <div className="flex items-baseline justify-between gap-3">
                <div>
                  <div className="text-xs text-ink-muted">
                    {quote.marketName}
                  </div>
                  <div className="mt-1 text-lg font-semibold text-ink">
                    {quote.outcomeLabel}
                  </div>
                </div>
                <span className="font-mono text-xl font-semibold tabular-nums text-ink">
                  {formatOdds(quote.servedOdds)}
                </span>
              </div>
              <div className="my-3 border-t border-dashed border-border" />
              {isQuoteExpired ? (
                <div className="flex items-center gap-3 font-mono text-xs">
                  <span className="text-danger">quote expired</span>
                  <button
                    type="button"
                    onClick={onRefreshQuote}
                    className="focus-ring -my-3.5 min-h-11 cursor-pointer rounded-sm border border-transparent bg-transparent px-1 font-mono text-xs text-accent hover:underline"
                  >
                    refresh quote
                  </button>
                </div>
              ) : (
                <div className="font-mono text-xs tabular-nums text-ink-muted">
                  quote valid {formatClock(quoteSecondsLeft)}
                </div>
              )}
            </div>

            <div className="mt-4">
              <label htmlFor="stake-input" className="eyebrow block text-ink-muted">
                Stake
              </label>
              <div className="relative mt-2">
                <input
                  id="stake-input"
                  type="text"
                  inputMode="decimal"
                  placeholder="0.00"
                  autoFocus
                  value={stakeText}
                  onChange={(changeEvent) =>
                    setStakeText(
                      changeEvent.target.value.replace(/[^0-9.]/g, ""),
                    )
                  }
                  className="focus-ring h-11 w-full rounded-sm border border-border bg-surface pl-3 pr-16 font-mono text-lg tabular-nums text-ink transition-press"
                />
                <span className="absolute right-3 top-0 flex h-11 items-center font-mono text-xs text-ink-muted">
                  USDC
                </span>
              </div>
            </div>

            <div className="mt-4 flex items-baseline justify-between">
              <span className="text-sm text-ink-muted">Potential payout</span>
              <span className="font-mono text-xl font-semibold tabular-nums text-ink">
                {formatAmount(potentialPayout)} USDC
              </span>
            </div>

            <Button
              variant="primary"
              size="lg"
              disabled={!canPlaceBet}
              onClick={handlePlaceBet}
              className="mt-4 w-full"
            >
              Place bet
            </Button>

            <p className="mt-3 font-mono text-2xs leading-relaxed tabular-nums text-ink-faint">
              consensus {formatOdds(quote.consensusOdds)} - margin{" "}
              {quote.marginLabel} = your price {formatOdds(quote.servedOdds)} ·
              auditable on chain
            </p>
          </>
        ) : (
          <>
            <div className="receipt-edge mt-4 animate-card-in rounded-md border border-border bg-surface p-4">
              <div className="eyebrow text-ink-faint">Bet receipt</div>
              <div className="mt-2.5">
                <div className="text-xs text-ink-muted">{quote.marketName}</div>
                <div className="mt-1 text-lg font-semibold text-ink">
                  {quote.outcomeLabel}
                </div>
              </div>
              <div className="mt-3 flex flex-col gap-2 font-mono text-sm tabular-nums">
                <div className="flex justify-between">
                  <span className="text-ink-muted">stake</span>
                  <span className="text-ink">
                    {formatAmount(stakeAmount)} USDC
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-ink-muted">odds</span>
                  <span className="text-ink">{formatOdds(quote.servedOdds)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-ink-muted">payout if won</span>
                  <span className="text-ink">
                    {formatAmount(potentialPayout)} USDC
                  </span>
                </div>
              </div>
              <div className="mb-2.5 mt-3.5 border-t border-dashed border-border" />
              <div className="flex flex-col gap-1">
                <HashRow
                  label="quote id"
                  value={DEMO_QUOTE_ID}
                  labelWidthClass="w-20"
                />
                <HashRow
                  label="bet tx"
                  value={DEMO_BET_TX}
                  href={explorerTxUrl(DEMO_BET_TX)}
                  labelWidthClass="w-20"
                />
              </div>
              <div className="mt-3.5 flex min-h-8 items-center">
                {placement === "pending" ? (
                  <span className="flex items-center gap-2 font-mono text-xs text-ink-muted">
                    <span className="size-1.5 animate-confirm-dot rounded-sm bg-ink-muted" />
                    confirming on Solana…
                  </span>
                ) : (
                  <span className="animate-fade-in">
                    <Stamp tone="accent">VERIFIED ON SOLANA</Stamp>
                  </span>
                )}
              </div>
              <p className="mt-3 text-xs leading-relaxed text-ink-faint">
                Settlement proof attaches to this receipt after the match.
              </p>
            </div>
            <Button onClick={onClose} size="lg" className="mt-4 w-full">
              Done
            </Button>
          </>
        )}
      </div>
    </>
  );
}
