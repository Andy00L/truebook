use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};

use crate::constants::HOUSE_SEED;
use crate::errors::TrueBookError;
use crate::events::TicketSettled;
use crate::state::{House, Market, MarketState, Ticket, TicketState};

// Refund a ticket's full stake. Allowed when the market was voided, or when a
// price audit flagged the ticket refundable. Permissionless crank.
#[derive(Accounts)]
pub struct RefundTicket<'info> {
    pub cranker: Signer<'info>,
    #[account(mut, seeds = [HOUSE_SEED], bump = house.bump)]
    pub house: Account<'info, House>,
    #[account(has_one = house)]
    pub market: Account<'info, Market>,
    #[account(
        mut,
        constraint = ticket.market == market.key() @ TrueBookError::TicketMarketMismatch
    )]
    pub ticket: Account<'info, Ticket>,
    #[account(mut, address = house.vault)]
    pub vault: Account<'info, TokenAccount>,
    #[account(
        mut,
        token::mint = house.usdt_mint,
        constraint = bettor_token_account.owner == ticket.bettor @ TrueBookError::TicketMarketMismatch
    )]
    pub bettor_token_account: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
}

pub fn handler(ctx: Context<RefundTicket>) -> Result<()> {
    let market_voided = ctx.accounts.market.state == MarketState::Voided;
    let flagged_refundable = ctx.accounts.ticket.state == TicketState::Refundable;
    require!(
        (market_voided && ctx.accounts.ticket.state == TicketState::Live) || flagged_refundable,
        TrueBookError::TicketNotRefundable
    );

    let refund_amount = ctx.accounts.ticket.stake;
    let ticket_payout = ctx.accounts.ticket.potential_payout;

    // Release the reserved liability only if settle has not already released it,
    // then return the stake.
    if !ctx.accounts.ticket.exposure_released {
        ctx.accounts.house.open_exposure =
            ctx.accounts.house.open_exposure.saturating_sub(ticket_payout);
    }
    ctx.accounts.ticket.exposure_released = true;

    let house_bump = ctx.accounts.house.bump;
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
        refund_amount,
    )?;
    ctx.accounts.ticket.state = TicketState::Refunded;

    emit!(TicketSettled {
        market: ctx.accounts.market.key(),
        ticket: ctx.accounts.ticket.key(),
        bettor: ctx.accounts.ticket.bettor,
        won: false,
        payout: refund_amount,
    });
    Ok(())
}
