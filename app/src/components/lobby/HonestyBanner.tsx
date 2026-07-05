import { SurfaceCard } from "@/components/ui/SurfaceCard";

type HonestyBannerProps = {
  vaultLabel: string;
  openExposureLabel: string;
  marginLabel: string;
  ticketsAuditedLabel: string;
  violationsFoundLabel: string;
};

/** The house honesty banner: proof-of-reserves figures in one mono strip. */
export function HonestyBanner({
  vaultLabel,
  openExposureLabel,
  marginLabel,
  ticketsAuditedLabel,
  violationsFoundLabel,
}: HonestyBannerProps) {
  const figures: ReadonlyArray<{ label: string; value: string }> = [
    { label: "vault", value: vaultLabel },
    { label: "open exposure", value: openExposureLabel },
    { label: "margin", value: marginLabel },
    { label: "tickets audited", value: ticketsAuditedLabel },
    { label: "violations found", value: violationsFoundLabel },
  ];

  return (
    <SurfaceCard className="flex animate-card-in flex-wrap items-center gap-6 px-4 py-3.5 font-mono text-xs tabular-nums">
      {figures.map((figure) => (
        <span key={figure.label} className="flex gap-2">
          <span className="text-ink-faint">{figure.label}</span>
          <span className="text-ink">{figure.value}</span>
        </span>
      ))}
      <span className="ml-auto text-ink-muted">every price is auditable</span>
    </SurfaceCard>
  );
}
