/**
 * Demo ticket book: one ticket per state (live, won, lost, refunded after a
 * proven overcharge), with the realistic figures validated in the design
 * session. The chain provider will list real Ticket accounts by bettor.
 */

export type TicketStatus = "live" | "won" | "lost" | "refunded";

export type TicketProof =
  | {
      kind: "priceOnly";
      quoteId: string;
      auditHref: string;
      note: string;
    }
  | {
      kind: "settled";
      dayRoot: string;
      merklePath?: string;
      verifyTx: string;
      stamp: "verified" | "overcharge";
      receiptLink: string;
      verifyPageHref?: string;
    };

export type TicketView = {
  ticketId: string;
  marketName: string;
  pickLabel: string;
  fixtureLine: string;
  status: TicketStatus;
  stakeLabel: string;
  oddsLabel: string;
  /** Third summary column: potential, payout, or refunded amount. */
  amountColumnTitle: "potential" | "payout" | "refunded";
  amountLabel: string;
  /** Expanded left panel. */
  receiptTitle: "Open ticket" | "Proof receipt";
  outcomeLine?: string;
  receiptRows: ReadonlyArray<{
    label: string;
    value: string;
    tone?: "danger";
  }>;
  priceLine: string;
  proof: TicketProof;
};

export const DEMO_TICKETS: ReadonlyArray<TicketView> = [
  {
    ticketId: "ticket-corners-live",
    marketName: "Second-half corners over 4.5",
    pickLabel: "Over 4.5",
    fixtureLine: "France vs Argentina · FIFA World Cup final",
    status: "live",
    stakeLabel: "250.00",
    oddsLabel: "1.85",
    amountColumnTitle: "potential",
    amountLabel: "462.50",
    receiptTitle: "Open ticket",
    receiptRows: [
      { label: "stake", value: "250.00 USDC" },
      { label: "quoted odds", value: "1.85" },
      { label: "potential payout", value: "462.50 USDC" },
      { label: "placed", value: "Jul 5 · 20:14:32 UTC" },
    ],
    priceLine: "consensus 1.88 · margin 1.6% · your price 1.85",
    proof: {
      kind: "priceOnly",
      quoteId:
        "c81f7a3e5d9b1c4f6a8e0d2b7f9a1c3e5d7b9f1a3c5e7d9b2f4a6c8e0d1f3a66d8e2",
      auditHref:
        "https://explorer.solana.com/tx/5KJp9qWvTn3RzYxM8cDbGh2LfAeUu7oSiN4kVrPmQw6EyXtZaB1gHdJcCsFvRkLmNoPq?cluster=devnet",
      note: "Settlement proof attaches after the match.",
    },
  },
  {
    ticketId: "ticket-homewin-won",
    marketName: "Home win",
    pickLabel: "France",
    fixtureLine: "France vs Argentina · FIFA World Cup final",
    status: "won",
    stakeLabel: "100.00",
    oddsLabel: "2.06",
    amountColumnTitle: "payout",
    amountLabel: "206.00",
    receiptTitle: "Proof receipt",
    outcomeLine: "France · won",
    receiptRows: [
      { label: "stake", value: "100.00 USDC" },
      { label: "odds", value: "2.06" },
      { label: "payout", value: "206.00 USDC" },
      { label: "settled", value: "Jul 5 · 21:47:19 UTC" },
    ],
    priceLine: "consensus 2.10 · margin 2.0% · your price 2.06",
    proof: {
      kind: "settled",
      dayRoot:
        "4d2c70b8f31a9e5d6c2b7a4f8e9d0c1b2a3f4e5d6c7b8a90e1d2c3b4a5f6e7d8101033",
      merklePath:
        "0669ea7c4d2b8f1a3e5c9d7b2f4a6e8c1d3b5f7a9e0c2d4b6f8a1e3c5d7e9b1ab9537d",
      verifyTx:
        "3NmXRo7d2VqkQfLpZjW8yTGaBcHsDe4MxUvKnPr6EJ9tYiA5wSg1hFb2mCzXkNeLiFh",
      stamp: "verified",
      receiptLink: "https://truebook.app/r/8kQ2vXw4",
      verifyPageHref: "/verify/18172400-1x2",
    },
  },
  {
    ticketId: "ticket-btts-lost",
    marketName: "Both teams to score",
    pickLabel: "Yes",
    fixtureLine: "Netherlands vs Japan · quarter-final",
    status: "lost",
    stakeLabel: "75.00",
    oddsLabel: "1.95",
    amountColumnTitle: "payout",
    amountLabel: "0.00",
    receiptTitle: "Proof receipt",
    outcomeLine: "No goal for Japan · lost",
    receiptRows: [
      { label: "stake", value: "75.00 USDC" },
      { label: "odds", value: "1.95" },
      { label: "payout", value: "0.00 USDC" },
      { label: "settled", value: "Jul 1 · 22:03:44 UTC" },
    ],
    priceLine: "consensus 1.99 · margin 1.8% · your price 1.95",
    proof: {
      kind: "settled",
      dayRoot:
        "9c4e2a6f8d1b3e5c7a9f2d4b6e8c0a1f3d5b7e9c2a4f6d8b0e1c3a5f7d9b25d1b77",
      verifyTx:
        "4Fg7wRpVq2ZkQmXj8yTnBcHsDe3MxUvKaPr5EJ9tYiA6wSg1hFb2mCzXkpQm2Ze",
      stamp: "verified",
      receiptLink: "https://truebook.app/r/3nT7bYc9",
    },
  },
  {
    ticketId: "ticket-totals-refunded",
    marketName: "Over 2.5 goals",
    pickLabel: "No",
    fixtureLine: "Morocco vs England · semi-final",
    status: "refunded",
    stakeLabel: "50.00",
    oddsLabel: "2.28",
    amountColumnTitle: "refunded",
    amountLabel: "50.00",
    receiptTitle: "Proof receipt",
    outcomeLine: "3 goals · lost",
    receiptRows: [
      { label: "stake", value: "50.00 USDC" },
      { label: "served odds", value: "2.28" },
      { label: "allowed floor", value: "2.37" },
      { label: "refunded", value: "50.00 USDC", tone: "danger" },
    ],
    priceLine: "consensus 2.41 · margin 1.8% · served 2.28, below the allowed floor",
    proof: {
      kind: "settled",
      dayRoot:
        "7be1f4a9c2d5e8b1f3a6c9d2e5b8f1a4c7d0e3b6f9a2c5d8e1b4f7a0c3d6e920ce88",
      verifyTx:
        "2ZqWk8RpVq3XkQmYj7yTnBcHsDe4MxUvKaPr6EJ8tYiA5wSg2hFb3mCzXtHn5Rd",
      stamp: "overcharge",
      receiptLink: "https://truebook.app/r/6mV4dZa2",
    },
  },
];

/** Filter chips include "refundable" per the design; it maps to refunded. */
export type TicketFilter = "all" | "live" | "won" | "lost" | "refundable";

export function filterTickets(
  tickets: ReadonlyArray<TicketView>,
  filter: TicketFilter,
): ReadonlyArray<TicketView> {
  if (filter === "all") {
    return tickets;
  }
  const statusForFilter: TicketStatus =
    filter === "refundable" ? "refunded" : filter;
  return tickets.filter((ticket) => ticket.status === statusForFilter);
}
