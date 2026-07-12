use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};

use crate::constants::{AUDIT_BOUNTY_BPS, CASHOUT_SEED, HOUSE_SEED};
use crate::errors::TrueBookError;
use crate::events::CashOutRepaid;
use crate::math::bounty_amount;
use crate::state::{AuditStatus, CashOutReceipt, House, Ticket};

// Permissionless crank: pay out what a proven cash-out violation owes. The
// bettor receives the recorded shortfall against the honest floor; the
// auditor who proved the violation receives the audit-to-earn bounty (5
// percent of the stake) out of the vault's free liquidity.
#[derive(Accounts)]
pub struct ClaimCashOutRepair<'info> {
    pub cranker: Signer<'info>,
    #[account(seeds = [HOUSE_SEED], bump = house.bump)]
    pub house: Account<'info, House>,
    #[account(
        constraint = ticket.key() == cash_out_receipt.ticket @ TrueBookError::TicketMarketMismatch
    )]
    pub ticket: Account<'info, Ticket>,
    #[account(
        mut,
        seeds = [CASHOUT_SEED, ticket.key().as_ref()],
        bump = cash_out_receipt.bump
    )]
    pub cash_out_receipt: Account<'info, CashOutReceipt>,
    #[account(mut, address = house.vault)]
    pub vault: Account<'info, TokenAccount>,
    #[account(
        mut,
        token::mint = house.usdt_mint,
        constraint = bettor_token_account.owner == cash_out_receipt.bettor @ TrueBookError::TicketMarketMismatch
    )]
    pub bettor_token_account: Account<'info, TokenAccount>,
    #[account(mut, token::mint = house.usdt_mint)]
    pub auditor_token_account: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
}

pub fn handler(ctx: Context<ClaimCashOutRepair>) -> Result<()> {
    require!(
        ctx.accounts.cash_out_receipt.audit_status == AuditStatus::Violation,
        TrueBookError::NoPriceViolation
    );
    require!(
        !ctx.accounts.cash_out_receipt.made_whole,
        TrueBookError::ShortfallAlreadyPaid
    );
    // Checked here, after the verdict gates, so an honest receipt answers
    // "no violation" instead of a confusing account-mismatch error.
    require!(
        ctx.accounts.auditor_token_account.owner == ctx.accounts.cash_out_receipt.auditor,
        TrueBookError::Unauthorized
    );

    let shortfall_paid = ctx.accounts.cash_out_receipt.shortfall_owed;
    require!(
        ctx.accounts.vault.amount >= shortfall_paid,
        TrueBookError::InsufficientLiquidity
    );
    // The bounty comes out of free liquidity only, after the shortfall.
    let free_liquidity = ctx
        .accounts
        .vault
        .amount
        .saturating_sub(shortfall_paid)
        .saturating_sub(ctx.accounts.house.open_exposure);
    let bounty_paid = bounty_amount(ctx.accounts.ticket.stake, AUDIT_BOUNTY_BPS, free_liquidity)?;

    let house_bump = ctx.accounts.house.bump;
    let signer_seeds: &[&[&[u8]]] = &[&[HOUSE_SEED, &[house_bump]]];
    if shortfall_paid > 0 {
        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.vault.to_account_info(),
                    to: ctx.accounts.bettor_token_account.to_account_info(),
                    authority: ctx.accounts.house.to_account_info(),
                },
                signer_seeds,
            ),
            shortfall_paid,
        )?;
    }
    if bounty_paid > 0 {
        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.vault.to_account_info(),
                    to: ctx.accounts.auditor_token_account.to_account_info(),
                    authority: ctx.accounts.house.to_account_info(),
                },
                signer_seeds,
            ),
            bounty_paid,
        )?;
    }
    ctx.accounts.cash_out_receipt.made_whole = true;

    emit!(CashOutRepaid {
        receipt: ctx.accounts.cash_out_receipt.key(),
        ticket: ctx.accounts.cash_out_receipt.ticket,
        bettor: ctx.accounts.cash_out_receipt.bettor,
        auditor: ctx.accounts.cash_out_receipt.auditor,
        shortfall_paid,
        bounty_paid,
    });
    Ok(())
}
