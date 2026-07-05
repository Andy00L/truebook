import { joinClassNames } from "@/lib/joinClassNames";

export type OddsPulse = "shorten" | "lengthen" | null;

type OddsCellProps = {
  /** Outcome label above the price, e.g. "France" or "Over 2.5". */
  label: string;
  /** Decimal odds already formatted at two decimals. */
  priceLabel: string;
  /** The live or best cell carries the accent border at rest. */
  isBest?: boolean;
  isSelected?: boolean;
  /** 300ms background pulse on a price move: green shorten, red lengthen. */
  pulse?: OddsPulse;
  onSelect: () => void;
};

/** One clickable outcome cell on a market card. */
export function OddsCell({
  label,
  priceLabel,
  isBest = false,
  isSelected = false,
  pulse = null,
  onSelect,
}: OddsCellProps) {
  const backgroundClass =
    pulse === "shorten"
      ? "bg-accent-soft"
      : pulse === "lengthen"
        ? "bg-danger-soft"
        : isSelected
          ? "bg-accent-soft"
          : "bg-elevated hover:bg-border";

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={isSelected}
      className={joinClassNames(
        "transition-press focus-ring flex min-h-18 min-w-28 flex-1 basis-0 cursor-pointer flex-col items-center justify-center gap-1.5 rounded-sm border p-3 active:scale-98",
        backgroundClass,
        isSelected || isBest ? "border-accent" : "border-border",
      )}
    >
      <span className="eyebrow text-ink-muted">{label}</span>
      <span className="font-mono text-xl font-semibold tabular-nums text-ink">
        {priceLabel}
      </span>
    </button>
  );
}
