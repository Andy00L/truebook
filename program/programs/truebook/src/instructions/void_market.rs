use anchor_lang::prelude::*;

use crate::constants::{HOUSE_SEED, VOID_GRACE_SECONDS};
use crate::errors::TrueBookError;
use crate::events::MarketVoided;
use crate::state::{House, Market, MarketState};

// Void a market whose outcome cannot be proven. Permissionless once the grace
// window after kickoff has elapsed; the house authority may void earlier.
#[derive(Accounts)]
pub struct VoidMarket<'info> {
    pub caller: Signer<'info>,
    #[account(seeds = [HOUSE_SEED], bump = house.bump)]
    pub house: Account<'info, House>,
    #[account(mut, has_one = house)]
    pub market: Account<'info, Market>,
}

pub fn handler(ctx: Context<VoidMarket>) -> Result<()> {
    let state = ctx.accounts.market.state;
    require!(
        state == MarketState::Open || state == MarketState::Locked,
        TrueBookError::MarketNotOpen
    );

    let now = Clock::get()?.unix_timestamp;
    let is_authority = ctx.accounts.caller.key() == ctx.accounts.house.authority;
    let grace_elapsed = now
        >= ctx
            .accounts
            .market
            .kickoff_ts
            .checked_add(VOID_GRACE_SECONDS)
            .ok_or(TrueBookError::MathOverflow)?;
    require!(is_authority || grace_elapsed, TrueBookError::VoidGraceNotElapsed);

    let market = &mut ctx.accounts.market;
    market.state = MarketState::Voided;

    emit!(MarketVoided {
        market: market.key(),
        voided_ts: now,
    });
    Ok(())
}
