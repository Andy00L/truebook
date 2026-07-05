"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { CopyButton } from "@/components/ui/CopyButton";
import { truncateMiddle } from "@/lib/format";
import {
  DEMO_FAUCET_SOL_TX,
  DEMO_FAUCET_USDC_TX,
  DEMO_WALLET_ADDRESS,
} from "@/lib/data/demoHouse";

type FaucetToast =
  | { kind: "funded"; message: string }
  | { kind: "error" };

type JudgePanelProps = {
  onClose: () => void;
  /** Gate-testing hook: forces the USDC faucet request to fail. */
  faucetFails?: boolean;
};

const USDC_REQUEST_MS = 1600;
const SOL_REQUEST_MS = 900;
const TOAST_DISMISS_MS = 4000;

/**
 * Judge mode: fund a test wallet and try the app in one click. Demo flow
 * today; the chain provider will swap in the TxLINE request_devnet_faucet
 * call and a real SOL airdrop without changing this panel.
 */
export function JudgePanel({ onClose, faucetFails = false }: JudgePanelProps) {
  const [usdcBalance, setUsdcBalance] = useState(0);
  const [solBalance, setSolBalance] = useState(0.05);
  const [isRequesting, setIsRequesting] = useState(false);
  const [toast, setToast] = useState<FaucetToast | null>(null);
  const requestTimerRef = useRef<number | null>(null);
  const toastTimerRef = useRef<number | null>(null);

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

  const requestTestUsdc = () => {
    if (isRequesting) {
      return;
    }
    setIsRequesting(true);
    setToast(null);
    requestTimerRef.current = window.setTimeout(() => {
      setIsRequesting(false);
      if (faucetFails) {
        showToast({ kind: "error" });
        return;
      }
      setUsdcBalance((previousBalance) => previousBalance + 1000);
      showToast({
        kind: "funded",
        message: `+1,000.00 test USDC · tx ${truncateMiddle(DEMO_FAUCET_USDC_TX)}`,
      });
    }, USDC_REQUEST_MS);
  };

  const requestDevnetSol = () => {
    if (isRequesting) {
      return;
    }
    setIsRequesting(true);
    setToast(null);
    requestTimerRef.current = window.setTimeout(() => {
      setIsRequesting(false);
      setSolBalance((previousBalance) => previousBalance + 2);
      showToast({
        kind: "funded",
        message: `+2.000 devnet SOL · tx ${truncateMiddle(DEMO_FAUCET_SOL_TX)}`,
      });
    }, SOL_REQUEST_MS);
  };

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
          Fund a test wallet and try the app in one click.
        </p>

        <div className="mt-3.5 rounded-sm border border-border bg-surface p-3">
          <div className="flex items-center gap-2">
            <span className="eyebrow flex-none text-ink-faint">
              connected wallet
            </span>
            <span className="ml-auto font-mono text-xs text-ink-muted">
              {truncateMiddle(DEMO_WALLET_ADDRESS, 6, 5)}
            </span>
            <CopyButton
              value={DEMO_WALLET_ADDRESS}
              ariaLabel="Copy wallet address"
            />
          </div>
          <div className="my-2.5 border-t border-dashed border-border" />
          <div className="flex flex-col gap-1.5 font-mono text-sm tabular-nums">
            <div className="flex justify-between">
              <span className="text-ink-muted">USDC</span>
              <span className="text-ink">
                {usdcBalance.toLocaleString("en-US", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-ink-muted">SOL</span>
              <span className="text-ink">
                {solBalance.toLocaleString("en-US", {
                  minimumFractionDigits: 3,
                  maximumFractionDigits: 3,
                })}
              </span>
            </div>
          </div>
        </div>

        <Button
          variant="primary"
          size="lg"
          disabled={isRequesting}
          onClick={requestTestUsdc}
          className="mt-3.5 w-full gap-2.5"
        >
          {isRequesting ? (
            <>
              <span className="size-1.5 animate-confirm-dot rounded-sm bg-ink-faint" />
              Requesting…
            </>
          ) : (
            "Request test USDC"
          )}
        </Button>
        <div className="mt-1">
          <button
            type="button"
            onClick={requestDevnetSol}
            className="focus-ring min-h-11 cursor-pointer rounded-sm border border-transparent bg-transparent px-1 font-mono text-xs text-accent hover:underline"
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
            <span className="text-xs text-ink-muted">Faucet unreachable.</span>
            <button
              type="button"
              onClick={requestTestUsdc}
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
