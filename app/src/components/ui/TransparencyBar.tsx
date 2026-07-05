"use client";

import { useEffect, useState } from "react";

type TransparencyBarProps = {
  /** Names the popover for assistive tech: "Price breakdown for Home win". */
  marketName: string;
  consensusLabel: string;
  marginLabel: string;
  servedLabel: string;
  /** Width of the margin segment in px; scales with the displayed margin. */
  marginBasisPx?: number;
  /** Miniature variant for fixture cards: smaller legend, no popover. */
  compact?: boolean;
};

/**
 * The price transparency bar, TrueBook's secondary signature element: a thin
 * segmented track (consensus + margin) with the three numbers in mono and an
 * info popover repeating them with the audit line.
 */
export function TransparencyBar({
  marketName,
  consensusLabel,
  marginLabel,
  servedLabel,
  marginBasisPx = 24,
  compact = false,
}: TransparencyBarProps) {
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);

  // Escape closes the popover; window keyboard events live outside React.
  useEffect(() => {
    if (!isPopoverOpen) {
      return;
    }
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsPopoverOpen(false);
      }
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [isPopoverOpen]);

  return (
    <div className={compact ? "relative mt-3.5" : "relative mt-4"}>
      <div className="flex h-1 overflow-hidden rounded-sm">
        <div className="min-w-0 flex-1 bg-accent-deep" />
        <div
          className="flex-none bg-ink-faint"
          style={{ flexBasis: marginBasisPx }}
        />
      </div>
      <div
        className={
          compact
            ? "mt-2 flex items-center gap-3 font-mono text-2xs tabular-nums text-ink-muted"
            : "mt-2 flex items-center gap-3.5 font-mono text-xs tabular-nums text-ink-muted"
        }
      >
        <span>consensus {consensusLabel}</span>
        <span>margin {marginLabel}</span>
        <span className="ml-auto">your price {servedLabel}</span>
        {compact ? null : (
          <button
          type="button"
          onClick={() => setIsPopoverOpen((wasOpen) => !wasOpen)}
          aria-label={`Price breakdown for ${marketName}`}
          aria-expanded={isPopoverOpen}
          className="focus-ring -my-3.5 -ml-1.5 -mr-3.5 flex size-11 cursor-pointer items-center justify-center rounded-sm border border-transparent bg-transparent p-0"
        >
          <span className="flex size-4 items-center justify-center rounded-sm border border-ink-faint font-mono text-2xs text-ink-faint">
            i
          </span>
          </button>
        )}
      </div>
      {isPopoverOpen ? (
        <>
          <div
            className="fixed inset-0 z-20"
            onClick={() => setIsPopoverOpen(false)}
          />
          <div
            role="dialog"
            aria-label={`Price breakdown for ${marketName}`}
            className="absolute bottom-8 right-0 z-30 w-70 animate-fade-in rounded-md border border-border bg-elevated p-4 shadow-card"
          >
            <div className="flex justify-between font-mono text-sm tabular-nums">
              <span className="text-ink-muted">TxLINE consensus</span>
              <span className="text-ink">{consensusLabel}</span>
            </div>
            <div className="mt-2 flex justify-between font-mono text-sm tabular-nums">
              <span className="text-ink-muted">displayed margin</span>
              <span className="text-ink">{marginLabel}</span>
            </div>
            <div className="mt-2 flex justify-between font-mono text-sm tabular-nums">
              <span className="text-ink-muted">your price</span>
              <span className="text-ink">{servedLabel}</span>
            </div>
            <div className="my-3 border-t border-dashed border-border" />
            <p className="m-0 text-xs leading-relaxed text-ink-muted">
              Served price is auditable on chain.
            </p>
          </div>
        </>
      ) : null}
    </div>
  );
}
