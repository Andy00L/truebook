// TrueBook program constants. Values with an external source carry a sourceRef.

use anchor_lang::prelude::*;

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

// Basis-points denominator. Odds and margins are expressed in basis points.
pub const BPS_DENOMINATOR: u64 = 10_000;

// Odds are stored as decimal odds scaled by this factor (2.06 decimal = 20_600).
// sourceRef: TxLINE StablePrice Prices are decimal odds * 1000; we keep a finer
// basis-point scale internally. See packages/shared/src/config.ts ODDS_DECIMAL_SCALE.
pub const ODDS_BPS_SCALE: u64 = 10_000;

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
