"use client";

import { useEffect, useRef, useState } from "react";
import { copyTextToClipboard } from "@/lib/clipboard";
import { IconCheck, IconCopy } from "@/components/ui/Icon";
import { joinClassNames } from "@/lib/joinClassNames";

type CopyButtonProps = {
  value: string;
  ariaLabel: string;
  /** Lift reads one step above raised panels; elevated sits on cards. */
  surface?: "elevated" | "lift";
};

/** Copy affordance on a 32px circle; flips to a check for 1.5 seconds. */
export function CopyButton({
  value,
  ariaLabel,
  surface = "elevated",
}: CopyButtonProps) {
  const [hasCopied, setHasCopied] = useState(false);
  const resetTimerRef = useRef<number | null>(null);

  // Cleanup for the browser timeout (a system React does not own).
  useEffect(() => {
    return () => {
      if (resetTimerRef.current !== null) {
        window.clearTimeout(resetTimerRef.current);
      }
    };
  }, []);

  const handleCopyClick = async () => {
    const copyResult = await copyTextToClipboard(value);
    if (!copyResult.ok) {
      return;
    }
    setHasCopied(true);
    if (resetTimerRef.current !== null) {
      window.clearTimeout(resetTimerRef.current);
    }
    resetTimerRef.current = window.setTimeout(() => setHasCopied(false), 1500);
  };

  return (
    <button
      type="button"
      onClick={handleCopyClick}
      aria-label={ariaLabel}
      className={joinClassNames(
        "transition-press focus-ring relative inline-flex size-8 flex-none cursor-pointer items-center justify-center rounded-full border-0 hover:brightness-130",
        surface === "lift" ? "bg-lift" : "bg-elevated",
        hasCopied ? "text-accent" : "text-ink",
      )}
    >
      <span
        className={joinClassNames(
          "absolute inline-flex transition-opacity duration-120 ease-standard",
          hasCopied ? "opacity-0" : "opacity-100",
        )}
      >
        <IconCopy />
      </span>
      <span
        className={joinClassNames(
          "absolute inline-flex transition-opacity duration-120 ease-standard",
          hasCopied ? "opacity-100" : "opacity-0",
        )}
      >
        <IconCheck />
      </span>
    </button>
  );
}
