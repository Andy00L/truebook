use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};

use crate::constants::{CASHOUT_SEED, HOUSE_SEED, QUOTE_VALIDITY_SECONDS};
use crate::errors::TrueBookError;
use crate::events::TicketCashedOut;
use crate::math::{cash_out_value, implied_prob_bps};
use crate::state::{
    AuditStatus, CashOutReceipt, House, Market, MarketState, Side, Ticket, TicketState,
};

// The bettor sells a live ticket back to the vault. The price is derived
// on-chain from the market's CURRENT posted quote: the payout weighted by the
// complement of the opposite side's implied probability (math.rs
// cash_out_value). No off-chain number is trusted; the receipt records the
// quote's provenance so audit_cash_out can prove the price against consensus.
#[derive(Accounts)]
pub struct CashOutTicket<'info> {
    #[account(mut, address = ticket.bettor @ TrueBookError::Unauthorized)]
    pub bettor: Signer<'info>,
    #[account(mut, seeds = [HOUSE_SEED], bump = house.bump)]
    pub house: Account<'info, House>,
    #[account(has_one = house)]
    pub market: Account<'info, Market>,
    #[account(
        mut,
        constraint = ticket.market == market.key() @ TrueBookError::TicketMarketMismatch
    )]
    pub ticket: Account<'info, Ticket>,
    #[account(
        init,
        payer = bettor,
        space = 8 + CashOutReceipt::INIT_SPACE,
        seeds = [CASHOUT_SEED, ticket.key().as_ref()],
        bump
    )]
    pub cash_out_receipt: Account<'info, CashOutReceipt>,
    #[account(mut, address = house.vault)]
    pub vault: Account<'info, TokenAccount>,
    #[account(
        mut,
        token::mint = house.usdt_mint,
        token::authority = bettor
    )]
    pub bettor_token_account: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<CashOutTicket>) -> Result<()> {
    require!(
        ctx.accounts.ticket.state == TicketState::Live,
        TrueBookError::TicketAlreadySettled
    );
    // Quotes only refresh while the market is open, so that is the cash-out
    // window; a locked market's ticket rides to settlement.
    require!(
        ctx.accounts.market.state == MarketState::Open,
        TrueBookError::MarketNotOpen
    );

    // Same freshness rule as place_bet: the priced quote must be current.
    let now = Clock::get()?.unix_timestamp;
    require!(
        now.checked_sub(ctx.accounts.market.quote_posted_ts).unwrap_or(i64::MAX)
            <= QUOTE_VALIDITY_SECONDS,
        TrueBookError::QuoteExpired
    );

    // The opposite side's served odds carry the house margin, so the value
    // they imply for this ticket sits below fair (see math.rs).
    let opposite_odds_bps = match ctx.accounts.ticket.side {
        Side::Yes => ctx.accounts.market.no_odds_bps,
        Side::No => ctx.accounts.market.yes_odds_bps,
    };
    let opposite_implied = implied_prob_bps(opposite_odds_bps)?;
    let paid_amount = cash_out_value(ctx.accounts.ticket.potential_payout, opposite_implied)?;
    require!(paid_amount > 0, TrueBookError::CashOutValueZero);
    require!(
        ctx.accounts.vault.amount >= paid_amount,
        TrueBookError::InsufficientLiquidity
    );

    // The ticket's liability is resolved: release its reserved payout.
    let potential_payout = ctx.accounts.ticket.potential_payout;
    let house = &mut ctx.accounts.house;
    house.open_exposure = house
        .open_exposure
        .checked_sub(potential_payout)
        .ok_or(TrueBookError::MathOverflow)?;

    let house_bump = house.bump;
    let signer_seeds: &[&[&[u8]]] = &[&[HOUSE_SEED, &[house_bump]]];
    let cpi_accounts = Transfer {
        from: ctx.accounts.vault.to_account_info(),
        to: ctx.accounts.bettor_token_account.to_account_info(),
        authority: ctx.accounts.house.to_account_info(),
    };
    token::transfer(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            cpi_accounts,
            signer_seeds,
        ),
        paid_amount,
    )?;

    let ticket = &mut ctx.accounts.ticket;
    ticket.state = TicketState::CashedOut;
    ticket.exposure_released = true;

    let odds_message_id = ctx.accounts.market.odds_message_id.clone();
    let odds_ts = ctx.accounts.market.odds_ts;

    let receipt = &mut ctx.accounts.cash_out_receipt;
    receipt.ticket = ctx.accounts.ticket.key();
    receipt.market = ctx.accounts.market.key();
    receipt.bettor = ctx.accounts.bettor.key();
    receipt.paid_amount = paid_amount;
    receipt.opposite_odds_bps = opposite_odds_bps;
    receipt.odds_message_id = odds_message_id.clone();
    receipt.odds_ts = odds_ts;
    receipt.cashed_ts = now;
    receipt.audit_status = AuditStatus::Unaudited;
    receipt.auditor = Pubkey::default();
    receipt.shortfall_owed = 0;
    receipt.made_whole = false;
    receipt.bump = ctx.bumps.cash_out_receipt;

    emit!(TicketCashedOut {
        market: receipt.market,
        ticket: receipt.ticket,
        bettor: receipt.bettor,
        paid_amount,
        opposite_odds_bps,
        odds_message_id,
        odds_ts,
    });
    Ok(())
}
