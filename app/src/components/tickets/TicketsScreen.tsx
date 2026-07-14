"use client";

import { useState } from "react";
import Link from "next/link";
import { useAnchorWallet, useWallet } from "@solana/wallet-adapter-react";
import { PageShell } from "@/components/ui/PageShell";
import { TopBar } from "@/components/ui/TopBar";
import { SurfaceCard } from "@/components/ui/SurfaceCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorPanel } from "@/components/ui/ErrorPanel";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { ConnectWalletButton } from "@/components/wallet/ConnectWalletButton";
import { TicketRow } from "@/components/tickets/TicketRow";
import { TicketsSkeleton } from "@/components/tickets/TicketsSkeleton";
import { CashOutSheet } from "@/components/tickets/CashOutSheet";
import { AuditPanel } from "@/components/tickets/AuditPanel";
import { DownloadReceiptButton } from "@/components/tickets/DownloadReceiptButton";
import {
  DEMO_TICKETS,
  filterTickets,
  type TicketFilter,
} from "@/lib/data/demoTickets";
import { useChainTickets } from "@/lib/chain/useChainTickets";
import { cashOutTicketOnChain } from "@/lib/chain/cashOut";
import {
  auditCashOutOnChain,
  auditTicketOnChain,
  refundTicketOnChain,
  type AuditResult,
} from "@/lib/chain/audit";
import type { CashOutOffer, TicketView } from "@/lib/data/types";
import type { ChainActionResult, ChainStage } from "@/lib/chain/placeBet";

/** Chain tickets that expose the live "Audit & earn" flow in their receipt. */
const AUDITABLE_STATUSES: ReadonlyArray<TicketView["status"]> = [
  "live",
  "lost",
  "won",
  "cashedOut",
];

const WALLET_CANNOT_SIGN =
  "The connected wallet cannot sign transactions here. Connect Phantom or Solflare instead.";

export type TicketsScreenView = "tickets" | "loading" | "empty" | "error";

export type TicketsDataSource = "demo" | "chain";

const FILTER_LABELS: ReadonlyArray<{ key: TicketFilter; label: string }> = [
  { key: "all", label: "All" },
  { key: "live", label: "Live" },
  { key: "won", label: "Won" },
  { key: "lost", label: "Lost" },
  { key: "refundable", label: "Refunded" },
];

const CASHED_OUT_FILTER = { key: "cashedOut", label: "Cashed out" } as const;

type TicketsScreenProps = {
  initialView: TicketsScreenView;
  /** Demo book, or the connected wallet's devnet tickets. */
  dataSource: TicketsDataSource;
};

/** The bettor's tickets: accordion rows opening into on-chain receipts. */
export function TicketsScreen({ initialView, dataSource }: TicketsScreenProps) {
  const isChainSource = dataSource === "chain";
  const [view, setView] = useState<TicketsScreenView>(initialView);
  const [activeFilter, setActiveFilter] = useState<TicketFilter>("all");
  const [openTicketId, setOpenTicketId] = useState<string | null>(
    isChainSource ? null : "ticket-homewin-won",
  );
  const [cashOutTicket, setCashOutTicket] = useState<TicketView | null>(null);

  const { publicKey } = useWallet();
  const anchorWallet = useAnchorWallet();
  const ownerBase58 = publicKey ? publicKey.toBase58() : null;
  const chainTickets = useChainTickets(isChainSource, ownerBase58);

  const tickets: ReadonlyArray<TicketView> = isChainSource
    ? chainTickets.state.status === "ready"
      ? chainTickets.state.tickets
      : []
    : DEMO_TICKETS;

  const filterOptions = isChainSource
    ? [...FILTER_LABELS, CASHED_OUT_FILTER]
    : FILTER_LABELS;
  const visibleTickets = filterTickets(tickets, activeFilter);
  const liveCount = filterTickets(tickets, "live").length;

  const handleChainCashOut = async (
    offer: CashOutOffer,
    onStage: (stage: ChainStage) => void,
  ): Promise<ChainActionResult> => {
    if (!anchorWallet) {
      return { ok: false, reason: WALLET_CANNOT_SIGN };
    }
    return cashOutTicketOnChain(
      anchorWallet,
      offer.ticketAddress,
      offer.marketAddress,
      onStage,
    );
  };

  const handleAudit = async (
    picked: TicketView,
    onStage: (stage: ChainStage) => void,
  ): Promise<AuditResult> => {
    if (!anchorWallet) {
      return { ok: false, reason: WALLET_CANNOT_SIGN };
    }
    return picked.status === "cashedOut"
      ? auditCashOutOnChain(anchorWallet, picked.ticketId, onStage)
      : auditTicketOnChain(anchorWallet, picked.ticketId, onStage);
  };

  const handleRefund = async (
    picked: TicketView,
    onStage: (stage: ChainStage) => void,
  ): Promise<ChainActionResult> => {
    if (!anchorWallet) {
      return { ok: false, reason: WALLET_CANNOT_SIGN };
    }
    return refundTicketOnChain(anchorWallet, picked.ticketId, onStage);
  };

  const isChainWalletMissing = isChainSource && ownerBase58 === null;
  const isChainLoading =
    isChainSource && !isChainWalletMissing && chainTickets.state.status === "loading";
  const isChainError =
    isChainSource && !isChainWalletMissing && chainTickets.state.status === "error";
  const isChainEmpty =
    isChainSource &&
    !isChainWalletMissing &&
    chainTickets.state.status === "ready" &&
    tickets.length === 0;

  return (
    <PageShell>
      <TopBar active="tickets" withWallet={isChainSource} />

      <div className="flex items-baseline justify-between gap-4 border-b border-border px-1 pb-3.5">
        <span className="text-sm text-ink-muted">Your tickets</span>
        <span className="font-mono text-xs tabular-nums text-ink-muted">
          {tickets.length} tickets · {liveCount} live
        </span>
      </div>

      {isChainWalletMissing ? (
        <div className="mt-5">
          <EmptyState
            message="Tickets live on chain, keyed to your wallet. Connect it to see them."
            action={<ConnectWalletButton />}
          />
        </div>
      ) : isChainLoading || (!isChainSource && view === "loading") ? (
        <TicketsSkeleton />
      ) : isChainError ? (
        <div className="mt-5">
          <ErrorPanel
            title="Your tickets didn't load"
            message="The devnet RPC did not respond. Nothing is lost; tickets live on chain."
            onRetry={chainTickets.refresh}
          />
        </div>
      ) : !isChainSource && view === "error" ? (
        <div className="mt-5">
          <ErrorPanel
            title="Your tickets didn't load"
            message="The devnet RPC did not respond. Nothing is lost; tickets live on chain."
            onRetry={() => setView("tickets")}
          />
        </div>
      ) : isChainEmpty || (!isChainSource && view === "empty") ? (
        <div className="mt-5">
          <EmptyState
            message="No tickets yet. Take a price on an open market and it will settle here."
            action={
              <Link
                href="/"
                className="focus-ring rounded-full px-2 py-2 text-sm font-medium text-accent no-underline hover:underline"
              >
                Browse fixtures
              </Link>
            }
          />
        </div>
      ) : (
        <>
          <div className="mt-5 overflow-x-auto">
            <SegmentedControl
              ariaLabel="Filter tickets"
              activeKey={activeFilter}
              onSelect={(filterKey) =>
                setActiveFilter(filterKey as TicketFilter)
              }
              options={filterOptions.map((filterOption) => ({
                key: filterOption.key,
                label: filterOption.label,
                detail: String(
                  filterTickets(tickets, filterOption.key).length,
                ),
              }))}
            />
          </div>

          {visibleTickets.length === 0 ? (
            <div className="mt-4">
              <EmptyState
                message={`No ${activeFilter === "refundable" ? "refunded" : activeFilter === "cashedOut" ? "cashed out" : activeFilter} tickets right now.`}
                action={
                  <button
                    type="button"
                    onClick={() => setActiveFilter("all")}
                    className="focus-ring cursor-pointer rounded-full border-0 bg-transparent px-2 py-2 text-sm font-medium text-accent hover:underline"
                  >
                    Show all
                  </button>
                }
              />
            </div>
          ) : (
            <SurfaceCard className="mt-4 p-2.5">
              {visibleTickets.map((ticket, ticketIndex) => (
                <TicketRow
                  key={ticket.ticketId}
                  ticket={ticket}
                  isOpen={openTicketId === ticket.ticketId}
                  onToggle={() =>
                    setOpenTicketId((currentOpenId) =>
                      currentOpenId === ticket.ticketId
                        ? null
                        : ticket.ticketId,
                    )
                  }
                  enterDelayMs={ticketIndex * 40}
                  onCashOut={
                    isChainSource ? (picked) => setCashOutTicket(picked) : undefined
                  }
                  auditPanel={
                    isChainSource &&
                    AUDITABLE_STATUSES.includes(ticket.status) ? (
                      <AuditPanel
                        ticket={ticket}
                        runAudit={handleAudit}
                        runRefund={handleRefund}
                        onSettled={chainTickets.refresh}
                      />
                    ) : undefined
                  }
                  proofActions={
                    // A live ticket's story is still being written; every
                    // other state has a portable receipt worth downloading.
                    isChainSource && ticket.status !== "live" ? (
                      <>
                        <DownloadReceiptButton ticketAddress={ticket.ticketId} />
                        {ticket.marketAddress ? (
                          <Link
                            href={`/verify/${ticket.marketAddress}`}
                            className="focus-ring rounded-full px-1 py-1 text-sm font-medium text-accent no-underline hover:underline"
                          >
                            Public verify page
                          </Link>
                        ) : null}
                      </>
                    ) : undefined
                  }
                />
              ))}
            </SurfaceCard>
          )}
        </>
      )}

      {cashOutTicket?.cashOut ? (
        <CashOutSheet
          ticket={cashOutTicket}
          offer={cashOutTicket.cashOut}
          onClose={() => setCashOutTicket(null)}
          onCashOut={handleChainCashOut}
          onCompleted={chainTickets.refresh}
        />
      ) : null}
    </PageShell>
  );
}
