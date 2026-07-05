import { SurfaceCard } from "@/components/ui/SurfaceCard";
import { StatusPill } from "@/components/ui/StatusPill";
import { Stamp } from "@/components/ui/Stamp";
import { HashRow } from "@/components/ui/HashRow";
import { MarketGrid } from "@/components/ui/MarketGrid";
import { explorerTxUrl } from "@/lib/data/types";
import type { SettledMarketView } from "@/lib/data/types";

/** Post-match board: settlement receipts and awaiting-proof markets. */
export function PostMatchBoard({
  settledMarkets,
}: {
  settledMarkets: ReadonlyArray<SettledMarketView>;
}) {
  return (
    <MarketGrid>
      {settledMarkets.map((settled, cardIndex) => {
        const enterDelayMs = cardIndex * 40;

        if (settled.awaitingNote) {
          return (
            <SurfaceCard
              key={settled.name}
              className="animate-card-in p-5"
              style={{ animationDelay: `${enterDelayMs}ms` }}
            >
              <div className="flex items-baseline justify-between gap-3 opacity-55">
                <h3 className="m-0 text-base font-semibold text-ink">
                  {settled.name}
                </h3>
                <span className="eyebrow font-mono text-ink-faint">
                  {settled.groupLabel}
                </span>
              </div>
              <div className="mt-5 flex min-h-13 items-center gap-3">
                <StatusPill variant="amber">AWAITING PROOF</StatusPill>
                <span className="text-sm text-ink-faint">
                  {settled.awaitingNote}
                </span>
              </div>
            </SurfaceCard>
          );
        }

        if (settled.breakdown && settled.proof) {
          return (
            <SurfaceCard
              key={settled.name}
              elevated
              className="receipt-edge animate-card-in p-5"
              style={{ animationDelay: `${enterDelayMs}ms` }}
            >
              <div className="eyebrow text-ink-faint">Settlement receipt</div>
              <div className="mt-2.5 flex items-baseline justify-between gap-3">
                <h3 className="m-0 text-lg font-semibold text-ink">
                  {settled.name}
                </h3>
                <span className="text-sm text-ink-muted">
                  {settled.resultLine}
                </span>
              </div>
              <div className="mt-3.5 flex flex-col gap-2 font-mono text-sm tabular-nums">
                <div className="flex justify-between">
                  <span className="text-ink-muted">consensus</span>
                  <span className="text-ink">
                    {settled.breakdown.consensusLabel}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-ink-muted">margin</span>
                  <span className="text-ink">
                    {settled.breakdown.marginLabel}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-ink-muted">served price</span>
                  <span className="text-ink">
                    {settled.breakdown.servedLabel}
                  </span>
                </div>
              </div>
              <div className="mb-3 mt-4 border-t border-dashed border-border" />
              <div className="flex flex-col gap-1">
                <HashRow
                  label="day root"
                  value={settled.proof.dayRoot}
                  href={explorerTxUrl(settled.proof.verifyTx)}
                />
                <HashRow
                  label="merkle path"
                  value={settled.proof.merklePath}
                  href={explorerTxUrl(settled.proof.verifyTx)}
                />
                <HashRow
                  label="verify tx"
                  value={settled.proof.verifyTx}
                  href={explorerTxUrl(settled.proof.verifyTx)}
                />
              </div>
              <div className="mt-4">
                <Stamp tone="accent">VERIFIED ON SOLANA</Stamp>
              </div>
            </SurfaceCard>
          );
        }

        return (
          <SurfaceCard
            key={settled.name}
            className="animate-card-in p-5"
            style={{ animationDelay: `${enterDelayMs}ms` }}
          >
            <div className="flex items-baseline justify-between gap-3">
              <h3 className="m-0 text-base font-semibold text-ink">
                {settled.name}
              </h3>
              <span className="eyebrow font-mono text-ink-faint">
                {settled.groupLabel}
              </span>
            </div>
            <div className="mt-3.5 flex items-center justify-between">
              <span className="text-sm text-ink-muted">
                {settled.resultLine}
              </span>
              <span className="font-mono text-lg font-semibold tabular-nums text-ink">
                {settled.servedOddsLabel}
              </span>
            </div>
            <div className="mt-3.5 border-t border-dashed border-border" />
            <div className="mt-3 flex items-center gap-3">
              <StatusPill variant="accent">VERIFIED ON SOLANA</StatusPill>
              {settled.proof ? (
                <a
                  href={explorerTxUrl(settled.proof.verifyTx)}
                  target="_blank"
                  rel="noreferrer"
                  className="focus-ring rounded-sm border border-transparent px-1 py-3 font-mono text-xs text-accent no-underline hover:underline"
                >
                  verify tx ↗
                </a>
              ) : null}
            </div>
          </SurfaceCard>
        );
      })}
    </MarketGrid>
  );
}
