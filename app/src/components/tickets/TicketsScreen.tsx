"use client";

import { useState } from "react";
import Link from "next/link";
import { PageShell } from "@/components/ui/PageShell";
import { TopBar } from "@/components/ui/TopBar";
import { SurfaceCard } from "@/components/ui/SurfaceCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorPanel } from "@/components/ui/ErrorPanel";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { TicketRow } from "@/components/tickets/TicketRow";
import { TicketsSkeleton } from "@/components/tickets/TicketsSkeleton";
import {
  DEMO_TICKETS,
  filterTickets,
  type TicketFilter,
} from "@/lib/data/demoTickets";

export type TicketsScreenView = "tickets" | "loading" | "empty" | "error";

const FILTER_LABELS: ReadonlyArray<{ key: TicketFilter; label: string }> = [
  { key: "all", label: "All" },
  { key: "live", label: "Live" },
  { key: "won", label: "Won" },
  { key: "lost", label: "Lost" },
  { key: "refundable", label: "Refunded" },
];

type TicketsScreenProps = {
  initialView: TicketsScreenView;
};

/** The bettor's tickets: accordion rows opening into on-chain receipts. */
export function TicketsScreen({ initialView }: TicketsScreenProps) {
  const [view, setView] = useState<TicketsScreenView>(initialView);
  const [activeFilter, setActiveFilter] = useState<TicketFilter>("all");
  const [openTicketId, setOpenTicketId] = useState<string | null>(
    "ticket-homewin-won",
  );

  const visibleTickets = filterTickets(DEMO_TICKETS, activeFilter);
  const liveCount = filterTickets(DEMO_TICKETS, "live").length;

  return (
    <PageShell>
      <TopBar active="tickets" />

      <div className="flex items-baseline justify-between gap-4 border-b border-border px-1 pb-3.5">
        <span className="text-sm text-ink-muted">Your tickets</span>
        <span className="font-mono text-xs tabular-nums text-ink-muted">
          {DEMO_TICKETS.length} tickets · {liveCount} live
        </span>
      </div>

      {view === "loading" ? (
        <TicketsSkeleton />
      ) : view === "error" ? (
        <div className="mt-5">
          <ErrorPanel
            title="Your tickets didn't load"
            message="The devnet RPC did not respond. Nothing is lost; tickets live on chain."
            onRetry={() => setView("tickets")}
          />
        </div>
      ) : view === "empty" ? (
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
              options={FILTER_LABELS.map((filterOption) => ({
                key: filterOption.key,
                label: filterOption.label,
                detail: String(
                  filterTickets(DEMO_TICKETS, filterOption.key).length,
                ),
              }))}
            />
          </div>

          {visibleTickets.length === 0 ? (
            <div className="mt-4">
              <EmptyState
                message={`No ${activeFilter === "refundable" ? "refunded" : activeFilter} tickets right now.`}
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
                />
              ))}
            </SurfaceCard>
          )}
        </>
      )}
    </PageShell>
  );
}
