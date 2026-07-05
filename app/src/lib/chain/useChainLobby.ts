"use client";

import { useCallback, useEffect, useState } from "react";
import {
  fetchChainBoard,
  type ChainBoard,
} from "@/lib/chain/truebookClient";

/** Devnet quotes refresh on keeper ticks (about every few minutes). */
const BOARD_POLL_MS = 30_000;

export type ChainLobbyState =
  | { status: "loading" }
  | { status: "error"; reason: string }
  | { status: "ready"; board: ChainBoard };

/** Polls the live devnet board while the lobby is on the chain source. */
export function useChainLobby(enabled: boolean): {
  state: ChainLobbyState;
  retry: () => void;
} {
  const [state, setState] = useState<ChainLobbyState>({ status: "loading" });

  const loadBoard = useCallback(async () => {
    const result = await fetchChainBoard();
    if (result.ok) {
      setState({ status: "ready", board: result.board });
    } else {
      setState({ status: "error", reason: result.reason });
    }
  }, []);

  // Initial fetch plus a polling interval against devnet (external system).
  // The first load goes through a zero timer so every state update comes
  // from a timer callback, never synchronously inside the effect body.
  useEffect(() => {
    if (!enabled) {
      return;
    }
    const initialTimer = window.setTimeout(() => {
      void loadBoard();
    }, 0);
    const pollTimer = window.setInterval(() => {
      void loadBoard();
    }, BOARD_POLL_MS);
    return () => {
      window.clearTimeout(initialTimer);
      window.clearInterval(pollTimer);
    };
  }, [enabled, loadBoard]);

  return {
    state,
    retry: () => {
      setState({ status: "loading" });
      void loadBoard();
    },
  };
}
