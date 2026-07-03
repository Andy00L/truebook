use anchor_lang::prelude::*;

use crate::constants::{
    HOUSE_SEED, MILLISECONDS_PER_DAY_I64, OUTCOME_SEED, TXLINE_DAILY_SCORES_SEED, TXLINE_PROGRAM_ID,
};
use crate::errors::TrueBookError;
use crate::events::MarketVerified;
use crate::state::{BinaryOp, Comparison, House, Market, MarketState, VerifiedOutcome};
use crate::txline_cpi::{
    invoke_validate_stat, TxBinaryExpression, TxComparison, ValidateStatArgs,
};

// Permissionless: prove a market's outcome by CPI into TxLINE validate_stat. The
// passed proof must match the market's committed predicate, so a keeper cannot
// resolve a different question than the one bettors were quoted.
#[derive(Accounts)]
#[instruction(args: ValidateStatArgs, seq: u32)]
pub struct VerifyMarket<'info> {
    #[account(mut)]
    pub cranker: Signer<'info>,
    #[account(seeds = [HOUSE_SEED], bump = house.bump)]
    pub house: Account<'info, House>,
    #[account(mut, has_one = house)]
    pub market: Account<'info, Market>,
    #[account(
        init,
        payer = cranker,
        space = 8 + VerifiedOutcome::INIT_SPACE,
        seeds = [OUTCOME_SEED, market.key().as_ref()],
        bump
    )]
    pub verified_outcome: Account<'info, VerifiedOutcome>,
    /// CHECK: the TxLINE daily scores roots PDA. Its key is checked against the
    /// PDA derived from the proof timestamp, and the CPI itself validates its data.
    pub daily_scores_merkle_roots: AccountInfo<'info>,
    /// CHECK: the TxLINE oracle program, pinned by address.
    #[account(address = TXLINE_PROGRAM_ID)]
    pub txoracle_program: AccountInfo<'info>,
    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<VerifyMarket>, args: ValidateStatArgs, seq: u32) -> Result<()> {
    require!(
        ctx.accounts.market.state == MarketState::Locked,
        TrueBookError::MarketNotLocked
    );

    let params = ctx.accounts.market.params;

    // The proof must concern this market's fixture and committed predicate.
    require!(
        args.fixture_summary.fixture_id == ctx.accounts.market.fixture_id,
        TrueBookError::FixtureMismatch
    );
    require!(
        args.stat_a.stat_to_prove.key == params.stat_a_key
            && args.stat_a.stat_to_prove.period == params.stat_a_period,
        TrueBookError::PredicateMismatch
    );
    require!(args.stat_b.is_some() == params.has_stat_b, TrueBookError::PredicateMismatch);
    if let Some(ref stat_b) = args.stat_b {
        require!(
            stat_b.stat_to_prove.key == params.stat_b_key
                && stat_b.stat_to_prove.period == params.stat_b_period,
            TrueBookError::PredicateMismatch
        );
    }
    let op_matches = matches!(
        (params.op, &args.op),
        (BinaryOp::None, None)
            | (BinaryOp::Add, Some(TxBinaryExpression::Add))
            | (BinaryOp::Subtract, Some(TxBinaryExpression::Subtract))
    );
    require!(op_matches, TrueBookError::PredicateMismatch);
    require!(args.predicate.threshold == params.threshold, TrueBookError::PredicateMismatch);
    let comparison_matches = matches!(
        (&args.predicate.comparison, params.comparison),
        (TxComparison::GreaterThan, Comparison::GreaterThan)
            | (TxComparison::LessThan, Comparison::LessThan)
            | (TxComparison::EqualTo, Comparison::EqualTo)
    );
    require!(comparison_matches, TrueBookError::PredicateMismatch);

    // The daily-scores account must be the PDA for the proof timestamp's epoch day.
    let epoch_day = u16::try_from(args.ts / MILLISECONDS_PER_DAY_I64)
        .map_err(|_| error!(TrueBookError::InvalidRootAccount))?;
    let (expected_pda, _bump) = Pubkey::find_program_address(
        &[TXLINE_DAILY_SCORES_SEED, &epoch_day.to_le_bytes()],
        &TXLINE_PROGRAM_ID,
    );
    require_keys_eq!(
        ctx.accounts.daily_scores_merkle_roots.key(),
        expected_pda,
        TrueBookError::InvalidRootAccount
    );

    // Trustless resolution: the boolean is the market's YES outcome.
    let outcome = invoke_validate_stat(
        &ctx.accounts.txoracle_program,
        &ctx.accounts.daily_scores_merkle_roots,
        &args,
    )?;

    let now = Clock::get()?.unix_timestamp;
    let market_key = ctx.accounts.market.key();

    let verified_outcome = &mut ctx.accounts.verified_outcome;
    verified_outcome.market = market_key;
    verified_outcome.outcome = outcome;
    verified_outcome.seq = seq;
    verified_outcome.verified_ts = now;
    verified_outcome.bump = ctx.bumps.verified_outcome;

    ctx.accounts.market.state = MarketState::Verified;

    emit!(MarketVerified {
        market: market_key,
        outcome,
        seq,
        verified_ts: now,
    });
    Ok(())
}
