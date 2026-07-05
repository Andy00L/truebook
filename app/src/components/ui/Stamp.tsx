import type { ReactNode } from "react";
import { joinClassNames } from "@/lib/joinClassNames";

type StampProps = {
  /** Green closes an honest receipt; red marks a proven violation or refund. */
  tone: "accent" | "danger";
  children: ReactNode;
};

/** The stamp that closes a proof receipt: VERIFIED ON SOLANA and its kin. */
export function Stamp({ tone, children }: StampProps) {
  return (
    <span
      className={joinClassNames(
        "eyebrow inline-flex h-8 items-center rounded-sm border px-3 font-mono",
        tone === "accent" ? "border-accent text-accent" : "border-danger text-danger",
      )}
    >
      {children}
    </span>
  );
}
