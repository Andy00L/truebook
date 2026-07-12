import { SurfaceCard } from "@/components/ui/SurfaceCard";
import { StatusPill } from "@/components/ui/StatusPill";
import { HashRow } from "@/components/ui/HashRow";
import { MarketGrid } from "@/components/ui/MarketGrid";
import { PriceEquation } from "@/components/ui/PriceEquation";
import { explorerTxUrl } from "@/lib/data/types";
import type { SettledMarketView } from "@/lib/data/types";

/** Post-match board (v3 noir): settled receipts and awaiting-proof markets. */
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
                <h3 className="m-0 text-sm font-normal text-ink-muted">
                  {settled.name} · {settled.groupLabel}
                </h3>
              </div>
              <div className="mt-4 flex min-h-13 items-center gap-3">
                <StatusPill variant="amber">Awaiting proof</StatusPill>
                <span className="text-sm text-ink-muted">
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
              className="animate-card-in p-5"
              style={{ animationDelay: `${enterDelayMs}ms` }}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="m-0 text-base font-medium text-ink">
                    {settled.name}
                  </h3>
                  <div className="mt-1 text-sm text-ink-muted">
                    {settled.resultLine}
                  </div>
                </div>
                <StatusPill variant="accent">Verified on Solana</StatusPill>
              </div>
              <div className="mt-3.5">
                <PriceEquation
                  consensusLabel={settled.breakdown.consensusLabel}
                  marginLabel={settled.breakdown.marginLabel}
                  servedLabel={settled.breakdown.servedLabel}
                  servedWord="served"
                />
              </div>
              <div className="mt-4 rounded-sm bg-elevated px-4.5 py-2">
                <HashRow
                  label="Day root"
                  value={settled.proof.dayRoot}
                  href={explorerTxUrl(settled.proof.verifyTx)}
                />
                <HashRow
                  label="Merkle path"
                  value={settled.proof.merklePath}
                  href={explorerTxUrl(settled.proof.verifyTx)}
                />
                <HashRow
                  label="Verify tx"
                  value={settled.proof.verifyTx}
                  href={explorerTxUrl(settled.proof.verifyTx)}
                />
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
              <h3 className="m-0 text-sm font-normal text-ink-muted">
                {settled.name} · {settled.groupLabel}
              </h3>
              <span className="text-xl font-light tabular-nums text-ink">
                {settled.servedOddsLabel}
              </span>
            </div>
            <div className="mt-2 text-sm text-ink-muted">
              {settled.resultLine}
            </div>
            <div className="mt-4 flex items-center gap-3.5">
              <StatusPill variant="accent">Verified on Solana</StatusPill>
              {settled.proof ? (
                <a
                  href={explorerTxUrl(settled.proof.verifyTx)}
                  target="_blank"
                  rel="noreferrer"
                  className="focus-ring rounded-full px-1 py-2 text-sm font-medium text-accent no-underline hover:underline"
                >
                  Verify tx
                </a>
              ) : null}
            </div>
          </SurfaceCard>
        );
      })}
    </MarketGrid>
  );
}
