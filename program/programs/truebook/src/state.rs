// TrueBook on-chain state. All accounts derive InitSpace for exact rent sizing.

use anchor_lang::prelude::*;

use crate::constants::MAX_ODDS_MESSAGE_ID_LEN;

// Which side of a binary market a ticket backs. Yes = the predicate holds.
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace)]
pub enum Side {
    Yes,
    No,
}

// Lifecycle of a market.
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace)]
pub enum MarketState {
    Open,
    Locked,
    Verified,
    Settled,
    Voided,
}

// Lifecycle of a ticket.
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace)]
pub enum TicketState {
    Live,
    Won,
    Lost,
    Claimed,
    Refundable,
    Refunded,
}

// Result of a price audit against the TxLINE consensus.
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace)]
pub enum AuditStatus {
    Unaudited,
    Honest,
    Violation,
}

// Comparison operator, mirrors TxLINE TraderPredicate.Comparison.
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace)]
pub enum Comparison {
    GreaterThan,
    LessThan,
    EqualTo,
}

// Binary operator between two stats, mirrors TxLINE BinaryExpression. None = single stat.
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace)]
pub enum BinaryOp {
    None,
    Add,
    Subtract,
}

// The predicate that defines a market's YES outcome, in the native language of
// TxLINE validate_stat: (stat_a [op stat_b]) comparison threshold.
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, InitSpace)]
pub struct MarketParams {
    pub stat_a_key: u32,
    pub stat_a_period: i32,
    pub stat_b_key: u32,
    pub stat_b_period: i32,
    pub has_stat_b: bool,
    pub op: BinaryOp,
    pub comparison: Comparison,
    pub threshold: i32,
}

// The house: a single operator-funded book. Singleton PDA seed ["house"].
#[account]
#[derive(InitSpace)]
pub struct House {
    pub authority: Pubkey,
    pub usdt_mint: Pubkey,
    pub vault: Pubkey,
    pub margin_bps: u16,
    pub max_exposure_per_market: u64,
    pub max_payout_per_ticket: u64,
    // Net liability currently owed to bettors if every open market resolves worst-case.
    pub open_exposure: u64,
    pub total_volume: u64,
    pub market_count: u64,
    pub paused: bool,
    pub bump: u8,
    pub vault_bump: u8,
}

// A single binary market. PDA seed ["market", house, market_id LE].
#[account]
#[derive(InitSpace)]
pub struct Market {
    pub house: Pubkey,
    pub market_id: u64,
    pub fixture_id: i64,
    pub params: MarketParams,
    pub kickoff_ts: i64,
    pub state: MarketState,
    // Current served quote (basis points of decimal odds), with its provenance.
    pub yes_odds_bps: u32,
    pub no_odds_bps: u32,
    #[max_len(MAX_ODDS_MESSAGE_ID_LEN)]
    pub odds_message_id: String,
    pub odds_ts: i64,
    pub quote_posted_ts: i64,
    // Aggregate position per side.
    pub yes_stake: u64,
    pub no_stake: u64,
    pub yes_payout: u64,
    pub no_payout: u64,
    pub bump: u8,
}

// A single bettor position. PDA seed ["ticket", market, bettor, nonce LE].
#[account]
#[derive(InitSpace)]
pub struct Ticket {
    pub market: Pubkey,
    pub bettor: Pubkey,
    pub side: Side,
    pub stake: u64,
    pub quoted_odds_bps: u32,
    #[max_len(MAX_ODDS_MESSAGE_ID_LEN)]
    pub odds_message_id: String,
    pub odds_ts: i64,
    pub potential_payout: u64,
    pub state: TicketState,
    pub audit_status: AuditStatus,
    pub created_ts: i64,
    pub nonce: u64,
    pub bump: u8,
}

// The verified outcome of a market. PDA seed ["outcome", market]. Written once.
#[account]
#[derive(InitSpace)]
pub struct VerifiedOutcome {
    pub market: Pubkey,
    // true = the market's YES predicate holds.
    pub outcome: bool,
    pub seq: u32,
    pub verified_ts: i64,
    pub bump: u8,
}
