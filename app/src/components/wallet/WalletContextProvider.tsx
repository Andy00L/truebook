"use client";

import { useMemo, type ReactNode } from "react";
import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import { DEVNET_RPC_URL } from "@truebook/shared/config";

/**
 * App-wide Solana wallet context. The adapters array stays empty on purpose:
 * modern wallets (Phantom, Solflare, Backpack) register themselves through
 * the wallet-standard and are discovered automatically.
 */
export function WalletContextProvider({ children }: { children: ReactNode }) {
  const endpoint = useMemo(() => DEVNET_RPC_URL, []);
  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={[]} autoConnect>
        {children}
      </WalletProvider>
    </ConnectionProvider>
  );
}
