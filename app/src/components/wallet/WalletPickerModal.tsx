"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useWallet, type Wallet } from "@solana/wallet-adapter-react";
import { ButtonLink } from "@/components/ui/Button";
import { CircleIconButton, IconClose } from "@/components/ui/Icon";

const PHANTOM_DOWNLOAD_URL = "https://phantom.com/download";
/** The wallet's connect approval is human-paced; past this it is lost. */
const CONNECT_TIMEOUT_MS = 60_000;

type WalletAdapter = Wallet["adapter"];

type WalletPickerModalProps = {
  onClose: () => void;
};

/**
 * Waits for the provider-driven connect to settle on the adapter's own
 * events. sourceRef: node_modules/@solana/wallet-adapter-react
 * WalletProvider.js: after select(), the provider itself runs the full
 * adapter.connect() (autoConnect + hasUserSelectedAWallet), so the picker
 * must observe the adapter instead of calling connect() in the same tick
 * (that call sees the stale selection and throws WalletNotSelectedError).
 */
function waitForAdapterConnection(adapter: WalletAdapter): Promise<void> {
  return new Promise((resolveConnected, rejectConnection) => {
    const settleTimer = window.setTimeout(() => {
      removeWaiters();
      rejectConnection(
        new Error(
          "The wallet did not respond. Unlock the extension and retry.",
        ),
      );
    }, CONNECT_TIMEOUT_MS);
    const handleConnected = () => {
      removeWaiters();
      resolveConnected();
    };
    const handleFailed = (walletError: unknown) => {
      removeWaiters();
      rejectConnection(
        walletError instanceof Error
          ? walletError
          : new Error(String(walletError)),
      );
    };
    function removeWaiters() {
      window.clearTimeout(settleTimer);
      adapter.off("connect", handleConnected);
      adapter.off("error", handleFailed);
    }
    adapter.on("connect", handleConnected);
    adapter.on("error", handleFailed);
  });
}

/** Maps connect failures onto short, actionable copy. */
function describeConnectError(connectError: unknown): string {
  const text =
    connectError instanceof Error ? connectError.message : String(connectError);
  if (text.toLowerCase().includes("user rejected")) {
    return "Connection request declined in the wallet.";
  }
  return text || "The wallet did not respond. Unlock the extension and retry.";
}

/** The 6px-dot orbit spinner, sized for a wallet row. */
function ConnectingSpinner() {
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
 * The wallet picker (v3 noir): a centered dialog listing every wallet the
 * browser exposes through the wallet standard, one row per wallet, connect
 * on click. With no wallet installed it offers Phantom instead of failing
 * silently. Sits above the judge panel (z-80/90 vs 60/70) because the panel
 * embeds the connect button.
 */
export function WalletPickerModal({ onClose }: WalletPickerModalProps) {
  const { wallets, wallet: selectedWallet, select, connect } = useWallet();
  const [connectingName, setConnectingName] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Escape closes the picker; window keyboard events live outside React.
  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

  const handlePickWallet = async (candidate: Wallet) => {
    if (connectingName !== null) {
      return;
    }
    if (candidate.adapter.connected) {
      select(candidate.adapter.name);
      onClose();
      return;
    }
    setErrorMessage(null);
    setConnectingName(candidate.adapter.name);
    try {
      if (selectedWallet?.adapter.name === candidate.adapter.name) {
        // Re-selecting the current wallet does not re-trigger the provider's
        // connect-on-select, so drive the context connect directly (it sees
        // the wallet as selected on this render, no stale-closure throw).
        await connect();
      } else {
        const connectionSettled = waitForAdapterConnection(candidate.adapter);
        select(candidate.adapter.name);
        await connectionSettled;
      }
      onClose();
    } catch (connectError) {
      setErrorMessage(describeConnectError(connectError));
      setConnectingName(null);
    }
  };

  // A portal to <body>: the picker also opens from inside the judge panel,
  // whose card-in animation gives it a containing block that would trap
  // these fixed layers (scrim and dialog) inside the panel's box.
  return createPortal(
    <>
      <div
        className="fixed inset-0 z-80 animate-fade-in bg-scrim"
        onClick={onClose}
        role="presentation"
      />
      <div className="pointer-events-none fixed inset-0 z-90 flex items-center justify-center p-4">
        <div
          role="dialog"
          aria-label="Connect a wallet"
          className="pointer-events-auto w-95 max-w-full animate-card-in rounded-md bg-surface p-5 shadow-panel"
        >
          <div className="flex items-center justify-between gap-3">
            <span className="text-lg font-medium tracking-tight text-ink">
              Connect a wallet
            </span>
            <CircleIconButton ariaLabel="Close the wallet picker" onClick={onClose}>
              <IconClose />
            </CircleIconButton>
          </div>
          <p className="mb-0 mt-2 text-sm leading-normal text-ink-muted">
            TrueBook runs on Solana devnet. Pick a wallet; test funds come from
            Judge mode, not your mainnet balance.
          </p>

          {errorMessage ? (
            <div
              role="alert"
              className="mt-4 rounded-sm border border-danger bg-danger-soft px-4 py-3"
            >
              <span className="text-sm leading-normal text-ink">
                {errorMessage}
              </span>
            </div>
          ) : null}

          {wallets.length === 0 ? (
            <div className="mt-4.5 rounded-sm bg-elevated px-4.5 py-4">
              <div className="text-sm leading-normal text-ink">
                No Solana wallet detected in this browser.
              </div>
              <p className="mb-0 mt-1.5 text-sm leading-normal text-ink-muted">
                Install Phantom, then reload this page.
              </p>
              <ButtonLink
                href={PHANTOM_DOWNLOAD_URL}
                external
                variant="primary"
                className="mt-3.5"
              >
                Install Phantom
              </ButtonLink>
            </div>
          ) : (
            <div className="mt-4.5 flex flex-col gap-2">
              {wallets.map((candidate) => {
                const isConnectingThis =
                  connectingName === candidate.adapter.name;
                return (
                  <button
                    key={candidate.adapter.name}
                    type="button"
                    disabled={connectingName !== null && !isConnectingThis}
                    onClick={() => void handlePickWallet(candidate)}
                    className="transition-press focus-ring flex w-full cursor-pointer items-center gap-3 rounded-sm border-0 bg-elevated px-4 py-3 text-left hover:brightness-130 active:scale-97 disabled:cursor-default disabled:opacity-40"
                  >
                    {/* Adapter icons are wallet-supplied data URIs. */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={candidate.adapter.icon}
                      alt=""
                      aria-hidden="true"
                      width={24}
                      height={24}
                      className="size-6 flex-none rounded-md"
                    />
                    <span className="min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-base font-medium text-ink">
                      {candidate.adapter.name}
                    </span>
                    {isConnectingThis ? (
                      <span className="flex flex-none items-center gap-2 text-sm text-ink-muted">
                        <ConnectingSpinner />
                        Connecting...
                      </span>
                    ) : (
                      <span className="eyebrow flex-none text-ink-faint">
                        Detected
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </>,
    document.body,
  );
}
