"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { truncateMiddle } from "@/lib/format";

/**
 * Token-styled wallet control: connects the first detected standard wallet,
 * shows the truncated address once connected, disconnects on click.
 */
export function ConnectWalletButton() {
  const { wallets, select, connect, disconnect, publicKey, connecting } =
    useWallet();

  const handleClick = async () => {
    if (publicKey) {
      await disconnect();
      return;
    }
    const firstWallet = wallets[0];
    if (!firstWallet) {
      window.open("https://phantom.com/download", "_blank", "noreferrer");
      return;
    }
    select(firstWallet.adapter.name);
    try {
      await connect();
    } catch {
      // The wallet popup was dismissed; nothing to do, the user can retry.
    }
  };

  const buttonLabel = publicKey
    ? truncateMiddle(publicKey.toBase58(), 4, 4)
    : connecting
      ? "Connecting…"
      : wallets.length === 0
        ? "Get a wallet"
        : "Connect wallet";

  return (
    <button
      type="button"
      onClick={handleClick}
      title={publicKey ? "Disconnect wallet" : "Connect a Solana wallet"}
      className="focus-ring transition-press h-11 cursor-pointer rounded-sm border border-border bg-elevated px-3.5 font-mono text-xs text-ink-muted hover:border-ink-faint active:scale-98"
    >
      {buttonLabel}
    </button>
  );
}
