"use client";

import { useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletPickerModal } from "@/components/wallet/WalletPickerModal";
import { joinClassNames } from "@/lib/joinClassNames";
import { truncateMiddle } from "@/lib/format";

/**
 * The wallet chip (v3 noir): a raised pill holding a green connection dot
 * and the truncated address in mono. Disconnected, it opens the wallet
 * picker (the user chooses the wallet; the picker offers Phantom when none
 * is installed). Connected, a click disconnects.
 */
export function ConnectWalletButton() {
  const { disconnect, publicKey, connecting } = useWallet();
  const [isPickerOpen, setIsPickerOpen] = useState(false);

  const handleClick = () => {
    if (publicKey) {
      void disconnect();
      return;
    }
    setIsPickerOpen(true);
  };

  return (
    <>
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
        ) : (
          "Connect wallet"
        )}
      </button>
      {isPickerOpen ? (
        <WalletPickerModal onClose={() => setIsPickerOpen(false)} />
      ) : null}
    </>
  );
}
