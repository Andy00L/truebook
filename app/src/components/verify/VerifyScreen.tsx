"use client";

import { useState } from "react";
import Link from "next/link";
import { SurfaceCard } from "@/components/ui/SurfaceCard";
import { StatusPill } from "@/components/ui/StatusPill";
import { Stamp } from "@/components/ui/Stamp";
import { HashRow } from "@/components/ui/HashRow";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorPanel } from "@/components/ui/ErrorPanel";
import { EmptyState } from "@/components/ui/EmptyState";
import { CopyButton } from "@/components/ui/CopyButton";
import { MascotDribble } from "@/components/ui/MascotDribble";
import { explorerTxUrl } from "@/lib/data/types";
import type { VerifyMarketView } from "@/lib/data/demoVerify";

export type VerifyScreenView = "resolved" | "loading" | "error";

type VerifyScreenProps = {
  market: VerifyMarketView | null;
  initialView: VerifyScreenView;
};

function VerifySkeleton() {
  return (
    <div aria-hidden="true" className="flex flex-col gap-4">
      <div>
        <Skeleton className="h-3 w-55" />
        <Skeleton className="mt-3 h-7 w-90 max-w-4/5" />
        <Skeleton className="mt-2.5 h-3.5 w-40" />
      </div>
      <SurfaceCard className="p-6">
        <Skeleton className="h-3 w-35" style={{ animationDelay: "120ms" }} />
        <Skeleton className="mt-3.5 h-10 w-30" style={{ animationDelay: "120ms" }} />
        <Skeleton className="mt-3 h-3.5 w-7/10" style={{ animationDelay: "120ms" }} />
      </SurfaceCard>
      <SurfaceCard className="flex flex-col gap-3 p-6">
        <Skeleton className="h-3 w-35" style={{ animationDelay: "240ms" }} />
        {[0, 1, 2, 3].map((rowIndex) => (
          <Skeleton
            key={rowIndex}
            className="h-4 w-full"
            style={{ animationDelay: "240ms" }}
          />
        ))}
        <Skeleton className="h-8 w-45" style={{ animationDelay: "240ms" }} />
      </SurfaceCard>
    </div>
  );
}

/** Shareable proof page: one market's resolution, verifiable by anyone. */
export function VerifyScreen({ market, initialView }: VerifyScreenProps) {
  const [view, setView] = useState<VerifyScreenView>(initialView);

  return (
    <div className="mx-auto w-full max-w-200 px-4 pb-18 pt-5 sm:px-8">
      <div className="flex items-center justify-between gap-4 pb-7 pt-1">
        <div className="flex items-center gap-3">
          <MascotDribble scale={0.4} />
          <Link
            href="/"
            className="focus-ring rounded-sm border border-transparent text-base font-semibold tracking-wide text-ink no-underline"
          >
            TrueBook
          </Link>
          <span aria-hidden="true" className="text-ink-faint">
            /
          </span>
          <span aria-current="page" className="text-sm text-ink-muted">
            Verify
          </span>
        </div>
        {market ? (
          <span className="flex items-center gap-1 font-mono text-xs text-accent">
            <CopyButton value={market.pageLink} ariaLabel="Copy page link" />
            page link
          </span>
        ) : null}
      </div>

      {!market ? (
        <EmptyState
          message="This market is not in the verification index."
          action={
            <Link
              href="/"
              className="focus-ring rounded-sm border border-transparent px-2 py-3 text-sm text-accent no-underline hover:underline"
            >
              Browse fixtures →
            </Link>
          }
        />
      ) : view === "loading" ? (
        <VerifySkeleton />
      ) : (
        <>
          <div className="animate-card-in">
            <div className="eyebrow text-ink-faint">
              Public verification · no wallet needed
            </div>
            <h1 className="mb-0 mt-2.5 text-2xl font-semibold text-ink">
              {market.fixtureName}
            </h1>
            <div className="mt-1.5 flex flex-wrap items-baseline gap-4">
              <span className="text-base text-ink-muted">
                Market: {market.marketName}
              </span>
              <span className="font-mono text-base tabular-nums text-ink-muted">
                {market.competitionLine}
              </span>
              {market.status === "verified" && market.settledLine ? (
                <span className="font-mono text-base tabular-nums text-ink-faint">
                  {market.settledLine}
                </span>
              ) : null}
            </div>
          </div>

          {view === "error" ? (
            <div className="mt-5">
              <ErrorPanel
                title="Couldn't load the proof"
                message="The proof index didn't respond. The on-chain record is unaffected."
                onRetry={() => setView("resolved")}
              />
            </div>
          ) : market.status === "verified" ? (
            <>
              <SurfaceCard
                className="mt-5 animate-card-in p-6"
                style={{ animationDelay: "40ms" }}
              >
                <div className="eyebrow text-ink-faint">Verified outcome</div>
                <div className="mt-3 flex flex-wrap items-baseline gap-5">
                  <span className="font-mono text-4xl font-semibold leading-none tabular-nums text-accent">
                    {market.outcomeLabel}
                  </span>
                  <span className="font-mono text-lg tabular-nums text-ink">
                    {market.outcomeStatement}
                  </span>
                </div>
              </SurfaceCard>

              <SurfaceCard
                elevated
                className="receipt-edge mt-4 animate-card-in p-6"
                style={{ animationDelay: "80ms" }}
              >
                <div className="eyebrow text-ink-faint">Proof receipt</div>
                {market.dayRoot && market.verifyTx ? (
                  <>
                    <div className="mt-4">
                      <HashRow
                        large
                        labelWidthClass="w-32"
                        label="day root"
                        value={market.dayRoot}
                        href={explorerTxUrl(market.verifyTx)}
                      />
                    </div>
                    {market.merkleNodes && market.merkleNodes.length > 0 ? (
                      <>
                        <div className="my-3 border-t border-dashed border-border" />
                        <div className="eyebrow text-ink-faint">Merkle path</div>
                        <div className="mt-2 flex flex-col gap-1">
                          {market.merkleNodes.map((merkleNode) => (
                            <HashRow
                              key={merkleNode.label}
                              large
                              labelWidthClass="w-32"
                              label={merkleNode.label}
                              value={merkleNode.hash}
                              href={explorerTxUrl(market.verifyTx ?? "")}
                            />
                          ))}
                        </div>
                      </>
                    ) : null}
                    <div className="my-3 border-t border-dashed border-border" />
                    <HashRow
                      large
                      labelWidthClass="w-32"
                      label="verify tx"
                      value={market.verifyTx}
                      href={explorerTxUrl(market.verifyTx)}
                    />
                    <div className="mt-5">
                      <Stamp tone="accent">VERIFIED ON SOLANA</Stamp>
                    </div>
                  </>
                ) : null}
              </SurfaceCard>
            </>
          ) : (
            <SurfaceCard
              className="mt-5 animate-card-in p-6"
              style={{ animationDelay: "40ms" }}
            >
              <div className="eyebrow text-ink-faint">Outcome</div>
              <div className="mt-3.5 flex flex-wrap items-center gap-4">
                <StatusPill variant="amber">AWAITING PROOF</StatusPill>
                <span className="text-sm text-ink-muted">
                  This market has not been resolved yet.
                </span>
              </div>
              <div className="mt-4 flex flex-col gap-2 font-mono text-sm tabular-nums">
                <div className="flex justify-between gap-4">
                  <span className="text-ink-muted">kickoff</span>
                  <span className="text-ink">{market.kickoffLine}</span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-ink-muted">resolution window</span>
                  <span className="text-ink">within 15 min of full time</span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-ink-muted">proof publishes with</span>
                  <span className="text-ink">day root · 00:00 UTC</span>
                </div>
              </div>
              <p className="mt-4 text-xs leading-normal text-ink-faint">
                Bookmark this page: the receipt renders here the moment the
                verify tx lands.
              </p>
            </SurfaceCard>
          )}

          {view !== "error" ? (
            <p className="mt-7 text-center font-mono text-xs text-ink-faint">
              resolved by a TxLINE merkle proof, not a trusted oracle
            </p>
          ) : null}
        </>
      )}
    </div>
  );
}
