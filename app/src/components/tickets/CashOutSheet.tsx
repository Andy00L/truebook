"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/Button";
import { StatusPill } from "@/components/ui/StatusPill";
import { OdometerNumber } from "@/components/ui/OdometerNumber";
import { CopyButton } from "@/components/ui/CopyButton";
import {
  CircleIconButton,
  CircleIconLink,
  IconClose,
  IconLink,
} from "@/components/ui/Icon";
import { formatAmount, formatClock, truncateMiddle } from "@/lib/format";
import { explorerTxUrl, type CashOutOffer, type TicketView } from "@/lib/data/types";
import type { ChainActionResult, ChainStage } from "@/lib/chain/placeBet";

type CashOutSheetProps = {
  ticket: TicketView;
  offer: CashOutOffer;
  onClose: () => void;
  /** Signs and sends the real cash_out_ticket transaction. */
  onCashOut: (
    offer: CashOutOffer,
    onStage: (stage: ChainStage) => void,
  ) => Promise<ChainActionResult>;
  /** Called once a cash-out confirmed, so the ticket list refreshes. */
  onCompleted: () => void;
};

/**
 * The cash-out sheet (v3 noir): the vault's standing offer for a live
 * ticket, with the full pricing equation in the open. The offer is priced
 * ON-CHAIN from the market's current quote (payout weighted by the
 * complement of the opposite side's implied probability), so what this sheet
 * shows is what the program pays, and the quote it derives from is auditable
 * via validate_odds like any opening price.
 */
export function CashOutSheet({
  ticket,
  offer,
  onClose,
  onCashOut,
  onCompleted,
}: CashOutSheetProps) {
  const [quoteSecondsLeft, setQuoteSecondsLeft] = useState(offer.quoteSecondsLeft);
  const [isPending, setIsPending] = useState(false);
  const [chainStage, setChainStage] = useState<ChainStage | null>(null);
  const [cashOutSignature, setCashOutSignature] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Quote freshness countdown (browser timer), frozen once confirmed.
  useEffect(() => {
    if (cashOutSignature !== null) {
      return;
    }
    const countdownTimer = window.setInterval(() => {
      setQuoteSecondsLeft((secondsLeft) => Math.max(0, secondsLeft - 1));
    }, 1000);
    return () => window.clearInterval(countdownTimer);
  }, [cashOutSignature]);

  // Escape closes the sheet; window keyboard events live outside React.
  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

  const isQuoteExpired = quoteSecondsLeft <= 0;
  const canCashOut = !isQuoteExpired && !isPending && cashOutSignature === null;
  const keptPct = 100 - offer.oppositeImpliedPct;

  const handleCashOut = async () => {
    if (!canCashOut) {
      return;
    }
    setErrorMessage(null);
    setIsPending(true);
    const result = await onCashOut(offer, setChainStage);
    setChainStage(null);
    setIsPending(false);
    if (result.ok) {
      setCashOutSignature(result.signature);
      onCompleted();
    } else {
      setErrorMessage(result.reason);
    }
  };

  // A portal to <body>: the sheet opens from inside ticket rows whose
  // card-in animation would otherwise trap these fixed layers.
  return createPortal(
    <>
      <div
        className="fixed inset-0 z-50 animate-fade-in bg-scrim"
        onClick={onClose}
        role="presentation"
      />
      <div
        role="dialog"
        aria-label="Cash out ticket"
        className="fixed inset-x-0 bottom-0 z-60 max-h-[85dvh] animate-slip-up overflow-y-auto rounded-t-md bg-surface p-6 text-ink shadow-panel lg:inset-y-3 lg:bottom-auto lg:left-auto lg:right-3 lg:h-auto lg:max-h-none lg:w-100 lg:animate-slip-in lg:rounded-md"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-sm text-ink-muted">Cash out</div>
            <div className="mt-1 text-lg font-medium tabular-nums text-ink">
              {ticket.marketName} · {ticket.pickLabel}
            </div>
          </div>
          <CircleIconButton ariaLabel="Close cash out" onClick={onClose}>
            <IconClose />
          </CircleIconButton>
        </div>

        {cashOutSignature === null ? (
          <>
            <div className="mt-6">
              <div className="text-sm text-ink-muted">The vault pays now</div>
              <div className="mt-1.5 flex items-baseline text-2xl font-light tabular-nums leading-tight tracking-tight text-ink">
                <OdometerNumber value={formatAmount(offer.offerAmount)} />
                <span className="ml-2 text-lg font-light text-ink-muted">USDT</span>
              </div>
            </div>

            <div className="mt-4.5 rounded-sm bg-elevated px-4.5 py-3.5">
              {[
                {
                  label: "Payout if won",
                  value: `${formatAmount(offer.payoutAmount)} USDT`,
                },
                {
                  label: "Opposite side served at",
                  value: `${offer.oppositeOddsLabel} (${offer.oppositeImpliedPct.toFixed(1)}%)`,
                },
                {
                  label: "Your side keeps",
                  value: `${keptPct.toFixed(1)}%`,
                },
              ].map((equationRow) => (
                <div
                  key={equationRow.label}
                  className="flex items-center justify-between py-1.5"
                >
                  <span className="text-sm text-ink-muted">{equationRow.label}</span>
                  <span className="font-mono text-sm tabular-nums text-ink">
                    {equationRow.value}
                  </span>
                </div>
              ))}
              <div className="mt-1.5 border-t border-border pt-2.5 font-mono text-xs tabular-nums text-ink-muted">
                {formatAmount(offer.payoutAmount)} × {keptPct.toFixed(1)}% ={" "}
                {formatAmount(offer.offerAmount)} USDT
              </div>
            </div>

            <p className="mb-0 mt-3.5 text-xs leading-normal text-ink-faint">
              Priced on-chain from the live consensus quote. The receipt keeps
              the quote id, so a lowballed cash-out can be proven and repaid,
              and the prover earns 5% of the stake.
            </p>

            <div className="mt-4 flex items-center justify-between">
              {isQuoteExpired ? (
                <span className="text-sm font-medium text-danger">
                  Quote expired. The next keeper tick reprices it; reopen then.
                </span>
              ) : (
                <>
                  <span className="text-sm text-ink-muted">Offer valid</span>
                  <OdometerNumber
                    value={formatClock(quoteSecondsLeft)}
                    className="font-mono text-sm tabular-nums text-ink"
                  />
                </>
              )}
            </div>

            {errorMessage ? (
              <div
                role="alert"
                className="mt-4 rounded-sm border border-danger bg-danger-soft px-4 py-3.5"
              >
                <div className="text-sm leading-normal text-ink">
                  {errorMessage.length > 160
                    ? `${errorMessage.slice(0, 160)}…`
                    : errorMessage}
                </div>
                <Button onClick={handleCashOut} className="mt-2.5">
                  Retry
                </Button>
              </div>
            ) : null}

            <Button
              variant="primary"
              size="lg"
              disabled={!canCashOut}
              onClick={handleCashOut}
              className="mt-5 w-full gap-2"
            >
              {isPending ? (
                <>
                  <span
                    aria-hidden="true"
                    className="relative inline-block size-4 animate-spin-dot"
                  >
                    <span className="absolute left-1/2 top-0 -ml-[3px] size-1.5 rounded-full bg-current" />
                  </span>
                  {chainStage === "signing"
                    ? "Approve in wallet..."
                    : chainStage === "confirming"
                      ? "Confirming on Solana..."
                      : "Preparing..."}
                </>
              ) : (
                `Cash out ${formatAmount(offer.offerAmount)} USDT`
              )}
            </Button>
            <Button onClick={onClose} size="lg" className="mt-2.5 w-full">
              Keep the ticket
            </Button>
          </>
        ) : (
          <>
            <div className="mt-4">
              {[
                {
                  label: "Received",
                  value: `${formatAmount(offer.offerAmount)} USDT`,
                },
                { label: "Ticket", value: truncateMiddle(offer.ticketAddress) },
              ].map((receiptRow, rowIndex) => (
                <div
                  key={receiptRow.label}
                  className="flex animate-card-in items-center justify-between py-3"
                  style={{ animationDelay: `${rowIndex * 40}ms` }}
                >
                  <span className="text-sm text-ink-muted">{receiptRow.label}</span>
                  <span className="font-mono text-sm tabular-nums text-ink">
                    {receiptRow.value}
                  </span>
                </div>
              ))}
              <div
                className="flex animate-card-in items-center justify-between py-1.5"
                style={{ animationDelay: "80ms" }}
              >
                <span className="text-sm text-ink-muted">Cash-out tx</span>
                <span className="flex items-center gap-2.5">
                  <span
                    title={cashOutSignature}
                    className="font-mono text-xs tabular-nums text-ink"
                  >
                    {truncateMiddle(cashOutSignature)}
                  </span>
                  <CopyButton
                    value={cashOutSignature}
                    ariaLabel="Copy the cash-out transaction signature"
                  />
                  <CircleIconLink
                    href={explorerTxUrl(cashOutSignature)}
                    ariaLabel="Open the cash-out transaction in Solana Explorer"
                  >
                    <IconLink />
                  </CircleIconLink>
                </span>
              </div>
              <div className="mt-5 flex min-h-8 justify-center">
                <StatusPill variant="accent" animateIn animateInDelayMs={420}>
                  Cashed out on Solana
                </StatusPill>
              </div>
              <p className="mb-0 mt-3 text-center text-xs leading-normal text-ink-faint">
                The receipt keeps the quote this price derived from; anyone can
                audit it against TxLINE consensus.
              </p>
            </div>
            <Button onClick={onClose} size="lg" className="mt-4 w-full">
              Done
            </Button>
          </>
        )}
      </div>
    </>,
    document.body,
  );
}
