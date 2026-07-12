/**
 * Demo house figures for the honesty banner and judge panel, at the
 * realistic magnitudes validated in the design session. The chain provider
 * replaces them with live House account reads after the devnet deploy.
 */

export const DEMO_HOUSE_STATS = {
  vaultLabel: "104,882,451.20 USDC",
  openExposureLabel: "8,314,772.06 USDC",
  marginLabel: "2.0%",
  ticketsAuditedLabel: "1,284,003",
  violationsFoundLabel: "0",
} as const;

/** Demo delta line under the vault figure; chain omits it (no history yet). */
export const DEMO_HOUSE_DELTA = {
  text: "+412,038.55 (0.4%)",
  period: "past week",
  isUp: true,
} as const;

export const DEMO_WALLET_ADDRESS =
  "7xKpQm4Ns8vBtWzYcRj2LdGhE6fUiA9oXkP3mQw5v9fQe";

export const DEMO_FAUCET_USDC_TX = "8fKq3dVn5RwYtLpZjM2cXbGhEeUuSiN4kAmQrPw2Vt5c";

export const DEMO_FAUCET_SOL_TX = "9dRw5mTn8QzYxLpVjW2cFbGhAeUuSiN4kBmQrPk3Xp7b";
