"use client";

import { useRef, type ReactElement } from "react";
import { joinClassNames } from "@/lib/joinClassNames";

/**
 * The product's signature motion: every changing figure animates PER DIGIT.
 * A hidden static digit reserves the width; the live digit sits absolute over
 * it and rolls in with translateY + opacity + blur (450ms, 30ms stagger
 * between changing digits). Separators and suffixes stay static.
 * sourceRef: ui-design/returns (accepted exports, the shared odo() recipe).
 */

type OdometerNumberProps = {
  /** Already-formatted value, e.g. "94.24" or "1:54". */
  value: string;
  /** Roll every digit on first paint (the lobby vault count-in). */
  rollOnMount?: boolean;
  /** Delay before the mount roll starts, e.g. after the card enters. */
  mountDelayMs?: number;
  className?: string;
};

const DIGIT_STAGGER_MS = 30;
/** Plain spaces collapse inside inline-flex spans; keep the gap visible. */
const NON_BREAKING_SPACE = "\u00A0";

function isDigitCharacter(character: string): boolean {
  return character >= "0" && character <= "9";
}

/** Masks digits so every one of them reads as changed. */
function maskDigits(value: string): string {
  return value.replace(/[0-9]/g, "x");
}

export function OdometerNumber({
  value,
  rollOnMount = false,
  mountDelayMs = 0,
  className,
}: OdometerNumberProps) {
  // Previous value and a roll version, tracked across renders so only the
  // digits that changed remount with the roll animation (no effect needed).
  const lastValueRef = useRef<string | null>(null);
  const previousValueRef = useRef<string>(
    rollOnMount ? maskDigits(value) : value,
  );
  const rollVersionRef = useRef(0);
  if (lastValueRef.current !== null && lastValueRef.current !== value) {
    previousValueRef.current = lastValueRef.current;
    rollVersionRef.current += 1;
  }
  lastValueRef.current = value;

  let previousValue = previousValueRef.current;
  if (previousValue.length !== value.length) {
    previousValue = maskDigits(value);
  }

  const digitElements: ReactElement[] = [];
  let changedDigitIndex = 0;
  for (
    let characterIndex = 0;
    characterIndex < value.length;
    characterIndex += 1
  ) {
    const character = value[characterIndex];
    if (!isDigitCharacter(character)) {
      digitElements.push(
        <span key={`separator-${characterIndex}`}>
          {character === " " ? NON_BREAKING_SPACE : character}
        </span>,
      );
      continue;
    }
    const hasChanged = previousValue[characterIndex] !== character;
    const rollDelayMs = hasChanged
      ? mountDelayMs + changedDigitIndex * DIGIT_STAGGER_MS
      : 0;
    if (hasChanged) {
      changedDigitIndex += 1;
    }
    digitElements.push(
      <span
        key={`digit-${characterIndex}`}
        className="relative inline-block"
      >
        <span className="invisible inline-block">{character}</span>
        <span
          key={hasChanged ? `${character}-${rollVersionRef.current}` : character}
          className={joinClassNames(
            "absolute inset-x-0 top-0 text-center",
            hasChanged &&
              "animate-roll-in will-change-[transform,opacity,filter]",
          )}
          style={hasChanged ? { animationDelay: `${rollDelayMs}ms` } : undefined}
        >
          {character}
        </span>
      </span>,
    );
  }

  return (
    <span
      aria-label={value}
      role="img"
      className={joinClassNames("inline-flex", className)}
    >
      <span aria-hidden="true" className="inline-flex">
        {digitElements}
      </span>
    </span>
  );
}
