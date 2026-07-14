"use client";

import { useState } from "react";
import { SpinnerDot } from "@/components/ui/SpinnerDot";

type DownloadReceiptButtonProps = {
  ticketAddress: string;
};

type DownloadState =
  | { status: "idle" }
  | { status: "pending" }
  | { status: "error"; reason: string };

/**
 * Fetches the ticket's portable proof receipt from /api/receipt and hands it
 * to the browser as a JSON download. The file re-verifies offline-of-us with
 * `keeper verify-receipt`: chain data and merkle proofs only.
 */
export function DownloadReceiptButton({
  ticketAddress,
}: DownloadReceiptButtonProps) {
  const [downloadState, setDownloadState] = useState<DownloadState>({
    status: "idle",
  });

  const handleDownload = async () => {
    if (downloadState.status === "pending") {
      return;
    }
    setDownloadState({ status: "pending" });
    let response: Response;
    try {
      response = await fetch(
        `/api/receipt?ticket=${encodeURIComponent(ticketAddress)}`,
      );
    } catch {
      setDownloadState({
        status: "error",
        reason: "Could not reach the receipt service. Retry shortly.",
      });
      return;
    }
    if (!response.ok) {
      let reason = `The receipt service answered HTTP ${response.status}.`;
      try {
        const failureBody = (await response.json()) as { reason?: string };
        if (typeof failureBody.reason === "string") {
          reason = failureBody.reason;
        }
      } catch {
        // Keep the generic HTTP reason.
      }
      setDownloadState({ status: "error", reason });
      return;
    }
    const receiptText = await response.text();
    const receiptBlob = new Blob([receiptText], { type: "application/json" });
    const objectUrl = URL.createObjectURL(receiptBlob);
    const downloadAnchor = document.createElement("a");
    downloadAnchor.href = objectUrl;
    downloadAnchor.download = `truebook-receipt-${ticketAddress.slice(0, 8)}.json`;
    downloadAnchor.click();
    URL.revokeObjectURL(objectUrl);
    setDownloadState({ status: "idle" });
  };

  if (downloadState.status === "pending") {
    return (
      <span className="flex items-center gap-2.5 px-1 py-1 text-sm text-ink-muted">
        <SpinnerDot />
        Assembling the proofs
      </span>
    );
  }

  return (
    <span className="flex min-w-0 flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={handleDownload}
        className="focus-ring cursor-pointer rounded-full border-0 bg-transparent px-1 py-1 text-sm font-medium text-accent hover:underline"
      >
        Download receipt
      </button>
      {downloadState.status === "error" ? (
        <span role="alert" className="text-xs leading-normal text-danger">
          {downloadState.reason.length > 120
            ? `${downloadState.reason.slice(0, 120)}…`
            : downloadState.reason}
        </span>
      ) : null}
    </span>
  );
}
