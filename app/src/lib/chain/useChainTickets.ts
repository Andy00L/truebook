"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchChainTickets } from "@/lib/chain/tickets";
import type { TicketView } from "@/lib/data/types";

/** Tickets move on keeper ticks and user actions; a slow poll stays honest. */
const TICKETS_POLL_MS = 30_000;

export type ChainTicketsState =
  | { status: "loading" }
  | { status: "error"; reason: string }
  | { status: "ready"; tickets: TicketView[] };

/** Polls the connected wallet's on-chain tickets for the tickets screen. */
export function useChainTickets(
  enabled: boolean,
  ownerBase58: string | null,
): { state: ChainTicketsState; refresh: () => void } {
  const [state, setState] = useState<ChainTicketsState>({ status: "loading" });

  const loadTickets = useCallback(async () => {
    if (ownerBase58 === null) {
      return;
    }
    const result = await fetchChainTickets(ownerBase58);
    if (result.ok) {
      setState({ status: "ready", tickets: result.tickets });
    } else {
      setState({ status: "error", reason: result.reason });
    }
  }, [ownerBase58]);

  // Initial fetch plus polling against devnet (external system); the first
  // load goes through a zero timer so no state updates happen synchronously
  // inside the effect body.
  useEffect(() => {
    if (!enabled || ownerBase58 === null) {
      return;
    }
    const initialTimer = window.setTimeout(() => {
      void loadTickets();
    }, 0);
    const pollTimer = window.setInterval(() => {
      void loadTickets();
    }, TICKETS_POLL_MS);
    return () => {
      window.clearTimeout(initialTimer);
      window.clearInterval(pollTimer);
    };
  }, [enabled, ownerBase58, loadTickets]);

  return {
    state,
    refresh: () => {
      void loadTickets();
    },
  };
}
