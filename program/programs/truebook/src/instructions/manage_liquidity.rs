use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};

use crate::constants::HOUSE_SEED;
use crate::errors::TrueBookError;
use crate::events::LiquidityChanged;
use crate::state::House;

#[derive(Accounts)]
pub struct ManageLiquidity<'info> {
    #[account(mut, address = house.authority @ TrueBookError::Unauthorized)]
    pub authority: Signer<'info>,
    #[account(mut, seeds = [HOUSE_SEED], bump = house.bump)]
    pub house: Account<'info, House>,
    #[account(mut, address = house.vault)]
    pub vault: Account<'info, TokenAccount>,
    #[account(
        mut,
        token::mint = house.usdt_mint,
        token::authority = authority
    )]
    pub authority_token_account: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
}

pub fn deposit(ctx: Context<ManageLiquidity>, amount: u64) -> Result<()> {
    require!(amount > 0, TrueBookError::ZeroStake);
    let cpi_accounts = Transfer {
        from: ctx.accounts.authority_token_account.to_account_info(),
        to: ctx.accounts.vault.to_account_info(),
        authority: ctx.accounts.authority.to_account_info(),
    };
    let cpi_context = CpiContext::new(ctx.accounts.token_program.to_account_info(), cpi_accounts);
    token::transfer(cpi_context, amount)?;

    ctx.accounts.vault.reload()?;
    emit!(LiquidityChanged {
        house: ctx.accounts.house.key(),
        deposit: true,
        amount,
        new_vault_balance: ctx.accounts.vault.amount,
    });
    Ok(())
}

pub fn withdraw(ctx: Context<ManageLiquidity>, amount: u64) -> Result<()> {
    require!(amount > 0, TrueBookError::ZeroStake);
    // Never withdraw below the liability owed to open tickets.
    let free_liquidity = ctx
        .accounts
        .vault
        .amount
        .checked_sub(ctx.accounts.house.open_exposure)
        .ok_or(TrueBookError::WithdrawalBelowExposure)?;
    require!(amount <= free_liquidity, TrueBookError::WithdrawalBelowExposure);

    let house_bump = ctx.accounts.house.bump;
    let signer_seeds: &[&[&[u8]]] = &[&[HOUSE_SEED, &[house_bump]]];
    let cpi_accounts = Transfer {
        from: ctx.accounts.vault.to_account_info(),
        to: ctx.accounts.authority_token_account.to_account_info(),
        authority: ctx.accounts.house.to_account_info(),
    };
    let cpi_context = CpiContext::new_with_signer(
        ctx.accounts.token_program.to_account_info(),
        cpi_accounts,
        signer_seeds,
    );
    token::transfer(cpi_context, amount)?;

    ctx.accounts.vault.reload()?;
    emit!(LiquidityChanged {
        house: ctx.accounts.house.key(),
        deposit: false,
        amount,
        new_vault_balance: ctx.accounts.vault.amount,
    });
    Ok(())
}
