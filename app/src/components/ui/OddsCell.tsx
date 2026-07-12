"use client";

import { useState } from "react";
import { joinClassNames } from "@/lib/joinClassNames";
import { OdometerNumber } from "@/components/ui/OdometerNumber";
import { PriceEquation } from "@/components/ui/PriceEquation";

/**
 * One clickable outcome cell (v3 noir): a raised panel with the odds at
 * 32px weight 300. On a price change only the changed digits roll (the
 * odometer) and a signed delta chip appears beside the label for 1.2s.
 * The cell detects price moves itself; no pulse plumbing needed.
 */

type DeltaChip = { text: string; isUp: boolean; key: number };

type OddsCellProps = {
  /** Outcome label above the price, e.g. "Yes" or "Over 2.5". */
  label: string;
  /** Decimal odds already formatted at two decimals. */
  priceLabel: string;
  /** Consensus figure for this outcome's transparency equation. */
  consensusLabel: string;
  marginLabel: string;
  isSelected?: boolean;
  onSelect: () => void;
};

export function OddsCell({
  label,
  priceLabel,
  consensusLabel,
  marginLabel,
  isSelected = false,
  onSelect,
}: OddsCellProps) {
  // Adjust-state-during-render: when the served price moves, arm the delta
  // chip; its animation ends hidden (fill mode both), so no timer is needed.
  const [lastPriceLabel, setLastPriceLabel] = useState(priceLabel);
  const [deltaChip, setDeltaChip] = useState<DeltaChip | null>(null);
  if (lastPriceLabel !== priceLabel) {
    const priceDifference =
      Number.parseFloat(priceLabel) - Number.parseFloat(lastPriceLabel);
    setLastPriceLabel(priceLabel);
    if (Number.isFinite(priceDifference) && priceDifference !== 0) {
      setDeltaChip((currentChip) => ({
        text: `${priceDifference > 0 ? "+" : "-"}${Math.abs(priceDifference).toFixed(2)}`,
        isUp: priceDifference > 0,
        key: (currentChip?.key ?? 0) + 1,
      }));
    }
  }

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={isSelected}
      className="transition-press focus-ring relative block min-w-0 flex-1 basis-0 cursor-pointer rounded-sm border-0 bg-elevated p-4 text-left text-ink hover:bg-lift"
    >
      {isSelected ? (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -inset-1 rounded-md border-2 border-accent"
        />
      ) : null}
      <span className="flex min-h-5 items-center gap-2 text-sm text-ink-muted">
        {label}
        {deltaChip ? (
          <span
            key={deltaChip.key}
            aria-hidden="true"
            className={joinClassNames(
              "animate-delta-chip text-sm font-medium tabular-nums",
              deltaChip.isUp ? "text-accent" : "text-danger",
            )}
          >
            {deltaChip.text}
          </span>
        ) : null}
      </span>
      <OdometerNumber
        value={priceLabel}
        className="mt-1.5 text-2xl font-light tabular-nums leading-tight tracking-tight"
      />
      <span className="mt-3 block">
        <PriceEquation
          consensusLabel={consensusLabel}
          marginLabel={marginLabel}
          servedLabel={priceLabel}
        />
      </span>
    </button>
  );
}
