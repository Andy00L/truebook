// TrueBook program constants. Values with an external source carry a sourceRef.

use anchor_lang::prelude::*;
use anchor_lang::solana_program::pubkey;

// The TxLINE oracle program on devnet. Score and odds proofs are validated by
// CPI into this program. sourceRef: packages/shared/src/config.ts TXLINE_PROGRAM_ID.
#[constant]
pub const TXLINE_PROGRAM_ID: Pubkey = pubkey!("6pW64gN1s2uqjHkn1unFeEjAwJkPGHoppGvS715wyP2J");

// TxLINE daily-root PDA seeds, used to derive the accounts a proof validates against.
#[constant]
pub const TXLINE_DAILY_SCORES_SEED: &[u8] = b"daily_scores_roots";
#[constant]
pub const TXLINE_DAILY_BATCH_SEED: &[u8] = b"daily_batch_roots";

// Milliseconds per day, for deriving the TxLINE epoch-day from a proof timestamp.
pub const MILLISECONDS_PER_DAY_I64: i64 = 24 * 60 * 60 * 1000;

// PDA seeds.
#[constant]
pub const HOUSE_SEED: &[u8] = b"house";
#[constant]
pub const MARKET_SEED: &[u8] = b"market";
#[constant]
pub const TICKET_SEED: &[u8] = b"ticket";
#[constant]
pub const OUTCOME_SEED: &[u8] = b"outcome";
#[constant]
pub const VAULT_SEED: &[u8] = b"vault";
#[constant]
pub const CASHOUT_SEED: &[u8] = b"cashout";

// Basis-points denominator. Odds and margins are expressed in basis points.
pub const BPS_DENOMINATOR: u64 = 10_000;

// Odds are stored as decimal odds scaled by this factor (2.06 decimal = 20_600).
// sourceRef: TxLINE StablePrice Prices are decimal odds * 1000; we keep a finer
// basis-point scale internally. See packages/shared/src/config.ts ODDS_DECIMAL_SCALE.
pub const ODDS_BPS_SCALE: u64 = 10_000;

// TxLINE StablePrice Prices are decimal odds * 1000. Multiply a raw price by
// (ODDS_BPS_SCALE / TXLINE_PRICE_DECIMAL_SCALE) to reach our internal odds bps.
pub const TXLINE_PRICE_DECIMAL_SCALE: u64 = 1_000;

// A served quote is only valid for this many seconds before a bet must refresh it.
pub const QUOTE_VALIDITY_SECONDS: i64 = 120;

// A market with no verifiable outcome this long after kickoff can be voided.
pub const VOID_GRACE_SECONDS: i64 = 48 * 60 * 60; // 48 hours

// Maximum stored length of a TxLINE odds MessageId (e.g. "1835117386:00003:000156-10021-stab").
pub const MAX_ODDS_MESSAGE_ID_LEN: usize = 64;

// Default house margin in basis points (2 percent), overridable at init.
pub const DEFAULT_MARGIN_BPS: u16 = 200;

// Audit tolerance in basis points: how far the served implied probability may sit
// above the proven consensus before the margin, before it counts as a violation.
pub const AUDIT_TOLERANCE_BPS: u16 = 25;

// Audit-to-earn: share of the ticket stake paid from the house vault to the
// first auditor who proves a price violation, in basis points (5 percent).
// Paid only out of free liquidity so open-ticket payouts stay fully covered.
pub const AUDIT_BOUNTY_BPS: u16 = 500;

// TxLINE StablePrice record shapes, keyed by SuperOddsType. An audit derives the
// record shape a market's quotes must come from directly from the committed
// predicate, so a keeper cannot price one question and audit against another.
// sourceRef: TxLINE devnet odds capture .scratch/odds-updates-18172379.json
// (also mirrored in packages/shared/src/marketCatalog.ts).
pub const SUPER_ODDS_1X2: &str = "1X2_PARTICIPANT_RESULT";
pub const SUPER_ODDS_OVER_UNDER: &str = "OVERUNDER_PARTICIPANT_GOALS";
pub const SUPER_ODDS_ASIAN_HANDICAP: &str = "ASIANHANDICAP_PARTICIPANT_GOALS";

// MarketPeriod strings as the feed emits them. Full time records carry None.
// sourceRef: .scratch/odds-updates-18172379.json.
pub const MARKET_PERIOD_FIRST_HALF: &str = "half=1";

// TxLINE score stat keys and periods used by the supported predicates.
// sourceRef: packages/shared/src/config.ts (STAT_KEY_PARTICIPANT1_GOALS,
// STAT_KEY_PARTICIPANT2_GOALS, STAT_PERIOD_TOTAL) and the scores snapshot
// capture .scratch/snapshot-18172379.json (period 1 = first half).
pub const STAT_KEY_P1_GOALS: u32 = 1;
pub const STAT_KEY_P2_GOALS: u32 = 2;
pub const STAT_PERIOD_TOTAL: i32 = 0;
pub const STAT_PERIOD_FIRST_HALF: i32 = 1;
