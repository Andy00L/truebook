"use client";

import { useEffect, useState } from "react";
import { OdometerNumber } from "@/components/ui/OdometerNumber";
import { formatClock } from "@/lib/format";

type InPlayCountdownProps = {
  /** When the in-play window stops taking bets (epoch ms). */
  closesAtMs: number;
};

function secondsLeftUntil(closesAtMs: number): number {
  return Math.max(0, Math.floor((closesAtMs - Date.now()) / 1000));
}

/**
 * The betting-window clock of an in-play market: "closes 4:32" rolling down
 * every second (odometer digits, same rhythm as the bet slip countdown).
 */
export function InPlayCountdown({ closesAtMs }: InPlayCountdownProps) {
  const [secondsLeft, setSecondsLeft] = useState(() => secondsLeftUntil(closesAtMs));

  // A once-per-second browser timer keeps the window clock live.
  useEffect(() => {
    const countdownTimer = window.setInterval(() => {
      setSecondsLeft(secondsLeftUntil(closesAtMs));
    }, 1000);
    return () => window.clearInterval(countdownTimer);
  }, [closesAtMs]);

  if (secondsLeft <= 0) {
    return <span className="text-xs text-ink-faint">window closing</span>;
  }
  return (
    <span className="flex items-baseline gap-1.5 text-xs text-ink-muted">
      closes
      <OdometerNumber
        value={formatClock(secondsLeft)}
        className="font-mono text-xs tabular-nums text-ink"
      />
    </span>
  );
}
