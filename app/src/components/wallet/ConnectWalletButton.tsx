"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { joinClassNames } from "@/lib/joinClassNames";
import { truncateMiddle } from "@/lib/format";

/**
 * The wallet chip (v3 noir): a raised pill holding a green connection dot
 * and the truncated address in mono. Connects the first detected standard
 * wallet, disconnects on click.
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

  return (
    <button
      type="button"
      onClick={handleClick}
      title={publicKey ? "Disconnect wallet" : "Connect a Solana wallet"}
      className={joinClassNames(
        "transition-press focus-ring inline-flex h-11 cursor-pointer items-center gap-2 rounded-full border-0 bg-elevated px-4.5 hover:brightness-130 active:scale-97",
        publicKey
          ? "font-mono text-xs tabular-nums text-ink"
          : "text-sm font-medium text-ink",
      )}
    >
      {publicKey ? (
        <>
          <span
            aria-hidden="true"
            className="size-2 flex-none rounded-full bg-accent"
          />
          {truncateMiddle(publicKey.toBase58(), 4, 4)}
        </>
      ) : connecting ? (
        "Connecting..."
      ) : wallets.length === 0 ? (
        "Get a wallet"
      ) : (
        "Connect wallet"
      )}
    </button>
  );
}
