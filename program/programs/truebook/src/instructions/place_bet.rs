use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};

use crate::constants::{HOUSE_SEED, QUOTE_VALIDITY_SECONDS};
use crate::errors::TrueBookError;
use crate::events::BetPlaced;
use crate::math::potential_payout;
use crate::state::{AuditStatus, House, Market, MarketState, Side, Ticket, TicketState};

#[derive(Accounts)]
#[instruction(nonce: u64)]
pub struct PlaceBet<'info> {
    #[account(mut)]
    pub bettor: Signer<'info>,
    #[account(mut, seeds = [HOUSE_SEED], bump = house.bump)]
    pub house: Account<'info, House>,
    #[account(mut, has_one = house)]
    pub market: Account<'info, Market>,
    #[account(
        init,
        payer = bettor,
        space = 8 + Ticket::INIT_SPACE,
        seeds = [b"ticket", market.key().as_ref(), bettor.key().as_ref(), &nonce.to_le_bytes()],
        bump
    )]
    pub ticket: Account<'info, Ticket>,
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

pub fn handler(ctx: Context<PlaceBet>, nonce: u64, side: Side, stake: u64) -> Result<()> {
    require!(!ctx.accounts.house.paused, TrueBookError::HousePaused);
    require!(
        ctx.accounts.market.state == MarketState::Open,
        TrueBookError::MarketNotOpen
    );
    require!(stake > 0, TrueBookError::ZeroStake);

    let now = Clock::get()?.unix_timestamp;
    require!(now < ctx.accounts.market.kickoff_ts, TrueBookError::KickoffPassed);
    // The served quote must be fresh.
    require!(
        now.checked_sub(ctx.accounts.market.quote_posted_ts).unwrap_or(i64::MAX) <= QUOTE_VALIDITY_SECONDS,
        TrueBookError::QuoteExpired
    );

    let odds_bps = match side {
        Side::Yes => ctx.accounts.market.yes_odds_bps,
        Side::No => ctx.accounts.market.no_odds_bps,
    };
    let payout = potential_payout(stake, odds_bps)?;
    require!(
        payout <= ctx.accounts.house.max_payout_per_ticket,
        TrueBookError::PayoutCapExceeded
    );

    // Conservative solvency model: the vault must always cover the full potential
    // payout of every live ticket. Adding this ticket raises open exposure by its
    // payout; the incoming stake also lands in the vault.
    let new_open_exposure = ctx
        .accounts
        .house
        .open_exposure
        .checked_add(payout)
        .ok_or(TrueBookError::MathOverflow)?;
    let vault_after_stake = ctx
        .accounts
        .vault
        .amount
        .checked_add(stake)
        .ok_or(TrueBookError::MathOverflow)?;
    require!(
        vault_after_stake >= new_open_exposure,
        TrueBookError::InsufficientLiquidity
    );

    // Per-market exposure cap on the side's gross potential payout.
    let side_payout_after = match side {
        Side::Yes => ctx.accounts.market.yes_payout.checked_add(payout),
        Side::No => ctx.accounts.market.no_payout.checked_add(payout),
    }
    .ok_or(TrueBookError::MathOverflow)?;
    require!(
        side_payout_after <= ctx.accounts.house.max_exposure_per_market,
        TrueBookError::ExposureCapExceeded
    );

    // Move the stake into the vault.
    let cpi_accounts = Transfer {
        from: ctx.accounts.bettor_token_account.to_account_info(),
        to: ctx.accounts.vault.to_account_info(),
        authority: ctx.accounts.bettor.to_account_info(),
    };
    token::transfer(
        CpiContext::new(ctx.accounts.token_program.to_account_info(), cpi_accounts),
        stake,
    )?;

    // Update market aggregates.
    let market = &mut ctx.accounts.market;
    match side {
        Side::Yes => {
            market.yes_stake = market.yes_stake.checked_add(stake).ok_or(TrueBookError::MathOverflow)?;
            market.yes_payout = side_payout_after;
        }
        Side::No => {
            market.no_stake = market.no_stake.checked_add(stake).ok_or(TrueBookError::MathOverflow)?;
            market.no_payout = side_payout_after;
        }
    }
    let market_odds_message_id = market.odds_message_id.clone();
    let market_odds_ts = market.odds_ts;

    // Update house counters.
    let house = &mut ctx.accounts.house;
    house.open_exposure = new_open_exposure;
    house.total_volume = house.total_volume.checked_add(stake).ok_or(TrueBookError::MathOverflow)?;

    // Snapshot the served quote into the ticket. The message id and ts are the
    // provenance an audit later checks against the on-chain consensus record.
    let ticket = &mut ctx.accounts.ticket;
    ticket.market = market.key();
    ticket.bettor = ctx.accounts.bettor.key();
    ticket.side = side;
    ticket.stake = stake;
    ticket.quoted_odds_bps = odds_bps;
    ticket.odds_message_id = market_odds_message_id;
    ticket.odds_ts = market_odds_ts;
    ticket.potential_payout = payout;
    ticket.state = TicketState::Live;
    ticket.audit_status = AuditStatus::Unaudited;
    ticket.created_ts = now;
    ticket.nonce = nonce;
    ticket.bump = ctx.bumps.ticket;

    emit!(BetPlaced {
        market: ticket.market,
        ticket: ticket.key(),
        bettor: ticket.bettor,
        side_is_yes: side == Side::Yes,
        stake,
        quoted_odds_bps: odds_bps,
        potential_payout: payout,
    });
    Ok(())
}
