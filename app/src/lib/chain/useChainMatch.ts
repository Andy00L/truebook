"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchChainBoard } from "@/lib/chain/truebookClient";
import type { MatchView } from "@/lib/data/types";

/** Quotes only move on keeper ticks; a slow poll keeps the page honest. */
const MATCH_POLL_MS = 30_000;

export type ChainMatchState =
  | { status: "loading" }
  | { status: "error"; reason: string }
  | { status: "notFound" }
  | { status: "ready"; match: MatchView };

/** Polls one fixture's on-chain market for the match screen. */
export function useChainMatch(
  enabled: boolean,
  fixtureId: string,
): { state: ChainMatchState; retry: () => void } {
  const [state, setState] = useState<ChainMatchState>({ status: "loading" });

  const loadMatch = useCallback(async () => {
    const result = await fetchChainBoard();
    if (!result.ok) {
      setState({ status: "error", reason: result.reason });
      return;
    }
    const match = result.board.fixtures.find(
      (fixture) => fixture.fixtureId === fixtureId,
    );
    setState(match ? { status: "ready", match } : { status: "notFound" });
  }, [fixtureId]);

  // Initial fetch plus polling against devnet (external system); the first
  // load goes through a zero timer so no state updates happen synchronously
  // inside the effect body.
  useEffect(() => {
    if (!enabled) {
      return;
    }
    const initialTimer = window.setTimeout(() => {
      void loadMatch();
    }, 0);
    const pollTimer = window.setInterval(() => {
      void loadMatch();
    }, MATCH_POLL_MS);
    return () => {
      window.clearTimeout(initialTimer);
      window.clearInterval(pollTimer);
    };
  }, [enabled, loadMatch]);

  return {
    state,
    retry: () => {
      setState({ status: "loading" });
      void loadMatch();
    },
  };
}
