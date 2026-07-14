"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchChainVerify } from "@/lib/chain/truebookClient";
import type { VerifyMarketView } from "@/lib/data/demoVerify";

export type ChainVerifyState =
  | { status: "loading" }
  | { status: "error"; reason: string }
  | { status: "ready"; view: VerifyMarketView | null };

/**
 * One-shot fetch of a market's on-chain verification story for the public
 * /verify/[market] page. A verified outcome never changes once anchored, so
 * there is no poll; the error panel offers a manual retry instead.
 */
export function useChainVerify(
  enabled: boolean,
  marketAddress: string,
): { state: ChainVerifyState; refresh: () => void } {
  const [state, setState] = useState<ChainVerifyState>({ status: "loading" });

  const loadVerify = useCallback(async () => {
    const result = await fetchChainVerify(
      marketAddress,
      window.location.origin,
    );
    if (result.ok) {
      setState({ status: "ready", view: result.view });
    } else {
      setState({ status: "error", reason: result.reason });
    }
  }, [marketAddress]);

  // Initial fetch against devnet (external system); the zero timer keeps
  // state updates out of the effect body itself.
  useEffect(() => {
    if (!enabled) {
      return;
    }
    const initialTimer = window.setTimeout(() => {
      void loadVerify();
    }, 0);
    return () => {
      window.clearTimeout(initialTimer);
    };
  }, [enabled, loadVerify]);

  return {
    state,
    refresh: () => {
      setState({ status: "loading" });
      void loadVerify();
    },
  };
}
