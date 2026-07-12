"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { StatusPill } from "@/components/ui/StatusPill";
import { OdometerNumber } from "@/components/ui/OdometerNumber";
import { PriceEquation } from "@/components/ui/PriceEquation";
import { CopyButton } from "@/components/ui/CopyButton";
import {
  CircleIconButton,
  CircleIconLink,
  IconClose,
  IconLink,
} from "@/components/ui/Icon";
import { truncateMiddle, formatAmount, formatClock, formatOdds } from "@/lib/format";
import { DEMO_BET_TX, DEMO_QUOTE_ID } from "@/lib/data/demoFixtures";
import { explorerTxUrl } from "@/lib/data/types";
import type { ChainStage } from "@/lib/chain/placeBet";

export type SlipQuote = {
  outcomeKey: string;
  marketName: string;
  outcomeLabel: string;
  servedOdds: number;
  consensusOdds: number;
  marginLabel: string;
  /** Present when the quote comes from a live devnet market. */
  marketAddress?: string;
  side?: "yes" | "no";
};

export type PlaceBetResult =
  | { ok: true; signature: string }
  | { ok: false; reason: string };

type PlacementStatus = "pending" | "confirmed";

type BetSlipProps = {
  quote: SlipQuote;
  onClose: () => void;
  /** Re-snapshots the quote at the current served price. */
  onRefreshQuote: () => void;
  /** Token label for the active source: "USDT" on chain, "USDC" in demo. */
  currencyLabel: string;
  /** Real on-chain placement; when absent the slip runs the demo flow. */
  onPlaceBet?: (
    stakeAmount: number,
    onStage: (stage: ChainStage) => void,
  ) => Promise<PlaceBetResult>;
};

/**
 * sourceRef: program/programs/truebook/src/constants.rs
 * (QUOTE_VALIDITY_SECONDS): a posted quote is placeable for 120 seconds.
 */
const QUOTE_VALIDITY_SECONDS = 120;
const DEMO_CONFIRM_MS = 1400;

/**
 * The bet slip (v3 noir): a right drawer on wide screens, a bottom sheet on
 * narrow ones. Runs the demo confirm when onPlaceBet is absent, or a real
 * place_bet transaction when the chain source supplies it, same layout.
 * On confirm the receipt rows cascade in, the payout rolls (odometer), and
 * the VERIFIED ON SOLANA pill lands last, alone.
 */
export function BetSlip({
  quote,
  onClose,
  onRefreshQuote,
  currencyLabel,
  onPlaceBet,
}: BetSlipProps) {
  const [stakeText, setStakeText] = useState("");
  const [quoteSecondsLeft, setQuoteSecondsLeft] = useState(
    QUOTE_VALIDITY_SECONDS,
  );
  const [placement, setPlacement] = useState<PlacementStatus | null>(null);
  const [chainStage, setChainStage] = useState<ChainStage | null>(null);
  const [betSignature, setBetSignature] = useState<string | null>(null);
  const [placeError, setPlaceError] = useState<string | null>(null);
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

  const handlePlaceBet = async () => {
    if (!canPlaceBet) {
      return;
    }
    setPlaceError(null);
    setPlacement("pending");
    if (!onPlaceBet) {
      confirmTimerRef.current = window.setTimeout(() => {
        setPlacement((currentStatus) =>
          currentStatus === "pending" ? "confirmed" : currentStatus,
        );
      }, DEMO_CONFIRM_MS);
      return;
    }
    const placeResult = await onPlaceBet(stakeAmount, setChainStage);
    setChainStage(null);
    if (placeResult.ok) {
      setBetSignature(placeResult.signature);
      setPlacement("confirmed");
    } else {
      setPlacement(null);
      setPlaceError(placeResult.reason);
    }
  };

  // The demo hash never stands in for a live transaction: on chain the row
  // shows a pending placeholder until the real signature lands.
  const receiptTx = betSignature ?? (onPlaceBet ? null : DEMO_BET_TX);

  return (
    <>
      <div
        className="fixed inset-0 z-50 animate-fade-in bg-scrim"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-label="Bet slip"
        className="fixed inset-x-0 bottom-0 z-60 max-h-[85dvh] animate-slip-up overflow-y-auto rounded-t-md bg-surface p-6 text-ink shadow-panel lg:inset-y-3 lg:bottom-auto lg:left-auto lg:right-3 lg:h-auto lg:max-h-none lg:w-100 lg:animate-slip-in lg:rounded-md"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-sm text-ink-muted">{quote.marketName}</div>
            <div className="mt-1 text-lg font-medium tabular-nums text-ink">
              {quote.outcomeLabel} @ {formatOdds(quote.servedOdds)}
            </div>
          </div>
          <CircleIconButton ariaLabel="Close bet slip" onClick={onClose}>
            <IconClose />
          </CircleIconButton>
        </div>

        {placement === null ? (
          <>
            <div className="mt-6">
              <label htmlFor="stake-input" className="block text-sm text-ink-muted">
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
                  className="focus-ring h-12 w-full rounded-sm border-0 bg-elevated pl-3.5 pr-16 font-mono text-base tabular-nums text-ink"
                />
                <span className="absolute right-3.5 top-0 flex h-12 items-center font-mono text-xs text-ink-muted">
                  {currencyLabel}
                </span>
              </div>
            </div>

            <div className="mt-4.5 flex items-center justify-between">
              {isQuoteExpired ? (
                <>
                  <span className="text-sm font-medium text-danger">
                    Quote expired
                  </span>
                  <button
                    type="button"
                    onClick={onRefreshQuote}
                    className="focus-ring cursor-pointer rounded-full border-0 bg-transparent px-1 py-1 text-sm font-medium text-accent"
                  >
                    Refresh quote
                  </button>
                </>
              ) : (
                <>
                  <span className="text-sm text-ink-muted">Quote valid</span>
                  <OdometerNumber
                    value={formatClock(quoteSecondsLeft)}
                    className="font-mono text-sm tabular-nums text-ink"
                  />
                </>
              )}
            </div>

            <div className="mt-5">
              <div className="text-sm text-ink-muted">Potential payout</div>
              <div className="mt-1.5 flex items-baseline text-2xl font-light tabular-nums leading-tight tracking-tight text-ink">
                <OdometerNumber value={formatAmount(potentialPayout)} />
                <span className="ml-2 text-lg font-light text-ink-muted">
                  {currencyLabel}
                </span>
              </div>
            </div>

            <div className="mt-3.5">
              <PriceEquation
                consensusLabel={formatOdds(quote.consensusOdds)}
                marginLabel={quote.marginLabel}
                servedLabel={formatOdds(quote.servedOdds)}
              />
            </div>

            {placeError ? (
              <div
                role="alert"
                className="mt-4.5 rounded-sm border border-danger bg-danger-soft px-4 py-3.5"
              >
                <div className="text-sm leading-normal text-ink">
                  {placeError.length > 160
                    ? `${placeError.slice(0, 160)}…`
                    : placeError}
                </div>
                <Button onClick={handlePlaceBet} className="mt-2.5">
                  Retry
                </Button>
              </div>
            ) : null}

            <Button
              variant="primary"
              size="lg"
              disabled={!canPlaceBet}
              onClick={handlePlaceBet}
              className="mt-5.5 w-full"
            >
              Place bet
            </Button>
            <div className="mt-3.5 text-center">
              <a
                href="/tickets"
                className="focus-ring rounded-full px-2 py-1 text-sm font-medium text-accent no-underline hover:underline"
              >
                Audit this price
              </a>
            </div>
          </>
        ) : (
          <>
            <div className="mt-4">
              {[
                { label: "Stake", value: `${formatAmount(stakeAmount)} ${currencyLabel}` },
                { label: "Odds", value: formatOdds(quote.servedOdds) },
              ].map((receiptRow, rowIndex) => (
                <div
                  key={receiptRow.label}
                  className="flex animate-card-in items-center justify-between py-3"
                  style={{ animationDelay: `${rowIndex * 40}ms` }}
                >
                  <span className="text-sm text-ink-muted">
                    {receiptRow.label}
                  </span>
                  <span className="font-mono text-sm tabular-nums text-ink">
                    {receiptRow.value}
                  </span>
                </div>
              ))}
              <div
                className="flex animate-card-in items-center justify-between py-3"
                style={{ animationDelay: "80ms" }}
              >
                <span className="text-sm text-ink-muted">Payout if won</span>
                <span className="flex items-baseline gap-1.5 font-mono text-base font-medium tabular-nums text-ink">
                  <OdometerNumber
                    value={formatAmount(potentialPayout)}
                    rollOnMount
                    mountDelayMs={200}
                  />
                  <span className="text-xs font-normal text-ink-muted">
                    {currencyLabel}
                  </span>
                </span>
              </div>
              <div className="my-2 border-t border-border" />
              <div
                className="flex animate-card-in items-center justify-between py-3"
                style={{ animationDelay: "120ms" }}
              >
                <span className="text-sm text-ink-muted">
                  {quote.marketAddress ? "Market" : "Quote id"}
                </span>
                <span
                  title={quote.marketAddress ?? DEMO_QUOTE_ID}
                  className="font-mono text-xs tabular-nums text-ink"
                >
                  {truncateMiddle(quote.marketAddress ?? DEMO_QUOTE_ID)}
                </span>
              </div>
              <div
                className="flex animate-card-in items-center justify-between py-1.5"
                style={{ animationDelay: "160ms" }}
              >
                <span className="text-sm text-ink-muted">Bet tx</span>
                {receiptTx === null ? (
                  <span className="font-mono text-xs text-ink-faint">
                    pending…
                  </span>
                ) : (
                  <span className="flex items-center gap-2.5">
                    <span
                      title={receiptTx}
                      className="font-mono text-xs tabular-nums text-ink"
                    >
                      {truncateMiddle(receiptTx)}
                    </span>
                    <CopyButton
                      value={receiptTx}
                      ariaLabel="Copy the bet transaction signature"
                    />
                    {betSignature ? (
                      <CircleIconLink
                        href={explorerTxUrl(betSignature)}
                        ariaLabel="Open the bet transaction in Solana Explorer"
                      >
                        <IconLink />
                      </CircleIconLink>
                    ) : null}
                  </span>
                )}
              </div>
              <div className="mt-5 flex min-h-8 justify-center">
                {placement === "pending" ? (
                  <span className="flex items-center gap-2.5 text-sm text-ink-muted">
                    <span
                      aria-hidden="true"
                      className="relative inline-block size-4 animate-spin-dot"
                    >
                      <span className="absolute left-1/2 top-0 -ml-[3px] size-1.5 rounded-full bg-current" />
                    </span>
                    {onPlaceBet
                      ? chainStage === "signing"
                        ? "Approve the transaction in your wallet"
                        : chainStage === "confirming"
                          ? "Confirming on Solana"
                          : "Preparing the transaction"
                      : "Confirming on Solana"}
                  </span>
                ) : (
                  <StatusPill variant="accent" animateIn animateInDelayMs={620}>
                    Verified on Solana
                  </StatusPill>
                )}
              </div>
              <p className="mb-0 mt-3 text-center text-xs leading-normal text-ink-faint">
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
