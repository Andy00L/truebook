import { joinClassNames } from "@/lib/joinClassNames";

type PriceEquationProps = {
  consensusLabel: string;
  marginLabel: string;
  servedLabel: string;
  /** "you" on live quotes, "served" on audited or refunded receipts. */
  servedWord?: "you" | "served";
  className?: string;
};

/**
 * The transparency equation, TrueBook's secondary signature (v3 noir): under
 * every quote, in mono, the consensus figure in data blue:
 * consensus 2.19 · margin 2.0% · you 2.15
 */
export function PriceEquation({
  consensusLabel,
  marginLabel,
  servedLabel,
  servedWord = "you",
  className,
}: PriceEquationProps) {
  return (
    <span
      className={joinClassNames(
        "font-mono text-xs tabular-nums text-ink-muted",
        className,
      )}
    >
      consensus <span className="text-blue">{consensusLabel}</span> · margin{" "}
      {marginLabel} · {servedWord} {servedLabel}
    </span>
  );
}
