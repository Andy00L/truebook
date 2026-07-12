import { SurfaceCard } from "@/components/ui/SurfaceCard";
import { OdometerNumber } from "@/components/ui/OdometerNumber";
import { DotMatrixChart, type ChartPoint } from "@/components/ui/DotMatrixChart";
import { IconArrow } from "@/components/ui/Icon";

/**
 * The honesty header (v3 noir): the vault balance as the big thin number
 * rolling in digit by digit, four quiet stat blocks, and the dot-matrix
 * sparkline. It should read like opening a wealth app, not a stats bar.
 */

export type HonestyDelta = {
  /** Signed change plus percent, e.g. "+2.15 (2.3%)". */
  text: string;
  /** Muted period label, e.g. "past week". */
  period: string;
  isUp: boolean;
};

type HonestyBannerProps = {
  /** Vault figure without its unit, e.g. "94.24". */
  vaultAmount: string;
  /** "USDT" on chain, "USDC" in demo. */
  vaultUnit: string;
  /** Absent on chain until vault history lands (no invented deltas). */
  delta?: HonestyDelta;
  openExposureLabel: string;
  marginLabel: string;
  ticketsAuditedLabel: string;
  violationsFoundLabel: string;
};

/**
 * Decorative recent-activity shape anchored to the card, from the accepted
 * lobby export; real vault history wiring lands with the receipts work.
 * sourceRef: ui-design/returns/02-lobby (TrueBook Lobby.dc.html sparkline).
 */
const SPARKLINE_POINTS: ReadonlyArray<ChartPoint> = [
  { x: 10, y: 168 },
  { x: 78, y: 166 },
  { x: 146, y: 142 },
  { x: 214, y: 150 },
  { x: 282, y: 96 },
  { x: 350, y: 102 },
  { x: 418, y: 70 },
  { x: 486, y: 78 },
  { x: 554, y: 52 },
  { x: 622, y: 58 },
  { x: 690, y: 34 },
];

export function HonestyBanner({
  vaultAmount,
  vaultUnit,
  delta,
  openExposureLabel,
  marginLabel,
  ticketsAuditedLabel,
  violationsFoundLabel,
}: HonestyBannerProps) {
  const statBlocks: ReadonlyArray<{ label: string; value: string }> = [
    { label: "Open exposure", value: openExposureLabel },
    { label: "Margin", value: marginLabel },
    { label: "Tickets audited", value: ticketsAuditedLabel },
    { label: "Violations found", value: violationsFoundLabel },
  ];

  return (
    <SurfaceCard className="animate-card-in p-6">
      <div className="flex flex-wrap justify-between gap-8">
        <div>
          <div className="text-sm text-ink-muted">House vault</div>
          <div className="mt-1.5 flex items-baseline text-4xl font-light tabular-nums leading-tight tracking-tight text-ink">
            <OdometerNumber value={vaultAmount} rollOnMount mountDelayMs={200} />
            <span className="ml-2 text-xl font-light text-ink-muted">
              {vaultUnit}
            </span>
          </div>
          {delta ? (
            <div
              className={`mt-2.5 inline-flex items-center gap-1.5 text-sm font-medium tabular-nums ${delta.isUp ? "text-accent" : "text-danger"}`}
            >
              <IconArrow direction={delta.isUp ? "upRight" : "downRight"} />
              <span>{delta.text}</span>
              <span className="font-normal text-ink-muted">{delta.period}</span>
            </div>
          ) : null}
        </div>
        <div className="grid grid-cols-2 content-start gap-x-11 gap-y-5">
          {statBlocks.map((statBlock) => (
            <div key={statBlock.label}>
              <div className="text-sm text-ink-muted">{statBlock.label}</div>
              <div className="mt-1 text-xl font-light tabular-nums text-ink">
                {statBlock.value}
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="mt-6 h-27.5">
        <DotMatrixChart
          servedPoints={SPARKLINE_POINTS}
          viewWidth={700}
          viewHeight={200}
          fillBaselineY={200}
          drawOnLoad
          ariaLabel="House vault recent activity, dot-matrix sparkline"
        />
      </div>
    </SurfaceCard>
  );
}
