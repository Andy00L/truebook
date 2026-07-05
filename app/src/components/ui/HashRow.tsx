import { joinClassNames } from "@/lib/joinClassNames";
import { truncateMiddle } from "@/lib/format";
import { CopyButton } from "@/components/ui/CopyButton";

type HashRowProps = {
  label: string;
  /** Full value; rendered middle-truncated, copied in full. */
  value: string;
  /** Optional explorer destination for the external-link affordance. */
  href?: string;
  /** Label column width; w-24 fits receipts, w-20 fits the bet slip. */
  labelWidthClass?: "w-24" | "w-20" | "w-32";
  /** Large size for the public verify page's full-size receipt. */
  large?: boolean;
};

/** One proof line: label, truncated hash, copy, optional explorer link. */
export function HashRow({
  label,
  value,
  href,
  labelWidthClass = "w-24",
  large = false,
}: HashRowProps) {
  return (
    <div
      className={joinClassNames(
        "flex items-center gap-2 font-mono",
        large ? "text-sm" : "text-xs",
      )}
    >
      <span className={joinClassNames("flex-none text-ink-faint", labelWidthClass)}>
        {label}
      </span>
      <span
        title={value}
        className="overflow-hidden text-ellipsis whitespace-nowrap text-ink-muted"
      >
        {truncateMiddle(value)}
      </span>
      <span className="ml-auto flex items-center">
        <CopyButton value={value} ariaLabel={`Copy ${label}`} />
        {href ? (
          <a
            href={href}
            target="_blank"
            rel="noreferrer"
            aria-label={`${label} on explorer`}
            className="focus-ring -my-3 flex h-11 min-w-11 items-center justify-center rounded-sm border border-transparent text-xs text-accent no-underline hover:underline"
          >
            ↗
          </a>
        ) : null}
      </span>
    </div>
  );
}
