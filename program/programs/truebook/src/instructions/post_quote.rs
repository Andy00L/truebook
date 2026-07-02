use anchor_lang::prelude::*;

use crate::constants::{HOUSE_SEED, MAX_ODDS_MESSAGE_ID_LEN, ODDS_BPS_SCALE};
use crate::errors::TrueBookError;
use crate::events::QuotePosted;
use crate::state::{House, Market, MarketState};

#[derive(Accounts)]
pub struct PostQuote<'info> {
    #[account(address = house.authority @ TrueBookError::Unauthorized)]
    pub keeper: Signer<'info>,
    #[account(seeds = [HOUSE_SEED], bump = house.bump)]
    pub house: Account<'info, House>,
    #[account(mut, has_one = house)]
    pub market: Account<'info, Market>,
}

pub fn handler(
    ctx: Context<PostQuote>,
    yes_odds_bps: u32,
    no_odds_bps: u32,
    odds_message_id: String,
    odds_ts: i64,
) -> Result<()> {
    require!(
        ctx.accounts.market.state == MarketState::Open,
        TrueBookError::MarketNotOpen
    );
    // Both sides must be valid decimal odds strictly above 1.0.
    require!(
        yes_odds_bps as u64 > ODDS_BPS_SCALE && no_odds_bps as u64 > ODDS_BPS_SCALE,
        TrueBookError::InvalidOdds
    );
    require!(
        odds_message_id.len() <= MAX_ODDS_MESSAGE_ID_LEN,
        TrueBookError::MessageIdTooLong
    );

    let now = Clock::get()?.unix_timestamp;
    let market = &mut ctx.accounts.market;
    market.yes_odds_bps = yes_odds_bps;
    market.no_odds_bps = no_odds_bps;
    market.odds_message_id = odds_message_id.clone();
    market.odds_ts = odds_ts;
    market.quote_posted_ts = now;

    emit!(QuotePosted {
        market: market.key(),
        yes_odds_bps,
        no_odds_bps,
        odds_message_id,
        odds_ts,
    });
    Ok(())
}
