/**
 * Demo verification index for the public /verify/[market] page. Each entry
 * is one market's resolution proof; the chain provider will read the
 * VerifiedOutcome PDA and the stored proof args instead.
 */

export type VerifyMarketView = {
  slug: string;
  fixtureName: string;
  marketName: string;
  competitionLine: string;
  status: "verified" | "awaiting";
  /** Verified fields. */
  settledLine?: string;
  outcomeLabel?: "YES" | "NO";
  outcomeStatement?: string;
  dayRoot?: string;
  merkleNodes?: ReadonlyArray<{ label: string; hash: string }>;
  verifyTx?: string;
  pageLink: string;
  /** Awaiting fields. */
  kickoffLine?: string;
};

const VERIFY_INDEX: ReadonlyArray<VerifyMarketView> = [
  {
    slug: "18172400-1x2",
    fixtureName: "France vs Argentina",
    marketName: "Home win",
    competitionLine: "FIFA World Cup final",
    status: "verified",
    settledLine: "settled Jul 5 · 21:47:19 UTC",
    outcomeLabel: "YES",
    outcomeStatement: "France 2, Argentina 1 · home win holds: true",
    dayRoot:
      "4d2c70b8f31a9e5d6c2b7a4f8e9d0c1b2a3f4e5d6c7b8a90e1d2c3b4a5f6e7d8101033",
    merkleNodes: [
      {
        label: "Node 0 · leaf",
        hash: "0669ea7c4d2b8f1a3e5c9d7b2f4a6e8c1d3b5f7a9e0c2d4b6f8a1e3c5d7e9b1ab9537d",
      },
      {
        label: "Node 1",
        hash: "f14c9b2e7d5a8c1f4b6e9d2a5c8f1b4e7d0a3c6f9b2e5d8a1c4f7b0e3d6a9ca2d6e0",
      },
      {
        label: "Node 2",
        hash: "83d5f7a1c4e6b9d2f5a8c1e4b7d0f3a6c9e2b5d8f1a4c7e0b3d6f9a2c5e8bc1b4a9",
      },
      {
        label: "Node 3",
        hash: "5e2a8c4f7b1d3e6a9c2f5b8d1e4a7c0f3b6d9e2a5c8f1b4d7e0a3c6f9b2d5ed97f31",
      },
    ],
    verifyTx:
      "3NmXRo7d2VqkQfLpZjW8yTGaBcHsDe4MxUvKnPr6EJ9tYiA5wSg1hFb2mCzXkNeLiFh",
    pageLink: "https://truebook.app/verify/18172400-1x2",
  },
  {
    slug: "18172403-1x2",
    fixtureName: "Brazil vs Norway",
    marketName: "Home win",
    competitionLine: "FIFA World Cup final",
    status: "awaiting",
    kickoffLine: "Jul 19 · 20:00 UTC",
    pageLink: "https://truebook.app/verify/18172403-1x2",
  },
  {
    slug: "18172390-1x2",
    fixtureName: "Netherlands vs Japan",
    marketName: "Home win",
    competitionLine: "FIFA World Cup quarter-final",
    status: "verified",
    settledLine: "settled Jul 1 · 22:03:44 UTC",
    outcomeLabel: "YES",
    outcomeStatement: "Netherlands 2, Japan 0 · home win holds: true",
    dayRoot:
      "9c4e2a6f8d1b3e5c7a9f2d4b6e8c0a1f3d5b7e9c2a4f6d8b0e1c3a5f7d9b25d1b77",
    verifyTx: "4Fg7wRpVq2ZkQmXj8yTnBcHsDe3MxUvKaPr5EJ9tYiA6wSg1hFb2mCzXkpQm2Ze",
    pageLink: "https://truebook.app/verify/18172390-1x2",
  },
  {
    slug: "18172391-1x2",
    fixtureName: "Morocco vs England",
    marketName: "Home win",
    competitionLine: "FIFA World Cup semi-final",
    status: "verified",
    settledLine: "settled Jul 2 · 22:12:08 UTC",
    outcomeLabel: "NO",
    outcomeStatement: "Morocco 1, England 2 · home win holds: false",
    dayRoot:
      "7be1f4a9c2d5e8b1f3a6c9d2e5b8f1a4c7d0e3b6f9a2c5d8e1b4f7a0c3d6e920ce88",
    verifyTx: "2ZqWk8RpVq3XkQmYj7yTnBcHsDe4MxUvKaPr6EJ8tYiA5wSg2hFb3mCzXtHn5Rd",
    pageLink: "https://truebook.app/verify/18172391-1x2",
  },
  {
    slug: "18172392-1x2",
    fixtureName: "Croatia vs Denmark",
    marketName: "Home win",
    competitionLine: "FIFA World Cup quarter-final",
    status: "verified",
    settledLine: "settled Jul 3 · 21:58:31 UTC",
    outcomeLabel: "NO",
    outcomeStatement: "Croatia 0, Denmark 0 · home win holds: false",
    dayRoot:
      "3af8c2d6e9b1f4a7c0d3e6b9f2a5c8d1e4b7f0a3c6d9e2b5f8a1c4d7e0b391d4e7",
    verifyTx: "6Hj3kTpVq5XkQmZj9yTnBcHsDe2MxUvKaPr4EJ7tYiA8wSg3hFb1mCzXmWq8Xc",
    pageLink: "https://truebook.app/verify/18172392-1x2",
  },
];

export function getVerifyMarket(slug: string): VerifyMarketView | null {
  return VERIFY_INDEX.find((entry) => entry.slug === slug) ?? null;
}
