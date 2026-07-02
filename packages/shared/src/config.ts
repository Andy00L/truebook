// Single source of truth for TxLINE devnet integration constants.
// Every value here was verified end-to-end against devnet on 2026-07-02.
// sourceRef: docs/research/2026-07-02-spike-findings.md and
// https://txline.txodds.com/documentation/programs/addresses (devnet column).

import { PublicKey } from "@solana/web3.js";

// Network. This project targets devnet only.
export const DEVNET_RPC_URL = "https://api.devnet.solana.com" as const;
export const TXLINE_API_ORIGIN = "https://txline-dev.txodds.com" as const;

// TxLINE oracle program and mints (devnet).
export const TXLINE_PROGRAM_ID = new PublicKey("6pW64gN1s2uqjHkn1unFeEjAwJkPGHoppGvS715wyP2J");
export const TXL_TOKEN_MINT = new PublicKey("4Zao8ocPhmMgq7PdsYWyxvqySMGx7xb9cMftPMkEokRG");
export const USDT_MINT_DEVNET = new PublicKey("ELWTKspHKCnCfCiCiqYw1EDH77k8VCP74dK9qytG2Ujh");

// TxLINE PDA seeds. epochDay = floor(minTimestamp / MILLISECONDS_PER_DAY), encoded u16 LE.
export const SEED_DAILY_SCORES_ROOTS = "daily_scores_roots" as const;
export const SEED_DAILY_BATCH_ROOTS = "daily_batch_roots" as const;
export const SEED_PRICING_MATRIX = "pricing_matrix" as const;
export const SEED_TOKEN_TREASURY_V2 = "token_treasury_v2" as const;

// Free World Cup + International Friendlies tier on devnet (60-second delay).
// sourceRef: documentation/subscription-tiers (devnet single tier).
export const SERVICE_LEVEL_ID_WORLD_CUP_FREE = 1 as const;
export const SUBSCRIPTION_WEEKS_DEFAULT = 4 as const;

// Time. epoch day math and quote freshness.
export const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000; // 86_400_000 ms

// Odds encoding. StablePrice Prices are decimal odds scaled by 1000 (1613 = 1.613).
// sourceRef: verified against TXLineStablePriceDemargined records on devnet.
export const ODDS_DECIMAL_SCALE = 1000 as const;

// The consensus bookmaker to price from (already de-margined to a fair probability).
export const STABLEPRICE_BOOKMAKER = "TXLineStablePriceDemargined" as const;
export const STABLEPRICE_BOOKMAKER_ID = 10021 as const;

// Activation token prefix. /api/token/activate returns the token as plain text.
export const API_TOKEN_PREFIX = "txoracle_api_" as const;

// TxLINE serves zstd, which some fetch clients fail to decode. Force identity.
export const ACCEPT_ENCODING_IDENTITY = "identity" as const;

// Score stat keys (base key, period-agnostic). Period-scoped keys are period-specific
// in the API's ScoreStat.period field. key 1 = Participant1 goals, key 2 = Participant2 goals.
// period 0 = Total. sourceRef: verified via stat-validation on devnet + docs.yaml.
export const STAT_KEY_PARTICIPANT1_GOALS = 1 as const;
export const STAT_KEY_PARTICIPANT2_GOALS = 2 as const;
export const STAT_PERIOD_TOTAL = 0 as const;
