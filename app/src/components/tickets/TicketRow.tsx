"use client";

import { useState } from "react";
import Link from "next/link";
import { StatusPill } from "@/components/ui/StatusPill";
import { HashRow } from "@/components/ui/HashRow";
import { CopyButton } from "@/components/ui/CopyButton";
import { IconChevron } from "@/components/ui/Icon";
import { joinClassNames } from "@/lib/joinClassNames";
import { explorerTxUrl } from "@/lib/data/types";
import type { TicketView } from "@/lib/data/demoTickets";

type TicketRowProps = {
  ticket: TicketView;
  isOpen: boolean;
  onToggle: () => void;
  /** 40ms stagger step per row position in the list. */
  enterDelayMs: number;
};

function TicketStatusPill({ status }: { status: TicketView["status"] }) {
  if (status === "live") {
    return (
      <StatusPill variant="live" withDot>
        Live
      </StatusPill>
    );
  }
  if (status === "won") {
    return <StatusPill variant="accent">Verified on Solana</StatusPill>;
  }
  if (status === "refunded") {
    return <StatusPill variant="danger">Proven overcharge</StatusPill>;
  }
  return <StatusPill variant="neutral">Settled</StatusPill>;
}

/**
 * One ticket accordion row (v3 noir): title over subtitle left, the pill and
 * stake right, a chevron that rotates 180deg; the body expands by
 * grid-template-rows (never height) into the raised receipt panel. On the
 * refunded ticket the two danger pills land in sequence after the rows.
 */
export function TicketRow({
  ticket,
  isOpen,
  onToggle,
  enterDelayMs,
}: TicketRowProps) {
  // Remount the receipt content per expansion so its cascade replays.
  const [expandSequence, setExpandSequence] = useState(0);

  const handleToggle = () => {
    if (!isOpen) {
      setExpandSequence((currentSequence) => currentSequence + 1);
    }
    onToggle();
  };

  const rowCount = ticket.receiptRows.length;
  const enterDelayFor = (rowIndex: number) => `${rowIndex * 40}ms`;
  const pillBaseDelayMs = 600;

  return (
    <div
      className="animate-card-in"
      style={{ animationDelay: `${enterDelayMs}ms` }}
    >
      <button
        type="button"
        onClick={handleToggle}
        aria-expanded={isOpen}
        className="transition-press focus-ring flex w-full cursor-pointer flex-wrap items-center justify-between gap-4 rounded-sm border-0 bg-transparent px-3 py-3.5 text-left text-ink hover:bg-elevated"
      >
        <span className="min-w-0">
          <span className="block text-base font-medium">
            {ticket.fixtureLine}
          </span>
          <span className="mt-0.5 block text-sm tabular-nums text-ink-muted">
            {ticket.marketName} · {ticket.pickLabel} @ {ticket.oddsLabel}
          </span>
        </span>
        <span className="flex flex-none items-center gap-3.5">
          <TicketStatusPill status={ticket.status} />
          <span className="font-mono text-base tabular-nums text-ink">
            {ticket.stakeLabel}
          </span>
          <span
            aria-hidden="true"
            className={joinClassNames(
              "inline-flex text-ink-muted transition-transform duration-250 ease-standard",
              isOpen && "rotate-180",
            )}
          >
            <IconChevron />
          </span>
        </span>
      </button>

      <div
        className="grid transition-[grid-template-rows] duration-250 ease-standard"
        style={{ gridTemplateRows: isOpen ? "1fr" : "0fr" }}
      >
        <div className="overflow-hidden">
          <div
            key={expandSequence}
            className="mx-1 mb-3.5 mt-0.5 rounded-sm bg-elevated px-4.5 py-3"
          >
            {ticket.outcomeLine ? (
              <div
                className="flex animate-card-in items-center justify-between py-2"
                style={{ animationDelay: enterDelayFor(0) }}
              >
                <span className="text-sm text-ink-muted">Outcome</span>
                <span className="text-sm font-medium text-ink">
                  {ticket.outcomeLine}
                </span>
              </div>
            ) : null}
            {ticket.receiptRows.map((receiptRow, rowIndex) => (
              <div
                key={receiptRow.label}
                className="flex animate-card-in items-center justify-between py-2"
                style={{ animationDelay: enterDelayFor(rowIndex + 1) }}
              >
                <span className="text-sm text-ink-muted">
                  {receiptRow.label}
                </span>
                <span
                  className={joinClassNames(
                    "font-mono text-sm tabular-nums",
                    receiptRow.tone === "danger" ? "text-danger" : "text-ink",
                  )}
                >
                  {receiptRow.value}
                </span>
              </div>
            ))}
            <div
              className="animate-card-in py-2 font-mono text-xs tabular-nums text-ink-muted"
              style={{ animationDelay: enterDelayFor(rowCount + 1) }}
            >
              {ticket.priceLine}
            </div>

            <div
              className="animate-card-in pt-3 text-sm text-ink-muted"
              style={{ animationDelay: enterDelayFor(rowCount + 2) }}
            >
              {ticket.proof.kind === "priceOnly" ? "Price proof" : "Proof"}
            </div>
            {ticket.proof.kind === "priceOnly" ? (
              <div
                className="animate-card-in"
                style={{ animationDelay: enterDelayFor(rowCount + 3) }}
              >
                <HashRow label="Quote id" value={ticket.proof.quoteId} />
                <div className="flex flex-wrap items-center gap-4 py-2">
                  <a
                    href={ticket.proof.auditHref}
                    target="_blank"
                    rel="noreferrer"
                    className="focus-ring rounded-full px-1 py-1 text-sm font-medium text-accent no-underline hover:underline"
                  >
                    Audit this price
                  </a>
                </div>
                <p className="m-0 pb-1 text-xs leading-normal text-ink-faint">
                  {ticket.proof.note}
                </p>
              </div>
            ) : (
              <>
                <div
                  className="animate-card-in"
                  style={{ animationDelay: enterDelayFor(rowCount + 3) }}
                >
                  <HashRow
                    label="Day root"
                    value={ticket.proof.dayRoot}
                    href={explorerTxUrl(ticket.proof.verifyTx)}
                  />
                  {ticket.proof.merklePath ? (
                    <HashRow
                      label="Merkle path"
                      value={ticket.proof.merklePath}
                      href={explorerTxUrl(ticket.proof.verifyTx)}
                    />
                  ) : null}
                  <HashRow
                    label="Verify tx"
                    value={ticket.proof.verifyTx}
                    href={explorerTxUrl(ticket.proof.verifyTx)}
                  />
                </div>
                <div className="flex flex-wrap items-center justify-center gap-3 px-1 pb-1.5 pt-4">
                  {ticket.proof.stamp === "verified" ? (
                    <StatusPill
                      variant="accent"
                      animateIn
                      animateInDelayMs={pillBaseDelayMs}
                    >
                      Verified on Solana
                    </StatusPill>
                  ) : (
                    <>
                      <StatusPill
                        variant="danger"
                        animateIn
                        animateInDelayMs={pillBaseDelayMs}
                      >
                        Proven overcharge
                      </StatusPill>
                      <StatusPill
                        variant="danger"
                        animateIn
                        animateInDelayMs={pillBaseDelayMs + 160}
                      >
                        Refunded
                      </StatusPill>
                    </>
                  )}
                  <span className="flex items-center gap-2 text-sm font-medium text-accent">
                    <CopyButton
                      value={ticket.proof.receiptLink}
                      ariaLabel={`Copy receipt link for ${ticket.marketName}`}
                      surface="lift"
                    />
                    Receipt link
                  </span>
                  {ticket.proof.verifyPageHref ? (
                    <Link
                      href={ticket.proof.verifyPageHref}
                      className="focus-ring rounded-full px-1 py-1 text-sm font-medium text-accent no-underline hover:underline"
                    >
                      Public verify page
                    </Link>
                  ) : null}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
