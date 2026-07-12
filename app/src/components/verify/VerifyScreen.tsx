"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { SurfaceCard } from "@/components/ui/SurfaceCard";
import { StatusPill } from "@/components/ui/StatusPill";
import { HashRow } from "@/components/ui/HashRow";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorPanel } from "@/components/ui/ErrorPanel";
import { EmptyState } from "@/components/ui/EmptyState";
import { OdometerNumber } from "@/components/ui/OdometerNumber";
import { IconCheck, IconLink } from "@/components/ui/Icon";
import { copyTextToClipboard } from "@/lib/clipboard";
import { joinClassNames } from "@/lib/joinClassNames";
import { explorerTxUrl } from "@/lib/data/types";
import type { VerifyMarketView } from "@/lib/data/demoVerify";

export type VerifyScreenView = "resolved" | "loading" | "error";

type VerifyScreenProps = {
  market: VerifyMarketView | null;
  initialView: VerifyScreenView;
};

/** Copy-link pill; the icon flips to a check for 1.5 seconds. */
function CopyLinkButton({ pageLink }: { pageLink: string }) {
  const [hasCopied, setHasCopied] = useState(false);
  const resetTimerRef = useRef<number | null>(null);

  // Cleanup for the browser timeout (a system React does not own).
  useEffect(() => {
    return () => {
      if (resetTimerRef.current !== null) {
        window.clearTimeout(resetTimerRef.current);
      }
    };
  }, []);

  const handleCopyClick = async () => {
    const copyResult = await copyTextToClipboard(pageLink);
    if (!copyResult.ok) {
      return;
    }
    setHasCopied(true);
    if (resetTimerRef.current !== null) {
      window.clearTimeout(resetTimerRef.current);
    }
    resetTimerRef.current = window.setTimeout(() => setHasCopied(false), 1500);
  };

  return (
    <button
      type="button"
      onClick={handleCopyClick}
      className="transition-press focus-ring inline-flex h-10 cursor-pointer items-center gap-2 rounded-full border-0 bg-elevated px-4.5 text-sm font-medium text-ink hover:brightness-130 active:scale-97"
    >
      <span
        className={joinClassNames(
          "relative inline-flex size-4 items-center justify-center transition-[color] duration-120 ease-standard",
          hasCopied && "text-accent",
        )}
      >
        <span
          className={joinClassNames(
            "absolute inline-flex transition-opacity duration-120 ease-standard",
            hasCopied ? "opacity-0" : "opacity-100",
          )}
        >
          <IconLink />
        </span>
        <span
          className={joinClassNames(
            "absolute inline-flex transition-opacity duration-120 ease-standard",
            hasCopied ? "opacity-100" : "opacity-0",
          )}
        >
          <IconCheck />
        </span>
      </span>
      Copy link
    </button>
  );
}

function VerifySkeleton() {
  return (
    <SurfaceCard aria-hidden="true" className="w-full max-w-140 p-6">
      <Skeleton className="h-3 w-58" />
      <Skeleton className="mt-4.5 h-10 w-48" />
      <Skeleton className="mt-3.5 h-6.5 w-33 rounded-full" />
      <Skeleton className="mt-4 h-3 w-62" />
      <div className="mt-5.5 rounded-sm bg-elevated px-4.5 py-4">
        {[0, 1, 2].map((rowIndex) => (
          <div
            key={rowIndex}
            className="flex items-center justify-between py-2.5"
          >
            <Skeleton className="h-3 w-22" />
            <Skeleton className="h-3 w-38" />
          </div>
        ))}
      </div>
    </SurfaceCard>
  );
}

/**
 * Shareable statement page (v3 noir): one monumental card, the outcome as
 * the page's one hero figure, the verdict pill in the silence after it, the
 * proof block on raised. A stranger opens this on a phone and trusts it
 * without trusting our site.
 */
export function VerifyScreen({ market, initialView }: VerifyScreenProps) {
  const [view, setView] = useState<VerifyScreenView>(initialView);

  return (
    <div className="mx-auto flex w-full flex-col items-center px-4 pb-20 pt-16">
      <Link
        href="/"
        className="focus-ring mb-8 rounded-full text-base font-medium tracking-tight text-ink no-underline"
      >
        TrueBook
      </Link>

      {!market ? (
        <div className="w-full max-w-140">
          <EmptyState
            message="Market not found. Nothing is anchored at this address on devnet."
            action={
              <Link
                href="/"
                className="focus-ring rounded-full px-2 py-2 text-sm font-medium text-accent no-underline hover:underline"
              >
                Back to the lobby
              </Link>
            }
          />
        </div>
      ) : view === "loading" ? (
        <VerifySkeleton />
      ) : view === "error" ? (
        <div className="w-full max-w-140">
          <ErrorPanel
            title="The chain didn't answer"
            message="The devnet RPC did not respond. The proof is still on chain; try again."
            onRetry={() => setView("resolved")}
          />
        </div>
      ) : (
        <>
          <SurfaceCard className="w-full max-w-140 animate-card-in p-6">
            <div className="text-sm text-ink-muted">
              {market.fixtureName} · {market.marketName} ·{" "}
              {market.competitionLine}
            </div>

            {market.status === "verified" ? (
              <>
                <div className="mt-3.5 text-4xl font-light leading-tight tracking-tight text-ink">
                  <OdometerNumber
                    value={`${market.outcomeLabel} holds`}
                    rollOnMount
                    mountDelayMs={150}
                  />
                </div>
                <div className="mt-3.5 flex flex-wrap items-center gap-3">
                  <StatusPill variant="accent" animateIn animateInDelayMs={820}>
                    Verified on Solana
                  </StatusPill>
                  <span className="text-sm text-ink-muted">
                    {market.outcomeStatement}
                  </span>
                </div>
                {market.settledLine ? (
                  <div className="mt-3 font-mono text-xs tabular-nums text-ink-muted">
                    {market.settledLine}
                  </div>
                ) : null}
              </>
            ) : (
              <>
                <div className="mt-3.5 text-4xl font-light leading-tight tracking-tight text-ink-muted">
                  Locked
                </div>
                <div className="mt-3.5 flex flex-wrap items-center gap-3">
                  <StatusPill variant="amber">Awaiting proof</StatusPill>
                  <span className="text-sm text-ink-muted">
                    settles after the score proof anchors
                  </span>
                </div>
                <div className="mt-4 flex flex-col gap-1 font-mono text-xs tabular-nums text-ink-muted">
                  <span>kickoff {market.kickoffLine}</span>
                  <span>resolution within 15 min of full time</span>
                </div>
              </>
            )}

            {market.status === "verified" &&
            market.dayRoot &&
            market.verifyTx ? (
              <>
                <div className="my-5 border-t border-border" />
                <div className="rounded-sm bg-elevated px-4.5 py-2.5">
                  <HashRow
                    label="Day root"
                    value={market.dayRoot}
                    href={explorerTxUrl(market.verifyTx)}
                  />
                  {(market.merkleNodes ?? []).map((merkleNode) => (
                    <HashRow
                      key={merkleNode.label}
                      label={merkleNode.label}
                      value={merkleNode.hash}
                      href={explorerTxUrl(market.verifyTx ?? "")}
                    />
                  ))}
                  <HashRow
                    label="Verify tx"
                    value={market.verifyTx}
                    href={explorerTxUrl(market.verifyTx)}
                  />
                </div>
              </>
            ) : null}
          </SurfaceCard>

          <div className="mt-6 flex max-w-140 flex-col items-center gap-4 text-center">
            <p className="m-0 text-sm leading-normal text-ink-muted">
              Re-verify independently: fetch the day root PDA and replay the
              verify tx against the TxLINE oracle. No TrueBook server involved.
            </p>
            <CopyLinkButton pageLink={market.pageLink} />
          </div>
        </>
      )}
    </div>
  );
}
