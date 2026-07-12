"use client";

import { useEffect, useRef, useState } from "react";
import { PublicKey } from "@solana/web3.js";
import { useAnchorWallet, useWallet } from "@solana/wallet-adapter-react";
import { Button } from "@/components/ui/Button";
import { StatusPill } from "@/components/ui/StatusPill";
import { CopyButton } from "@/components/ui/CopyButton";
import { OdometerNumber } from "@/components/ui/OdometerNumber";
import { CircleIconButton, IconClose } from "@/components/ui/Icon";
import { ConnectWalletButton } from "@/components/wallet/ConnectWalletButton";
import { truncateMiddle } from "@/lib/format";
import { requestFaucetUsdtForWallet } from "@/lib/chain/placeBet";
import { currencyLabelForSource } from "@/lib/data/types";
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

type FundedRow = { amount: string; tx: string };

type RequestKind = "usdt" | "sol";

type JudgePanelProps = {
  onClose: () => void;
  /** Gate-testing hook (demo source only): forces the faucet to fail. */
  faucetFails?: boolean;
  /** Demo simulates funding; chain funds the connected wallet for real. */
  dataSource: "demo" | "chain";
};

const USDC_REQUEST_MS = 1600;
const SOL_REQUEST_MS = 900;
const FUNDED_DISMISS_MS = 4000;
const LOW_SOL_THRESHOLD = 0.001;

function shortReason(reason: string): string {
  const cleaned = reason.replace(/^Error:\s*/, "");
  if (cleaned.includes("429") || cleaned.toLowerCase().includes("rate")) {
    return "Devnet airdrop rate-limited. Try faucet.solana.com instead.";
  }
  return cleaned.length > 90 ? `${cleaned.slice(0, 90)}…` : cleaned;
}

function formatBalance(value: number, fractionDigits: number): string {
  return value.toLocaleString("en-US", {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  });
}

/** The requesting spinner: a 6px dot orbiting a 16px circle. */
function SpinnerDot() {
  return (
    <span
      aria-hidden="true"
      className="relative inline-block size-4 flex-none animate-spin-dot"
    >
      <span className="absolute left-1/2 top-0 -ml-[3px] size-1.5 rounded-full bg-current" />
    </span>
  );
}

/**
 * Judge mode (v3 noir): fund the connected wallet in one panel. On the demo
 * source the flow is simulated; on chain the faucet mints test USDT to the
 * connected wallet's ATA and the SOL link is a real devnet airdrop. The
 * panel's payoff is the balance roll: one cream button, then the balance
 * climbs digit by digit under the blur.
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
  const [requestKind, setRequestKind] = useState<RequestKind | null>(null);
  const [fundedRow, setFundedRow] = useState<FundedRow | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const requestTimerRef = useRef<number | null>(null);
  const fundedTimerRef = useRef<number | null>(null);
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

  // Demo request and funded-row timers cleanup (browser timers).
  useEffect(() => {
    return () => {
      if (requestTimerRef.current !== null) {
        window.clearTimeout(requestTimerRef.current);
      }
      if (fundedTimerRef.current !== null) {
        window.clearTimeout(fundedTimerRef.current);
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

  const showFundedRow = (nextRow: FundedRow) => {
    setFundedRow(nextRow);
    if (fundedTimerRef.current !== null) {
      window.clearTimeout(fundedTimerRef.current);
    }
    fundedTimerRef.current = window.setTimeout(
      () => setFundedRow(null),
      FUNDED_DISMISS_MS,
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
    if (requestKind !== null) {
      return;
    }
    retryActionRef.current = requestDemoUsdc;
    setRequestKind("usdt");
    setErrorMessage(null);
    setFundedRow(null);
    requestTimerRef.current = window.setTimeout(() => {
      setRequestKind(null);
      if (faucetFails) {
        setErrorMessage("Faucet unreachable.");
        return;
      }
      setDemoUsdcBalance((previousBalance) => previousBalance + 1000);
      showFundedRow({
        amount: "+1,000.00 test USDC",
        tx: DEMO_FAUCET_USDC_TX,
      });
    }, USDC_REQUEST_MS);
  };

  const requestDemoSol = () => {
    if (requestKind !== null) {
      return;
    }
    retryActionRef.current = requestDemoSol;
    setRequestKind("sol");
    setErrorMessage(null);
    setFundedRow(null);
    requestTimerRef.current = window.setTimeout(() => {
      setRequestKind(null);
      setDemoSolBalance((previousBalance) => previousBalance + 2);
      showFundedRow({ amount: "+2.000 devnet SOL", tx: DEMO_FAUCET_SOL_TX });
    }, SOL_REQUEST_MS);
  };

  const requestChainUsdt = async () => {
    if (requestKind !== null || !anchorWallet) {
      return;
    }
    retryActionRef.current = () => {
      void requestChainUsdt();
    };
    setRequestKind("usdt");
    setErrorMessage(null);
    setFundedRow(null);
    const usdtBefore = chainFunds ? chainFunds.usdt : 0;
    const result = await requestFaucetUsdtForWallet(anchorWallet);
    if (result.ok) {
      const funds = await refreshChainFunds(anchorWallet.publicKey);
      const granted = funds === null ? 0 : funds.usdt - usdtBefore;
      showFundedRow({
        amount:
          granted > 0
            ? `+${formatBalance(granted, 2)} test USDT`
            : "Test USDT sent",
        tx: result.signature,
      });
    } else {
      setErrorMessage(shortReason(result.reason));
    }
    setRequestKind(null);
  };

  const requestChainSol = async () => {
    if (requestKind !== null || !publicKey) {
      return;
    }
    retryActionRef.current = () => {
      void requestChainSol();
    };
    setRequestKind("sol");
    setErrorMessage(null);
    setFundedRow(null);
    const result = await requestDevnetSolAirdrop(publicKey);
    if (result.ok) {
      await refreshChainFunds(publicKey);
      showFundedRow({ amount: "+1.000 devnet SOL", tx: result.signature });
    } else {
      setErrorMessage(shortReason(result.reason));
    }
    setRequestKind(null);
  };

  const tokenLabel = currencyLabelForSource(dataSource);
  const isWalletMissing = isChainSource && ownerBase58 === null;
  const walletAddress =
    isChainSource && ownerBase58 !== null ? ownerBase58 : DEMO_WALLET_ADDRESS;
  const usdtDisplay = isChainSource
    ? chainFunds
      ? formatBalance(chainFunds.usdt, 2)
      : "0.00"
    : formatBalance(demoUsdcBalance, 2);
  const solDisplay = isChainSource
    ? chainFunds
      ? formatBalance(chainFunds.sol, 3)
      : "0.000"
    : formatBalance(demoSolBalance, 3);
  const isLowSol =
    isChainSource &&
    !isWalletMissing &&
    chainFunds !== null &&
    chainFunds.sol < LOW_SOL_THRESHOLD;
  const actionsDisabled = requestKind !== null || isWalletMissing;

  return (
    <>
      <div
        className="fixed inset-0 z-60 animate-fade-in bg-scrim"
        onClick={onClose}
        role="presentation"
      />
      <div
        role="dialog"
        aria-label="Judge mode"
        className="fixed left-4 top-18 z-70 max-h-[calc(100dvh-96px)] w-95 max-w-[calc(100vw-32px)] animate-card-in overflow-y-auto rounded-md bg-surface p-5 shadow-panel sm:left-8"
      >
        <div className="flex items-center justify-between gap-3">
          <span className="text-lg font-medium tracking-tight text-ink">
            Judge mode
          </span>
          <CircleIconButton ariaLabel="Close judge mode" onClick={onClose}>
            <IconClose />
          </CircleIconButton>
        </div>
        <p className="mb-0 mt-2 text-sm leading-normal text-ink-muted">
          {isChainSource
            ? "Fund your connected wallet, then place a real devnet bet."
            : "Fund a test wallet and try the app in one click."}
        </p>

        {isWalletMissing ? (
          <div className="mt-4.5 rounded-sm bg-elevated px-4.5 py-4">
            <div className="text-sm leading-normal text-ink">
              Faucet funds go to the connected wallet.
            </div>
            <div className="mt-3">
              <ConnectWalletButton />
            </div>
          </div>
        ) : (
          <>
            <div className="mt-4.5 flex items-center gap-2.5">
              <span className="inline-flex min-w-0 items-center gap-2 rounded-full bg-elevated px-4 py-2.5 font-mono text-xs tabular-nums text-ink">
                <span
                  aria-hidden="true"
                  className="size-2 flex-none rounded-full bg-accent"
                />
                <span className="overflow-hidden text-ellipsis whitespace-nowrap">
                  {truncateMiddle(walletAddress, 6, 5)}
                </span>
              </span>
              <CopyButton value={walletAddress} ariaLabel="Copy wallet address" />
            </div>

            <div className="mt-5 grid grid-cols-2 gap-4">
              <div>
                <OdometerNumber
                  value={usdtDisplay}
                  className="text-xl font-light tabular-nums leading-tight tracking-tight text-ink"
                />
                <div className="mt-1 text-sm text-ink-muted">
                  Test {tokenLabel}
                </div>
              </div>
              <div>
                <div className="flex items-center gap-2.5">
                  <OdometerNumber
                    value={solDisplay}
                    className="text-xl font-light tabular-nums leading-tight tracking-tight text-ink"
                  />
                  {isLowSol ? (
                    <StatusPill variant="amber">Low SOL</StatusPill>
                  ) : null}
                </div>
                <div className="mt-1 text-sm text-ink-muted">Devnet SOL</div>
              </div>
            </div>
          </>
        )}

        {isLowSol ? (
          <p className="mb-0 mt-4 text-sm leading-normal text-ink-muted">
            Request devnet SOL first: faucet and bet transactions pay their
            fees in SOL.
          </p>
        ) : null}

        {errorMessage ? (
          <div
            role="alert"
            className="mt-4 flex items-center justify-between gap-3 rounded-sm border border-danger bg-danger-soft px-4 py-3"
          >
            <span className="text-sm leading-normal text-ink">
              {errorMessage}
            </span>
            <button
              type="button"
              onClick={() => retryActionRef.current()}
              className="focus-ring flex-none cursor-pointer rounded-full border-0 bg-transparent px-1 py-1 text-sm font-medium text-accent"
            >
              Retry
            </button>
          </div>
        ) : null}

        <Button
          variant="primary"
          size="lg"
          disabled={actionsDisabled}
          onClick={isChainSource ? requestChainUsdt : requestDemoUsdc}
          className="mt-4.5 w-full gap-2"
        >
          {requestKind === "usdt" ? (
            <>
              <SpinnerDot />
              Requesting...
            </>
          ) : (
            `Request test ${tokenLabel}`
          )}
        </Button>

        <div
          className="grid transition-[grid-template-rows] duration-250 ease-standard"
          style={{ gridTemplateRows: fundedRow ? "1fr" : "0fr" }}
        >
          <div className="overflow-hidden">
            {fundedRow ? (
              <div
                role="status"
                className="mt-3.5 flex items-center justify-between gap-3.5 rounded-sm bg-elevated px-4 py-3"
              >
                <span className="min-w-0">
                  <span className="block text-base font-medium tabular-nums text-ink">
                    {fundedRow.amount}
                  </span>
                  <span className="mt-0.5 block overflow-hidden text-ellipsis whitespace-nowrap font-mono text-xs tabular-nums text-ink-muted">
                    tx {truncateMiddle(fundedRow.tx)}
                  </span>
                </span>
                <StatusPill variant="accent" animateIn animateInDelayMs={100}>
                  Funded
                </StatusPill>
              </div>
            ) : null}
          </div>
        </div>

        <div className="mt-3.5 text-center">
          <button
            type="button"
            disabled={actionsDisabled}
            onClick={isChainSource ? requestChainSol : requestDemoSol}
            className="focus-ring inline-flex cursor-pointer items-center gap-2 rounded-full border-0 bg-transparent px-2.5 py-1.5 text-sm font-medium text-accent disabled:cursor-default disabled:opacity-40"
          >
            {requestKind === "sol" ? (
              <>
                <SpinnerDot />
                Requesting...
              </>
            ) : (
              "Request devnet SOL"
            )}
          </button>
        </div>

        <p className="mb-0 mt-3.5 text-center text-xs leading-normal text-ink-muted">
          Devnet test funds only: no real value, no KYC.
        </p>
      </div>
    </>
  );
}
