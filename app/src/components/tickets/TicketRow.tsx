"use client";

import { SurfaceCard } from "@/components/ui/SurfaceCard";
import { StatusPill } from "@/components/ui/StatusPill";
import { Stamp } from "@/components/ui/Stamp";
import { HashRow } from "@/components/ui/HashRow";
import { CopyButton } from "@/components/ui/CopyButton";
import { joinClassNames } from "@/lib/joinClassNames";
import { explorerTxUrl } from "@/lib/data/types";
import type { TicketView } from "@/lib/data/demoTickets";
import Link from "next/link";

type TicketRowProps = {
  ticket: TicketView;
  isOpen: boolean;
  onToggle: () => void;
  /** 40ms stagger step per row position in the list. */
  enterDelayMs: number;
};

function TicketStatusCell({ status }: { status: TicketView["status"] }) {
  if (status === "live") {
    return (
      <StatusPill variant="live" withDot>
        LIVE
      </StatusPill>
    );
  }
  const statusClasses =
    status === "won"
      ? "text-accent"
      : status === "refunded"
        ? "text-danger"
        : "text-ink-muted";
  return (
    <span className={joinClassNames("eyebrow font-mono", statusClasses)}>
      {status === "refunded" ? "REFUNDED" : status.toUpperCase()}
    </span>
  );
}

/** One ticket accordion row: summary columns plus the expanded receipt. */
export function TicketRow({
  ticket,
  isOpen,
  onToggle,
  enterDelayMs,
}: TicketRowProps) {
  return (
    <SurfaceCard
      className="animate-card-in overflow-hidden"
      style={{ animationDelay: `${enterDelayMs}ms` }}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={isOpen}
        className="flex min-h-11 w-full cursor-pointer flex-wrap items-center gap-5 bg-transparent px-4 py-3.5 text-left hover:bg-elevated focus-visible:shadow-[inset_0_0_0_2px_var(--color-accent-soft)] focus-visible:outline-none"
      >
        <div className="min-w-55 flex-1 basis-60">
          <div className="text-base font-semibold text-ink">
            {ticket.marketName} · {ticket.pickLabel}
          </div>
          <div className="mt-0.5 text-xs text-ink-faint">
            {ticket.fixtureLine}
          </div>
        </div>
        <div className="w-22">
          <div className="eyebrow text-ink-faint">stake</div>
          <div className="mt-0.5 font-mono text-base tabular-nums text-ink">
            {ticket.stakeLabel}
          </div>
        </div>
        <div className="w-18">
          <div className="eyebrow text-ink-faint">odds</div>
          <div className="mt-0.5 font-mono text-base tabular-nums text-ink">
            {ticket.oddsLabel}
          </div>
        </div>
        <div className="w-28">
          <div className="eyebrow text-ink-faint">
            {ticket.amountColumnTitle}
          </div>
          <div className="mt-0.5 font-mono text-base tabular-nums text-ink">
            {ticket.amountLabel}
          </div>
        </div>
        <div className="w-28">
          <TicketStatusCell status={ticket.status} />
        </div>
        <span
          aria-hidden="true"
          className={joinClassNames(
            "ml-auto inline-block text-xs text-ink-faint transition-transform duration-200 ease-enter",
            isOpen ? "rotate-0" : "-rotate-90",
          )}
        >
          ▾
        </span>
      </button>

      {isOpen ? (
        <div className="flex animate-fade-in flex-wrap gap-8 border-t border-dashed border-border bg-elevated p-5">
          <div className="min-w-60 flex-1 basis-65">
            <div className="eyebrow text-ink-faint">{ticket.receiptTitle}</div>
            {ticket.outcomeLine ? (
              <div className="mt-3 flex justify-between text-sm">
                <span className="text-ink-muted">outcome</span>
                <span className="font-semibold text-ink">
                  {ticket.outcomeLine}
                </span>
              </div>
            ) : null}
            <div className="mt-2 flex flex-col gap-2 font-mono text-sm tabular-nums">
              {ticket.receiptRows.map((receiptRow) => (
                <div key={receiptRow.label} className="flex justify-between">
                  <span className="text-ink-muted">{receiptRow.label}</span>
                  <span
                    className={
                      receiptRow.tone === "danger" ? "text-danger" : "text-ink"
                    }
                  >
                    {receiptRow.value}
                  </span>
                </div>
              ))}
            </div>
            <p className="mt-3 font-mono text-xs tabular-nums text-ink-faint">
              {ticket.priceLine}
            </p>
          </div>

          <div className="min-w-65 flex-1 basis-75">
            <div className="eyebrow text-ink-faint">
              {ticket.proof.kind === "priceOnly" ? "Price proof" : "Proof block"}
            </div>

            {ticket.proof.kind === "priceOnly" ? (
              <>
                <div className="mt-3">
                  <HashRow
                    label="quote id"
                    value={ticket.proof.quoteId}
                    labelWidthClass="w-20"
                  />
                </div>
                <div className="mt-4 flex flex-wrap items-center gap-4">
                  <a
                    href={ticket.proof.auditHref}
                    target="_blank"
                    rel="noreferrer"
                    className="eyebrow focus-ring inline-flex h-8 items-center gap-2 rounded-sm border border-accent px-3 font-mono text-accent no-underline hover:bg-accent-soft"
                  >
                    AUDIT THIS PRICE ↗
                  </a>
                </div>
                <p className="mt-3 text-xs leading-normal text-ink-faint">
                  {ticket.proof.note}
                </p>
              </>
            ) : (
              <>
                <div className="mt-2 flex flex-col gap-1">
                  <HashRow
                    label="day root"
                    value={ticket.proof.dayRoot}
                    href={explorerTxUrl(ticket.proof.verifyTx)}
                  />
                  {ticket.proof.merklePath ? (
                    <HashRow
                      label="merkle path"
                      value={ticket.proof.merklePath}
                      href={explorerTxUrl(ticket.proof.verifyTx)}
                    />
                  ) : null}
                  <HashRow
                    label="verify tx"
                    value={ticket.proof.verifyTx}
                    href={explorerTxUrl(ticket.proof.verifyTx)}
                  />
                </div>
                <div className="mt-3.5 flex flex-wrap items-center gap-4">
                  {ticket.proof.stamp === "verified" ? (
                    <Stamp tone="accent">VERIFIED ON SOLANA</Stamp>
                  ) : (
                    <Stamp tone="danger">PROVEN OVERCHARGE</Stamp>
                  )}
                  <span className="flex items-center gap-1 font-mono text-xs text-accent">
                    <CopyButton
                      value={ticket.proof.receiptLink}
                      ariaLabel={`Copy receipt link for ${ticket.marketName}`}
                    />
                    receipt link
                  </span>
                  {ticket.proof.verifyPageHref ? (
                    <Link
                      href={ticket.proof.verifyPageHref}
                      className="focus-ring rounded-sm border border-transparent px-1 py-3 font-mono text-xs text-accent no-underline hover:underline"
                    >
                      public verify page →
                    </Link>
                  ) : null}
                </div>
              </>
            )}
          </div>
        </div>
      ) : null}
    </SurfaceCard>
  );
}
