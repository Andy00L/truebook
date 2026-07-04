use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};

use crate::constants::{HOUSE_SEED, OUTCOME_SEED};
use crate::errors::TrueBookError;
use crate::events::TicketSettled;
use crate::state::{House, Market, MarketState, Side, Ticket, TicketState, VerifiedOutcome};

// Permissionless crank: pay a winning ticket or close a losing one against the
// market's verified outcome. Idempotent per ticket via the Live-state guard.
#[derive(Accounts)]
pub struct SettleTicket<'info> {
    pub cranker: Signer<'info>,
    #[account(mut, seeds = [HOUSE_SEED], bump = house.bump)]
    pub house: Account<'info, House>,
    #[account(has_one = house)]
    pub market: Account<'info, Market>,
    #[account(
        seeds = [OUTCOME_SEED, market.key().as_ref()],
        bump = verified_outcome.bump,
        constraint = verified_outcome.market == market.key() @ TrueBookError::TicketMarketMismatch
    )]
    pub verified_outcome: Account<'info, VerifiedOutcome>,
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

pub fn handler(ctx: Context<SettleTicket>) -> Result<()> {
    require!(
        ctx.accounts.market.state == MarketState::Verified,
        TrueBookError::OutcomeNotVerified
    );
    require!(
        ctx.accounts.ticket.state == TicketState::Live,
        TrueBookError::TicketAlreadySettled
    );

    let outcome_is_yes = ctx.accounts.verified_outcome.outcome;
    let ticket_backs_yes = ctx.accounts.ticket.side == Side::Yes;
    let won = ticket_backs_yes == outcome_is_yes;
    let payout = ctx.accounts.ticket.potential_payout;

    // The ticket's liability is now resolved either way; free it from exposure.
    let house = &mut ctx.accounts.house;
    house.open_exposure = house
        .open_exposure
        .checked_sub(payout)
        .ok_or(TrueBookError::MathOverflow)?;

    if won {
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
            payout,
        )?;
        ctx.accounts.ticket.state = TicketState::Won;
    } else {
        // Losing stake stays in the vault as house revenue.
        ctx.accounts.ticket.state = TicketState::Lost;
    }
    // Liability resolved for this ticket; a later audit-driven refund must not
    // release it from open_exposure a second time.
    ctx.accounts.ticket.exposure_released = true;

    emit!(TicketSettled {
        market: ctx.accounts.market.key(),
        ticket: ctx.accounts.ticket.key(),
        bettor: ctx.accounts.ticket.bettor,
        won,
        payout: if won { payout } else { 0 },
    });
    Ok(())
}
