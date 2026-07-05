"use client";

import { useEffect, useRef, useState } from "react";
import { PublicKey } from "@solana/web3.js";
import { useAnchorWallet, useWallet } from "@solana/wallet-adapter-react";
import { Button } from "@/components/ui/Button";
import { CopyButton } from "@/components/ui/CopyButton";
import { ConnectWalletButton } from "@/components/wallet/ConnectWalletButton";
import { truncateMiddle } from "@/lib/format";
import { requestFaucetUsdtForWallet } from "@/lib/chain/placeBet";
import {
  fetchWalletFunds,
  requestDevnetSolAirdrop,
  type WalletFunds,
} from "@/lib/chain/walletFunds";
import {
  DEMO_FAUCET_SOL_TX,
  DEMO_FAUCET_USDC_TX,
  DEMO_WALLET_ADDRESS,
} from "@/lib/data/demoHouse";

type FaucetToast =
  | { kind: "funded"; message: string }
  | { kind: "error"; message: string };

type JudgePanelProps = {
  onClose: () => void;
  /** Gate-testing hook (demo source only): forces the faucet to fail. */
  faucetFails?: boolean;
  /** Demo simulates funding; chain funds the connected wallet for real. */
  dataSource: "demo" | "chain";
};

const USDC_REQUEST_MS = 1600;
const SOL_REQUEST_MS = 900;
const TOAST_DISMISS_MS = 4000;
const LOW_SOL_THRESHOLD = 0.001;

function shortReason(reason: string): string {
  const cleaned = reason.replace(/^Error:\s*/, "");
  if (cleaned.includes("429") || cleaned.toLowerCase().includes("rate")) {
    return "Devnet airdrop rate-limited. Try faucet.solana.com instead.";
  }
  return cleaned.length > 90 ? `${cleaned.slice(0, 90)}…` : cleaned;
}

function formatAmount(value: number, fractionDigits: number): string {
  return value.toLocaleString("en-US", {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  });
}

/**
 * Judge mode: fund a wallet and try the app in one click. On the demo source
 * the flow is simulated; on chain the faucet mints test USDT to the connected
 * wallet's ATA and the SOL link is a real devnet airdrop, so the judge can
 * place a real bet right after.
 */
export function JudgePanel({
  onClose,
  faucetFails = false,
  dataSource,
}: JudgePanelProps) {
  const isChainSource = dataSource === "chain";
  const { publicKey } = useWallet();
  const anchorWallet = useAnchorWallet();
  const ownerBase58 = publicKey ? publicKey.toBase58() : null;

  const [demoUsdcBalance, setDemoUsdcBalance] = useState(0);
  const [demoSolBalance, setDemoSolBalance] = useState(0.05);
  const [fundsSnapshot, setFundsSnapshot] = useState<{
    owner: string;
    funds: WalletFunds;
  } | null>(null);
  const [isRequesting, setIsRequesting] = useState(false);
  const [toast, setToast] = useState<FaucetToast | null>(null);
  const requestTimerRef = useRef<number | null>(null);
  const toastTimerRef = useRef<number | null>(null);
  const retryActionRef = useRef<() => void>(() => {});

  // Funds are keyed by owner so a wallet switch never shows stale balances.
  const chainFunds =
    fundsSnapshot !== null && fundsSnapshot.owner === ownerBase58
      ? fundsSnapshot.funds
      : null;

  // Escape closes the panel; window keyboard events live outside React.
  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

  // Demo request and toast timers cleanup (browser timers).
  useEffect(() => {
    return () => {
      if (requestTimerRef.current !== null) {
        window.clearTimeout(requestTimerRef.current);
      }
      if (toastTimerRef.current !== null) {
        window.clearTimeout(toastTimerRef.current);
      }
    };
  }, []);

  // Real balances of the connected wallet (chain source only).
  useEffect(() => {
    if (!isChainSource || ownerBase58 === null) {
      return;
    }
    let cancelled = false;
    void fetchWalletFunds(new PublicKey(ownerBase58)).then((result) => {
      if (!cancelled && result.ok) {
        setFundsSnapshot({ owner: ownerBase58, funds: result.funds });
      }
    });
    return () => {
      cancelled = true;
    };
  }, [isChainSource, ownerBase58]);

  const showToast = (nextToast: FaucetToast) => {
    setToast(nextToast);
    if (toastTimerRef.current !== null) {
      window.clearTimeout(toastTimerRef.current);
    }
    toastTimerRef.current = window.setTimeout(
      () => setToast(null),
      TOAST_DISMISS_MS,
    );
  };

  const refreshChainFunds = async (
    owner: PublicKey,
  ): Promise<WalletFunds | null> => {
    const result = await fetchWalletFunds(owner);
    if (result.ok) {
      setFundsSnapshot({ owner: owner.toBase58(), funds: result.funds });
      return result.funds;
    }
    return null;
  };

  const requestDemoUsdc = () => {
    if (isRequesting) {
      return;
    }
    retryActionRef.current = requestDemoUsdc;
    setIsRequesting(true);
    setToast(null);
    requestTimerRef.current = window.setTimeout(() => {
      setIsRequesting(false);
      if (faucetFails) {
        showToast({ kind: "error", message: "Faucet unreachable." });
        return;
      }
      setDemoUsdcBalance((previousBalance) => previousBalance + 1000);
      showToast({
        kind: "funded",
        message: `+1,000.00 test USDC · tx ${truncateMiddle(DEMO_FAUCET_USDC_TX)}`,
      });
    }, USDC_REQUEST_MS);
  };

  const requestDemoSol = () => {
    if (isRequesting) {
      return;
    }
    retryActionRef.current = requestDemoSol;
    setIsRequesting(true);
    setToast(null);
    requestTimerRef.current = window.setTimeout(() => {
      setIsRequesting(false);
      setDemoSolBalance((previousBalance) => previousBalance + 2);
      showToast({
        kind: "funded",
        message: `+2.000 devnet SOL · tx ${truncateMiddle(DEMO_FAUCET_SOL_TX)}`,
      });
    }, SOL_REQUEST_MS);
  };

  const requestChainUsdt = async () => {
    if (isRequesting || !anchorWallet) {
      return;
    }
    retryActionRef.current = () => {
      void requestChainUsdt();
    };
    setIsRequesting(true);
    setToast(null);
    const usdtBefore = chainFunds ? chainFunds.usdt : 0;
    const result = await requestFaucetUsdtForWallet(anchorWallet);
    if (result.ok) {
      const funds = await refreshChainFunds(anchorWallet.publicKey);
      const granted = funds === null ? 0 : funds.usdt - usdtBefore;
      showToast({
        kind: "funded",
        message:
          granted > 0
            ? `+${formatAmount(granted, 2)} test USDT · tx ${truncateMiddle(result.signature)}`
            : `Test USDT sent · tx ${truncateMiddle(result.signature)}`,
      });
    } else {
      showToast({ kind: "error", message: shortReason(result.reason) });
    }
    setIsRequesting(false);
  };

  const requestChainSol = async () => {
    if (isRequesting || !publicKey) {
      return;
    }
    retryActionRef.current = () => {
      void requestChainSol();
    };
    setIsRequesting(true);
    setToast(null);
    const result = await requestDevnetSolAirdrop(publicKey);
    if (result.ok) {
      await refreshChainFunds(publicKey);
      showToast({
        kind: "funded",
        message: `+1.000 devnet SOL · tx ${truncateMiddle(result.signature)}`,
      });
    } else {
      showToast({ kind: "error", message: shortReason(result.reason) });
    }
    setIsRequesting(false);
  };

  const tokenLabel = isChainSource ? "USDT" : "USDC";
  const isWalletMissing = isChainSource && ownerBase58 === null;
  const usdtDisplay = isChainSource
    ? chainFunds
      ? formatAmount(chainFunds.usdt, 2)
      : "…"
    : formatAmount(demoUsdcBalance, 2);
  const solDisplay = isChainSource
    ? chainFunds
      ? formatAmount(chainFunds.sol, 3)
      : "…"
    : formatAmount(demoSolBalance, 3);

  return (
    <>
      <div className="fixed inset-0 z-60" onClick={onClose} />
      <div
        role="dialog"
        aria-label="Judge mode"
        className="fixed right-4 top-19 z-70 w-95 max-w-[calc(100vw-32px)] animate-card-in rounded-lg border border-border bg-elevated p-5 shadow-card sm:right-8"
      >
        <div className="flex items-center justify-between">
          <span className="text-base font-semibold text-ink">Judge mode</span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close judge mode"
            className="focus-ring -my-3 -mr-3.5 flex size-11 cursor-pointer items-center justify-center rounded-sm border border-transparent bg-transparent text-lg text-ink-muted hover:text-ink"
          >
            ✕
          </button>
        </div>
        <p className="mt-2 text-sm leading-normal text-ink-muted">
          {isChainSource
            ? "Fund your connected wallet, then place a real devnet bet."
            : "Fund a test wallet and try the app in one click."}
        </p>

        <div className="mt-3.5 rounded-sm border border-border bg-surface p-3">
          {isWalletMissing ? (
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs leading-normal text-ink-muted">
                Faucet funds go to the connected wallet.
              </span>
              <ConnectWalletButton />
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2">
                <span className="eyebrow flex-none text-ink-faint">
                  connected wallet
                </span>
                <span className="ml-auto font-mono text-xs text-ink-muted">
                  {truncateMiddle(
                    isChainSource && ownerBase58 !== null
                      ? ownerBase58
                      : DEMO_WALLET_ADDRESS,
                    6,
                    5,
                  )}
                </span>
                <CopyButton
                  value={
                    isChainSource && ownerBase58 !== null
                      ? ownerBase58
                      : DEMO_WALLET_ADDRESS
                  }
                  ariaLabel="Copy wallet address"
                />
              </div>
              <div className="my-2.5 border-t border-dashed border-border" />
              <div className="flex flex-col gap-1.5 font-mono text-sm tabular-nums">
                <div className="flex justify-between">
                  <span className="text-ink-muted">{tokenLabel}</span>
                  <span className="text-ink">{usdtDisplay}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-ink-muted">SOL</span>
                  <span className="text-ink">{solDisplay}</span>
                </div>
              </div>
            </>
          )}
        </div>

        {isChainSource &&
        !isWalletMissing &&
        chainFunds !== null &&
        chainFunds.sol < LOW_SOL_THRESHOLD ? (
          <p className="mt-2 text-xs leading-normal text-amber">
            Request devnet SOL first: faucet and bet transactions pay their
            fees in SOL.
          </p>
        ) : null}

        <Button
          variant="primary"
          size="lg"
          disabled={isRequesting || isWalletMissing}
          onClick={isChainSource ? requestChainUsdt : requestDemoUsdc}
          className="mt-3.5 w-full gap-2.5"
        >
          {isRequesting ? (
            <>
              <span className="size-1.5 animate-confirm-dot rounded-sm bg-ink-faint" />
              Requesting…
            </>
          ) : (
            `Request test ${tokenLabel}`
          )}
        </Button>
        <div className="mt-1">
          <button
            type="button"
            disabled={isRequesting || isWalletMissing}
            onClick={isChainSource ? requestChainSol : requestDemoSol}
            className="focus-ring min-h-11 cursor-pointer rounded-sm border border-transparent bg-transparent px-1 font-mono text-xs text-accent hover:underline disabled:cursor-default disabled:text-ink-faint disabled:no-underline"
          >
            request devnet SOL →
          </button>
        </div>

        {toast?.kind === "funded" ? (
          <div
            role="status"
            className="mt-2.5 flex animate-fade-in items-center gap-2.5 rounded-sm border border-accent bg-surface px-3 py-2.5"
          >
            <span className="eyebrow flex-none font-mono text-accent">
              FUNDED
            </span>
            <span className="overflow-hidden text-ellipsis whitespace-nowrap font-mono text-xs tabular-nums text-ink-muted">
              {toast.message}
            </span>
          </div>
        ) : null}
        {toast?.kind === "error" ? (
          <div
            role="alert"
            className="mt-2.5 flex animate-fade-in items-center gap-2.5 rounded-sm border border-danger bg-surface px-3 py-2.5"
          >
            <span className="size-2 flex-none rounded-sm bg-danger" />
            <span className="text-xs leading-normal text-ink-muted">
              {toast.message}
            </span>
            <button
              type="button"
              onClick={() => retryActionRef.current()}
              className="focus-ring -my-2.5 ml-auto min-h-11 cursor-pointer rounded-sm border border-transparent bg-transparent px-1 font-mono text-xs text-accent hover:underline"
            >
              retry
            </button>
          </div>
        ) : null}

        <p className="mt-3 text-xs leading-normal text-ink-faint">
          Devnet test funds only: no real value, no KYC.
        </p>
      </div>
    </>
  );
}
