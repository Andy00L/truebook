"use client";

import { useEffect, useRef, useState } from "react";
import { copyTextToClipboard } from "@/lib/clipboard";

type CopyButtonProps = {
  value: string;
  ariaLabel: string;
};

/** Inline "copy" affordance for hashes; flips to "copied" for 1.5 seconds. */
export function CopyButton({ value, ariaLabel }: CopyButtonProps) {
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
      className="focus-ring -my-3 flex h-11 min-w-11 cursor-pointer items-center justify-center rounded-sm border border-transparent bg-transparent font-mono text-2xs text-accent"
    >
      {hasCopied ? "copied" : "copy"}
    </button>
  );
}
