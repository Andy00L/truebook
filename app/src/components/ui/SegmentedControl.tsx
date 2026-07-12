"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { joinClassNames } from "@/lib/joinClassNames";

/**
 * The segmented control (v3 noir): a pill track on raised with a sliding
 * lift indicator that animates translateX plus its measured width (250ms,
 * the one sanctioned width transition). Selected label ink 500, others muted.
 * sourceRef: ui-design/returns (accepted exports) and the reference DOM.
 */

export type SegmentedOption = {
  key: string;
  label: string;
  /** Optional count shown after the label at 70% opacity. */
  detail?: string;
};

type SegmentedControlProps = {
  options: ReadonlyArray<SegmentedOption>;
  activeKey: string;
  onSelect: (key: string) => void;
  ariaLabel: string;
  className?: string;
};

export function SegmentedControl({
  options,
  activeKey,
  onSelect,
  ariaLabel,
  className,
}: SegmentedControlProps) {
  const tabElementsRef = useRef<Map<string, HTMLButtonElement>>(new Map());
  const [indicator, setIndicator] = useState<{ x: number; width: number }>({
    x: 0,
    width: 0,
  });

  const measureIndicator = useCallback(() => {
    const activeTab = tabElementsRef.current.get(activeKey);
    if (!activeTab) {
      return;
    }
    setIndicator((currentIndicator) =>
      currentIndicator.x === activeTab.offsetLeft &&
      currentIndicator.width === activeTab.offsetWidth
        ? currentIndicator
        : { x: activeTab.offsetLeft, width: activeTab.offsetWidth },
    );
  }, [activeKey]);

  // The indicator tracks layout owned by the browser (font loading, resize),
  // so measurement runs in an effect against those external systems.
  useEffect(() => {
    measureIndicator();
    window.addEventListener("resize", measureIndicator);
    let fontsAreWatched = false;
    if (typeof document !== "undefined" && document.fonts) {
      fontsAreWatched = true;
      void document.fonts.ready.then(measureIndicator);
    }
    return () => {
      window.removeEventListener("resize", measureIndicator);
      // The fonts.ready promise cannot be cancelled; the setState guard in
      // measureIndicator keeps a late resolve harmless.
      void fontsAreWatched;
    };
  }, [measureIndicator]);

  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={joinClassNames(
        "relative inline-flex rounded-full bg-elevated p-[3px]",
        className,
      )}
    >
      <span
        aria-hidden="true"
        className="absolute bottom-[3px] left-0 top-[3px] rounded-full bg-lift transition-[transform,width] duration-250 ease-standard will-change-[transform,width]"
        style={{
          width: `${indicator.width}px`,
          transform: `translateX(${indicator.x}px)`,
        }}
      />
      {options.map((option) => {
        const isSelected = option.key === activeKey;
        return (
          <button
            key={option.key}
            type="button"
            role="tab"
            aria-selected={isSelected}
            onClick={() => onSelect(option.key)}
            ref={(tabElement) => {
              if (tabElement) {
                tabElementsRef.current.set(option.key, tabElement);
              } else {
                tabElementsRef.current.delete(option.key);
              }
            }}
            className={joinClassNames(
              "focus-ring relative z-10 cursor-pointer whitespace-nowrap rounded-full border-0 bg-transparent px-3.5 py-2 text-sm transition-[color] duration-120 ease-standard",
              isSelected ? "font-medium text-ink" : "font-normal text-ink-muted",
            )}
          >
            {option.label}
            {option.detail ? (
              <span className="ml-1.5 tabular-nums opacity-70">
                {option.detail}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
