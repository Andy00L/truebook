import Link from "next/link";
import { MascotDribble } from "@/components/ui/MascotDribble";
import { ConnectWalletButton } from "@/components/wallet/ConnectWalletButton";

type LobbyHeaderProps = {
  onJudgeToggle: () => void;
  /** Chain source shows the wallet control; the demo stays wallet-free. */
  withWallet?: boolean;
};

/** The front-door header: mark, judge mode entry, nav, and the tagline. */
export function LobbyHeader({ onJudgeToggle, withWallet = false }: LobbyHeaderProps) {
  return (
    <header className="flex items-center justify-between gap-4 pb-5 pt-1">
      <div className="flex items-center gap-3">
        <MascotDribble scale={0.4} />
        <span className="text-base font-semibold tracking-wide text-ink">
          TrueBook
        </span>
      </div>
      <div className="flex items-center gap-4">
        {withWallet ? <ConnectWalletButton /> : null}
        <button
          type="button"
          onClick={onJudgeToggle}
          className="focus-ring transition-press h-11 cursor-pointer rounded-sm border border-accent bg-transparent px-3.5 text-sm font-medium text-accent hover:bg-accent-soft active:scale-98"
        >
          Judge mode
        </button>
        <Link
          href="/tickets"
          className="focus-ring rounded-sm border border-transparent px-1 py-3 text-sm text-accent no-underline hover:underline"
        >
          Tickets
        </Link>
        <Link
          href="/replay"
          className="focus-ring rounded-sm border border-transparent px-1 py-3 text-sm text-accent no-underline hover:underline"
        >
          Replay
        </Link>
        <span className="eyebrow hidden text-ink-faint md:inline">
          Provably-fair sportsbook on Solana
        </span>
      </div>
    </header>
  );
}
