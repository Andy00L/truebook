"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { StatusPill } from "@/components/ui/StatusPill";
import { SpinnerDot } from "@/components/ui/SpinnerDot";
import { CircleIconLink, IconLink } from "@/components/ui/Icon";
import { formatAmount, truncateMiddle } from "@/lib/format";
import { explorerTxUrl, type TicketView } from "@/lib/data/types";
import type { AuditResult } from "@/lib/chain/audit";
import type { ChainActionResult, ChainStage } from "@/lib/chain/placeBet";

type AuditPanelProps = {
  ticket: TicketView;
  /** Runs audit_ticket or audit_cash_out (+claim) by ticket status. */
  runAudit: (
    ticket: TicketView,
    onStage: (stage: ChainStage) => void,
  ) => Promise<AuditResult>;
  /** Reclaims the stake of a ticket a proven overcharge made refundable. */
  runRefund: (
    ticket: TicketView,
    onStage: (stage: ChainStage) => void,
  ) => Promise<ChainActionResult>;
  /** Called after any state-changing tx confirms, so the list refreshes. */
  onSettled: () => void;
};

/** Staged label for the pending spinner, honest about what is happening. */
function stageLabel(stage: ChainStage | null): string {
  if (stage === "signing") return "Approve in your wallet";
  if (stage === "confirming") return "Confirming on Solana";
  return "Fetching the consensus proof";
}

/**
 * The "Audit & earn" flow inside an expanded ticket (chain source). The judge
 * proves the ticket's (or cash-out's) served price against TxLINE consensus
 * from the browser: the server route supplies the merkle proof, the wallet
 * signs the on-chain audit. An honest verdict reads calm; a proven overcharge
 * shows the bounty earned and, for a ticket, unlocks the refund.
 */
export function AuditPanel({
  ticket,
  runAudit,
  runRefund,
  onSettled,
}: AuditPanelProps) {
  // Only a settled verdict is ever stored, so the render narrows cleanly.
  type SettledAudit = Extract<AuditResult, { ok: true }>;
  const [isAuditing, setIsAuditing] = useState(false);
  const [isRefunding, setIsRefunding] = useState(false);
  const [chainStage, setChainStage] = useState<ChainStage | null>(null);
  const [result, setResult] = useState<SettledAudit | null>(null);
  const [refundSignature, setRefundSignature] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const isCashOut = ticket.status === "cashedOut";
  const auditLabel = isCashOut ? "Audit this cash-out" : "Audit & earn 5%";

  const handleAudit = async () => {
    if (isAuditing) {
      return;
    }
    setErrorMessage(null);
    setIsAuditing(true);
    const auditResult = await runAudit(ticket, setChainStage);
    setChainStage(null);
    setIsAuditing(false);
    if (auditResult.ok) {
      setResult(auditResult);
      onSettled();
    } else {
      setErrorMessage(auditResult.reason);
    }
  };

  const handleRefund = async () => {
    if (isRefunding) {
      return;
    }
    setErrorMessage(null);
    setIsRefunding(true);
    const refundResult = await runRefund(ticket, setChainStage);
    setChainStage(null);
    setIsRefunding(false);
    if (refundResult.ok) {
      setRefundSignature(refundResult.signature);
      onSettled();
    } else {
      setErrorMessage(refundResult.reason);
    }
  };

  // The proof pending line, shared by the audit and the refund steps.
  const pendingLine = (
    <span className="flex items-center gap-2.5 text-sm text-ink-muted">
      <SpinnerDot />
      {stageLabel(chainStage)}
    </span>
  );

  return (
    <div className="mt-1 animate-card-in rounded-sm bg-field px-4 py-3.5">
      {result === null ? (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="min-w-0">
              <span className="block text-sm font-medium text-ink">
                {isCashOut
                  ? "Prove this cash-out against consensus"
                  : "Prove this price against consensus"}
              </span>
              <span className="mt-0.5 block text-xs text-ink-muted">
                {isCashOut
                  ? "A proven lowball repays the shortfall and pays you 5% of the stake."
                  : "A proven overcharge refunds the stake and pays you 5% of it."}
              </span>
            </span>
            {isAuditing ? (
              pendingLine
            ) : (
              <Button variant="primary" onClick={handleAudit}>
                {auditLabel}
              </Button>
            )}
          </div>
          {errorMessage ? (
            <div
              role="alert"
              className="mt-3 flex items-center justify-between gap-3 rounded-sm border border-danger bg-danger-soft px-4 py-3"
            >
              <span className="text-sm leading-normal text-ink">
                {errorMessage.length > 160
                  ? `${errorMessage.slice(0, 160)}…`
                  : errorMessage}
              </span>
              <button
                type="button"
                onClick={handleAudit}
                className="focus-ring flex-none cursor-pointer rounded-full border-0 bg-transparent px-1 py-1 text-sm font-medium text-accent"
              >
                Retry
              </button>
            </div>
          ) : null}
        </>
      ) : result.verdict === "honest" ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="min-w-0">
            <span className="block text-sm font-medium text-ink">
              Price verified honest against consensus
            </span>
            <span className="mt-0.5 block text-xs text-ink-muted">
              The served price sits within the stated margin. Nothing owed.
            </span>
          </span>
          <span className="flex flex-none items-center gap-2.5">
            <StatusPill variant="accent" animateIn>
              Honest
            </StatusPill>
            <CircleIconLink
              href={explorerTxUrl(result.auditSignature)}
              ariaLabel="Open the audit transaction in Solana Explorer"
            >
              <IconLink />
            </CircleIconLink>
          </span>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="min-w-0">
              <span className="block text-sm font-medium text-ink">
                {isCashOut ? "Lowball proven" : "Overcharge proven"}
              </span>
              <span className="mt-0.5 block text-xs text-ink-muted">
                You earned {formatAmount(result.bountyEarned)} USDT
                {isCashOut && result.shortfallRepaid > 0
                  ? `; ${formatAmount(result.shortfallRepaid)} USDT repaid to the bettor`
                  : ""}
                .
              </span>
            </span>
            <span className="flex flex-none items-center gap-2.5">
              <StatusPill variant="danger" animateIn>
                {isCashOut ? "Lowball" : "Overcharge"}
              </StatusPill>
              <CircleIconLink
                href={explorerTxUrl(result.auditSignature)}
                ariaLabel="Open the audit transaction in Solana Explorer"
              >
                <IconLink />
              </CircleIconLink>
            </span>
          </div>

          {result.settlementSignature ? (
            <div className="mt-2.5 flex items-center justify-between gap-3 border-t border-border pt-2.5">
              <span className="text-xs text-ink-muted">Repair paid</span>
              <span className="flex items-center gap-2.5">
                <span className="font-mono text-xs tabular-nums text-ink">
                  {truncateMiddle(result.settlementSignature)}
                </span>
                <CircleIconLink
                  href={explorerTxUrl(result.settlementSignature)}
                  ariaLabel="Open the repair transaction in Solana Explorer"
                >
                  <IconLink />
                </CircleIconLink>
              </span>
            </div>
          ) : null}

          {result.becameRefundable && refundSignature === null ? (
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
              <span className="text-sm text-ink-muted">
                This ticket is now refundable.
              </span>
              {isRefunding ? (
                pendingLine
              ) : (
                <Button variant="primary" onClick={handleRefund}>
                  Claim refund
                </Button>
              )}
            </div>
          ) : null}

          {refundSignature !== null ? (
            <div className="mt-3 flex items-center justify-between gap-3 border-t border-border pt-3">
              <span className="text-sm text-ink-muted">Stake refunded in full.</span>
              <span className="flex items-center gap-2.5">
                <StatusPill variant="accent" animateIn>
                  Refunded
                </StatusPill>
                <CircleIconLink
                  href={explorerTxUrl(refundSignature)}
                  ariaLabel="Open the refund transaction in Solana Explorer"
                >
                  <IconLink />
                </CircleIconLink>
              </span>
            </div>
          ) : null}

          {errorMessage ? (
            <div
              role="alert"
              className="mt-3 rounded-sm border border-danger bg-danger-soft px-4 py-3"
            >
              <span className="text-sm leading-normal text-ink">
                {errorMessage.length > 160
                  ? `${errorMessage.slice(0, 160)}…`
                  : errorMessage}
              </span>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
