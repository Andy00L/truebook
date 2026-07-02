use anchor_lang::prelude::*;
use anchor_spl::token::{Mint, Token, TokenAccount};

use crate::constants::{BPS_DENOMINATOR, HOUSE_SEED, VAULT_SEED};
use crate::errors::TrueBookError;
use crate::events::HouseInitialized;
use crate::state::House;

#[derive(Accounts)]
pub struct InitializeHouse<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(
        init,
        payer = authority,
        space = 8 + House::INIT_SPACE,
        seeds = [HOUSE_SEED],
        bump
    )]
    pub house: Account<'info, House>,
    pub usdt_mint: Account<'info, Mint>,
    // The house vault is a PDA token account owned by the house PDA.
    #[account(
        init,
        payer = authority,
        seeds = [VAULT_SEED, house.key().as_ref()],
        bump,
        token::mint = usdt_mint,
        token::authority = house
    )]
    pub vault: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

pub fn handler(
    ctx: Context<InitializeHouse>,
    margin_bps: u16,
    max_exposure_per_market: u64,
    max_payout_per_ticket: u64,
) -> Result<()> {
    require!(
        margin_bps > 0 && (margin_bps as u64) < BPS_DENOMINATOR,
        TrueBookError::InvalidMargin
    );
    let house = &mut ctx.accounts.house;
    house.authority = ctx.accounts.authority.key();
    house.usdt_mint = ctx.accounts.usdt_mint.key();
    house.vault = ctx.accounts.vault.key();
    house.margin_bps = margin_bps;
    house.max_exposure_per_market = max_exposure_per_market;
    house.max_payout_per_ticket = max_payout_per_ticket;
    house.open_exposure = 0;
    house.total_volume = 0;
    house.market_count = 0;
    house.paused = false;
    house.bump = ctx.bumps.house;
    house.vault_bump = ctx.bumps.vault;

    emit!(HouseInitialized {
        authority: house.authority,
        usdt_mint: house.usdt_mint,
        margin_bps,
    });
    Ok(())
}
