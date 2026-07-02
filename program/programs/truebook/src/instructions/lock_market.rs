use anchor_lang::prelude::*;

use crate::errors::TrueBookError;
use crate::events::MarketLocked;
use crate::state::{Market, MarketState};

// Permissionless: anyone can lock a market once its kickoff has passed.
#[derive(Accounts)]
pub struct LockMarket<'info> {
    pub cranker: Signer<'info>,
    #[account(mut)]
    pub market: Account<'info, Market>,
}

pub fn handler(ctx: Context<LockMarket>) -> Result<()> {
    require!(
        ctx.accounts.market.state == MarketState::Open,
        TrueBookError::MarketNotOpen
    );
    let now = Clock::get()?.unix_timestamp;
    require!(now >= ctx.accounts.market.kickoff_ts, TrueBookError::KickoffNotReached);

    let market = &mut ctx.accounts.market;
    market.state = MarketState::Locked;

    emit!(MarketLocked {
        market: market.key(),
        locked_ts: now,
    });
    Ok(())
}
