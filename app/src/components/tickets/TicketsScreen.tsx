"use client";

import { useState } from "react";
import Link from "next/link";
import { PageShell } from "@/components/ui/PageShell";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorPanel } from "@/components/ui/ErrorPanel";
import { TicketRow } from "@/components/tickets/TicketRow";
import { TicketsSkeleton } from "@/components/tickets/TicketsSkeleton";
import { ChipButton } from "@/components/ui/ChipButton";
import {
  DEMO_TICKETS,
  filterTickets,
  type TicketFilter,
} from "@/lib/data/demoTickets";

export type TicketsScreenView = "tickets" | "loading" | "empty" | "error";

const FILTERS: ReadonlyArray<TicketFilter> = [
  "all",
  "live",
  "won",
  "lost",
  "refundable",
];

type TicketsScreenProps = {
  initialView: TicketsScreenView;
};

/** The bettor's tickets, each row expanding to its proof receipt. */
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
      <Breadcrumb
        withMascot
        tagline="Provably-fair sportsbook on Solana"
        segments={[{ label: "Fixtures", href: "/" }, { label: "Tickets" }]}
      />

      {view === "loading" ? (
        <TicketsSkeleton />
      ) : view === "error" ? (
        <ErrorPanel
          title="Couldn't load your tickets"
          message="The ticket index didn't respond."
          onRetry={() => setView("tickets")}
        />
      ) : view === "empty" ? (
        <EmptyState
          message="No tickets yet."
          action={
            <Link
              href="/"
              className="focus-ring rounded-sm border border-transparent px-2 py-3 text-sm text-accent no-underline hover:underline"
            >
              Browse fixtures →
            </Link>
          }
        />
      ) : (
        <>
          <div className="flex items-baseline justify-between gap-4">
            <span className="eyebrow text-ink-muted">Your tickets</span>
            <span className="font-mono text-xs tabular-nums text-ink-faint">
              {DEMO_TICKETS.length} tickets · {liveCount} live
            </span>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            {FILTERS.map((filterName) => (
              <ChipButton
                key={filterName}
                isActive={activeFilter === filterName}
                onClick={() => setActiveFilter(filterName)}
              >
                {filterName}
                <span className="font-mono text-xs tabular-nums text-ink-faint">
                  {filterTickets(DEMO_TICKETS, filterName).length}
                </span>
              </ChipButton>
            ))}
          </div>

          <div className="mt-4 flex flex-col gap-3">
            {visibleTickets.length === 0 ? (
              <EmptyState
                message={`No ${activeFilter} tickets right now.`}
                action={
                  <button
                    type="button"
                    onClick={() => setActiveFilter("all")}
                    className="focus-ring cursor-pointer rounded-sm border border-transparent bg-transparent px-2 py-3 text-sm text-accent hover:underline"
                  >
                    Show all tickets
                  </button>
                }
              />
            ) : (
              visibleTickets.map((ticket, ticketIndex) => (
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
              ))
            )}
          </div>
        </>
      )}
    </PageShell>
  );
}
