import Link from "next/link";
import { joinClassNames } from "@/lib/joinClassNames";
import { ConnectWalletButton } from "@/components/wallet/ConnectWalletButton";

/**
 * The shared top bar (v3 noir): the wordmark, nav as ghost pills, and the
 * wallet chip right-aligned on chain screens.
 */

type TopBarProps = {
  /** Which nav pill reads as the current section. */
  active?: "tickets" | "replay";
  /** Present on the lobby, where judge mode opens as a panel. */
  onJudgeToggle?: () => void;
  /** Chain source shows the wallet chip; the demo stays wallet-free. */
  withWallet?: boolean;
};

const NAV_PILL_BASE =
  "focus-ring rounded-full border-0 px-3.5 py-2.5 text-sm font-medium no-underline transition-press";
const NAV_PILL_IDLE =
  "cursor-pointer bg-transparent text-ink-muted hover:bg-elevated hover:text-ink";
const NAV_PILL_ACTIVE = "bg-elevated text-ink";

export function TopBar({ active, onJudgeToggle, withWallet = false }: TopBarProps) {
  return (
    <header className="flex flex-wrap items-center gap-2 pb-4 pt-1">
      <Link
        href="/"
        className="focus-ring rounded-full text-lg font-medium tracking-tight text-ink no-underline"
      >
        TrueBook
      </Link>
      <nav aria-label="Primary" className="ml-2 flex items-center gap-1">
        {onJudgeToggle ? (
          <button
            type="button"
            onClick={onJudgeToggle}
            className={joinClassNames(NAV_PILL_BASE, NAV_PILL_IDLE)}
          >
            Judge mode
          </button>
        ) : (
          <Link
            href="/?judge=open"
            className={joinClassNames(NAV_PILL_BASE, NAV_PILL_IDLE)}
          >
            Judge mode
          </Link>
        )}
        <Link
          href="/tickets"
          aria-current={active === "tickets" ? "page" : undefined}
          className={joinClassNames(
            NAV_PILL_BASE,
            active === "tickets" ? NAV_PILL_ACTIVE : NAV_PILL_IDLE,
          )}
        >
          Tickets
        </Link>
        <Link
          href="/replay"
          aria-current={active === "replay" ? "page" : undefined}
          className={joinClassNames(
            NAV_PILL_BASE,
            active === "replay" ? NAV_PILL_ACTIVE : NAV_PILL_IDLE,
          )}
        >
          Replay
        </Link>
      </nav>
      <div className="ml-auto flex items-center">
        {withWallet ? (
          <ConnectWalletButton />
        ) : (
          <span className="hidden text-sm text-ink-faint md:inline">
            Provably-fair sportsbook on Solana devnet
          </span>
        )}
      </div>
    </header>
  );
}
