// TrueBook: a provably-fair sports book on Solana. The house quotes every market
// at the TxLINE StablePrice consensus plus a displayed margin; outcomes settle from
// TxLINE score merkle proofs and every served price is auditable against consensus.

use anchor_lang::prelude::*;

pub mod constants;
pub mod errors;
pub mod events;
pub mod math;
pub mod state;
pub mod txline_cpi;
pub mod instructions;

use instructions::*;
use state::{MarketParams, Side};
use txline_cpi::{ValidateOddsArgs, ValidateStatArgs};

declare_id!("59txn6d3rHFtvhocB5ZvhhJsTurGNq1d1gcbDy7o43fh");

#[program]
pub mod truebook {
    use super::*;

    // Create the singleton house and its USDT vault.
    pub fn initialize_house(
        ctx: Context<InitializeHouse>,
        margin_bps: u16,
        max_exposure_per_market: u64,
        max_payout_per_ticket: u64,
    ) -> Result<()> {
        instructions::initialize_house::handler(ctx, margin_bps, max_exposure_per_market, max_payout_per_ticket)
    }

    // Operator adds USDT liquidity to the house vault.
    pub fn deposit_liquidity(ctx: Context<ManageLiquidity>, amount: u64) -> Result<()> {
        instructions::manage_liquidity::deposit(ctx, amount)
    }

    // Operator withdraws free liquidity (never below open exposure).
    pub fn withdraw_liquidity(ctx: Context<ManageLiquidity>, amount: u64) -> Result<()> {
        instructions::manage_liquidity::withdraw(ctx, amount)
    }

    // Create a binary market for a fixture with a resolution predicate.
    pub fn create_market(
        ctx: Context<CreateMarket>,
        fixture_id: i64,
        params: MarketParams,
        outcome_price_index: u8,
        kickoff_ts: i64,
    ) -> Result<()> {
        instructions::create_market::handler(ctx, fixture_id, params, outcome_price_index, kickoff_ts)
    }

    // Keeper posts a fresh quote sourced from a specific StablePrice record.
    pub fn post_quote(
        ctx: Context<PostQuote>,
        yes_odds_bps: u32,
        no_odds_bps: u32,
        odds_message_id: String,
        odds_ts: i64,
    ) -> Result<()> {
        instructions::post_quote::handler(ctx, yes_odds_bps, no_odds_bps, odds_message_id, odds_ts)
    }

    // Place a bet on one side, snapshotting the served quote into the ticket.
    pub fn place_bet(ctx: Context<PlaceBet>, nonce: u64, side: Side, stake: u64) -> Result<()> {
        instructions::place_bet::handler(ctx, nonce, side, stake)
    }

    // Lock a market once kickoff has passed; permissionless.
    pub fn lock_market(ctx: Context<LockMarket>) -> Result<()> {
        instructions::lock_market::handler(ctx)
    }

    // Prove a market's outcome by CPI into TxLINE validate_stat; permissionless.
    pub fn verify_market(ctx: Context<VerifyMarket>, args: ValidateStatArgs, seq: u32) -> Result<()> {
        instructions::verify_market::handler(ctx, args, seq)
    }

    // Audit a ticket's served price against the TxLINE consensus by CPI into
    // validate_odds; a proven overcharge makes the ticket refundable.
    pub fn audit_ticket(ctx: Context<AuditTicket>, args: ValidateOddsArgs) -> Result<()> {
        instructions::audit_ticket::handler(ctx, args)
    }

    // Pay out or close a ticket against a verified outcome; permissionless crank.
    pub fn settle_ticket(ctx: Context<SettleTicket>) -> Result<()> {
        instructions::settle_ticket::handler(ctx)
    }

    // Void a market whose outcome cannot be proven within the grace window.
    pub fn void_market(ctx: Context<VoidMarket>) -> Result<()> {
        instructions::void_market::handler(ctx)
    }

    // Refund a ticket on a voided market, or one flagged refundable by an audit.
    pub fn refund_ticket(ctx: Context<RefundTicket>) -> Result<()> {
        instructions::refund_ticket::handler(ctx)
    }
}
