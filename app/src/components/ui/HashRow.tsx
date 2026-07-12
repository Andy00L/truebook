import { truncateMiddle } from "@/lib/format";
import { CopyButton } from "@/components/ui/CopyButton";
import { CircleIconLink, IconArrow } from "@/components/ui/Icon";

type HashRowProps = {
  label: string;
  /** Full value; rendered middle-truncated, copied in full. */
  value: string;
  /** Optional explorer destination for the external-link circle. */
  href?: string;
  /** Circles read lift inside raised proof panels, elevated on cards. */
  surface?: "elevated" | "lift";
};

/** One proof line: muted label left; mono value, copy, explorer right. */
export function HashRow({ label, value, href, surface = "lift" }: HashRowProps) {
  return (
    <div className="flex items-center justify-between gap-4 py-1.5">
      <span className="flex-none text-sm text-ink-muted">{label}</span>
      <span className="flex min-w-0 items-center gap-2">
        <span
          title={value}
          className="overflow-hidden text-ellipsis whitespace-nowrap font-mono text-xs tabular-nums text-ink"
        >
          {truncateMiddle(value)}
        </span>
        <CopyButton value={value} ariaLabel={`Copy ${label}`} surface={surface} />
        {href ? (
          <CircleIconLink
            href={href}
            ariaLabel={`Open ${label} in the explorer`}
            surface={surface}
          >
            <IconArrow direction="upRight" />
          </CircleIconLink>
        ) : null}
      </span>
    </div>
  );
}
