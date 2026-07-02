// TrueBook events. Emitted on every state transition for off-chain indexing.

use anchor_lang::prelude::*;

#[event]
pub struct HouseInitialized {
    pub authority: Pubkey,
    pub usdt_mint: Pubkey,
    pub margin_bps: u16,
}

#[event]
pub struct MarketCreated {
    pub market: Pubkey,
    pub market_id: u64,
    pub fixture_id: i64,
    pub kickoff_ts: i64,
}

#[event]
pub struct QuotePosted {
    pub market: Pubkey,
    pub yes_odds_bps: u32,
    pub no_odds_bps: u32,
    pub odds_message_id: String,
    pub odds_ts: i64,
}

#[event]
pub struct BetPlaced {
    pub market: Pubkey,
    pub ticket: Pubkey,
    pub bettor: Pubkey,
    pub side_is_yes: bool,
    pub stake: u64,
    pub quoted_odds_bps: u32,
    pub potential_payout: u64,
}

#[event]
pub struct MarketLocked {
    pub market: Pubkey,
    pub locked_ts: i64,
}

#[event]
pub struct MarketVerified {
    pub market: Pubkey,
    pub outcome: bool,
    pub seq: u32,
    pub verified_ts: i64,
}

#[event]
pub struct TicketSettled {
    pub market: Pubkey,
    pub ticket: Pubkey,
    pub bettor: Pubkey,
    pub won: bool,
    pub payout: u64,
}

#[event]
pub struct TicketAudited {
    pub market: Pubkey,
    pub ticket: Pubkey,
    pub authentic: bool,
    pub violation: bool,
    pub served_implied_bps: u32,
    pub consensus_implied_bps: u32,
}

#[event]
pub struct MarketVoided {
    pub market: Pubkey,
    pub voided_ts: i64,
}

#[event]
pub struct LiquidityChanged {
    pub house: Pubkey,
    pub deposit: bool,
    pub amount: u64,
    pub new_vault_balance: u64,
}
