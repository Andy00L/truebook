use anchor_lang::prelude::*;

use crate::constants::{HOUSE_SEED, MARKET_SEED};
use crate::errors::TrueBookError;
use crate::events::MarketCreated;
use crate::state::{House, Market, MarketParams, MarketState};

#[derive(Accounts)]
pub struct CreateMarket<'info> {
    #[account(mut, address = house.authority @ TrueBookError::Unauthorized)]
    pub authority: Signer<'info>,
    #[account(mut, seeds = [HOUSE_SEED], bump = house.bump)]
    pub house: Account<'info, House>,
    #[account(
        init,
        payer = authority,
        space = 8 + Market::INIT_SPACE,
        seeds = [MARKET_SEED, house.key().as_ref(), &house.market_count.to_le_bytes()],
        bump
    )]
    pub market: Account<'info, Market>,
    pub system_program: Program<'info, System>,
}

pub fn handler(
    ctx: Context<CreateMarket>,
    fixture_id: i64,
    params: MarketParams,
    outcome_price_index: u8,
    kickoff_ts: i64,
) -> Result<()> {
    let market_id = ctx.accounts.house.market_count;
    let house_key = ctx.accounts.house.key();

    let market = &mut ctx.accounts.market;
    market.house = house_key;
    market.market_id = market_id;
    market.fixture_id = fixture_id;
    market.params = params;
    market.outcome_price_index = outcome_price_index;
    market.kickoff_ts = kickoff_ts;
    market.state = MarketState::Open;
    market.yes_odds_bps = 0;
    market.no_odds_bps = 0;
    market.odds_message_id = String::new();
    market.odds_ts = 0;
    market.quote_posted_ts = 0;
    market.yes_stake = 0;
    market.no_stake = 0;
    market.yes_payout = 0;
    market.no_payout = 0;
    market.bump = ctx.bumps.market;

    let house = &mut ctx.accounts.house;
    house.market_count = house
        .market_count
        .checked_add(1)
        .ok_or(TrueBookError::MathOverflow)?;

    emit!(MarketCreated {
        market: market.key(),
        market_id,
        fixture_id,
        kickoff_ts,
    });
    Ok(())
}
