use anchor_lang::prelude::*;

use crate::constants::{
    AUDIT_TOLERANCE_BPS, BPS_DENOMINATOR, CASHOUT_SEED, HOUSE_SEED, MILLISECONDS_PER_DAY_I64,
    ODDS_BPS_SCALE, TXLINE_DAILY_BATCH_SEED, TXLINE_PRICE_DECIMAL_SCALE, TXLINE_PROGRAM_ID,
};
use crate::errors::TrueBookError;
use crate::events::CashOutAudited;
use crate::math::{cash_out_value, house_prob_bps, implied_prob_bps, is_price_within_margin};
use crate::oddsmap::{expected_odds_record, record_matches_expectation};
use crate::state::{AuditStatus, CashOutReceipt, House, Market, Side, Ticket};
use crate::txline_cpi::{invoke_validate_odds, ValidateOddsArgs};

// Permissionless: prove the quote a cash-out was priced from is authentic
// TxLINE consensus, then check the opposite side's served implied probability
// against that consensus plus the stated margin (overcharging the opposite
// side is exactly what lowers a cash-out). A proven violation records the
// shortfall against the honest floor and the auditor's claim to the bounty;
// claim_cash_out_repair then moves the money. The verdict and the payout are
// separate instructions on purpose: the verdict needs the oracle CPI, the
// payout needs the token program, and each stays small and auditable.
#[derive(Accounts)]
#[instruction(args: ValidateOddsArgs)]
pub struct AuditCashOut<'info> {
    pub cranker: Signer<'info>,
    #[account(seeds = [HOUSE_SEED], bump = house.bump)]
    pub house: Account<'info, House>,
    #[account(has_one = house)]
    pub market: Account<'info, Market>,
    #[account(
        constraint = ticket.market == market.key() @ TrueBookError::TicketMarketMismatch
    )]
    pub ticket: Account<'info, Ticket>,
    #[account(
        mut,
        seeds = [CASHOUT_SEED, ticket.key().as_ref()],
        bump = cash_out_receipt.bump,
        constraint = cash_out_receipt.ticket == ticket.key() @ TrueBookError::TicketMarketMismatch
    )]
    pub cash_out_receipt: Account<'info, CashOutReceipt>,
    /// CHECK: the TxLINE daily odds (batch) roots PDA. Its key is checked against the
    /// PDA derived from the proof timestamp, and the CPI validates its data.
    pub daily_odds_merkle_roots: AccountInfo<'info>,
    /// CHECK: the TxLINE oracle program, pinned by address.
    #[account(address = TXLINE_PROGRAM_ID)]
    pub txoracle_program: AccountInfo<'info>,
}

pub fn handler(ctx: Context<AuditCashOut>, args: ValidateOddsArgs) -> Result<()> {
    // The audited record must be the exact quote the cash-out was priced from.
    require!(
        args.odds_snapshot.message_id == ctx.accounts.cash_out_receipt.odds_message_id
            && args.odds_snapshot.ts == ctx.accounts.cash_out_receipt.odds_ts,
        TrueBookError::OddsRecordMismatch
    );
    require!(
        args.odds_snapshot.fixture_id == ctx.accounts.market.fixture_id,
        TrueBookError::FixtureMismatch
    );
    // And it must be the consensus record type the market's predicate commits
    // to, so a cheaper record cannot stand in for the real one.
    let expected = expected_odds_record(&ctx.accounts.market.params)?;
    require!(
        record_matches_expectation(
            &expected,
            &args.odds_snapshot.super_odds_type,
            &args.odds_snapshot.market_parameters,
            &args.odds_snapshot.market_period,
        ),
        TrueBookError::WrongOddsRecordForMarket
    );

    // The daily-odds account must be the PDA for the proof timestamp's epoch day.
    let epoch_day = u16::try_from(args.ts / MILLISECONDS_PER_DAY_I64)
        .map_err(|_| error!(TrueBookError::InvalidRootAccount))?;
    let (expected_pda, _bump) = Pubkey::find_program_address(
        &[TXLINE_DAILY_BATCH_SEED, &epoch_day.to_le_bytes()],
        &TXLINE_PROGRAM_ID,
    );
    require_keys_eq!(
        ctx.accounts.daily_odds_merkle_roots.key(),
        expected_pda,
        TrueBookError::InvalidRootAccount
    );

    // Authenticate the odds record against the on-chain consensus root.
    let authentic = invoke_validate_odds(
        &ctx.accounts.txoracle_program,
        &ctx.accounts.daily_odds_merkle_roots,
        &args,
    )?;
    require!(authentic, TrueBookError::OddsNotAuthentic);

    // Consensus implied probability of the market's committed YES outcome.
    let price_index = expected.yes_price_index as usize;
    let raw_price = *args
        .odds_snapshot
        .prices
        .get(price_index)
        .ok_or(error!(TrueBookError::OddsRecordMismatch))?;
    require!(raw_price > 0, TrueBookError::InvalidOdds);
    let price_to_bps = ODDS_BPS_SCALE
        .checked_div(TXLINE_PRICE_DECIMAL_SCALE)
        .ok_or(TrueBookError::MathOverflow)?;
    let consensus_yes_odds_bps = (raw_price as u64)
        .checked_mul(price_to_bps)
        .ok_or(TrueBookError::MathOverflow)?;
    let consensus_yes_odds_bps =
        u32::try_from(consensus_yes_odds_bps).map_err(|_| TrueBookError::MathOverflow)?;
    let consensus_yes_implied = implied_prob_bps(consensus_yes_odds_bps)?;

    // The cash-out was priced from the OPPOSITE side of the ticket.
    let consensus_opposite_implied = match ctx.accounts.ticket.side {
        Side::Yes => (BPS_DENOMINATOR as u32)
            .checked_sub(consensus_yes_implied)
            .ok_or(TrueBookError::MathOverflow)?,
        Side::No => consensus_yes_implied,
    };
    let served_opposite_implied =
        implied_prob_bps(ctx.accounts.cash_out_receipt.opposite_odds_bps)?;

    let honest = is_price_within_margin(
        served_opposite_implied,
        consensus_opposite_implied,
        ctx.accounts.house.margin_bps,
        AUDIT_TOLERANCE_BPS,
    )?;

    let was_already_violation =
        ctx.accounts.cash_out_receipt.audit_status == AuditStatus::Violation;
    let mut shortfall_owed: u64 = 0;

    if !honest && !was_already_violation {
        // The honest floor: what the cash-out was worth at consensus plus the
        // stated margin. Anything below it is a proven underpayment. The
        // first prover earns the bounty; claim_cash_out_repair pays both.
        let allowed_opposite_implied =
            house_prob_bps(consensus_opposite_implied, ctx.accounts.house.margin_bps)?;
        let honest_floor = cash_out_value(
            ctx.accounts.ticket.potential_payout,
            allowed_opposite_implied,
        )?;
        shortfall_owed =
            honest_floor.saturating_sub(ctx.accounts.cash_out_receipt.paid_amount);
        let receipt = &mut ctx.accounts.cash_out_receipt;
        receipt.auditor = ctx.accounts.cranker.key();
        receipt.shortfall_owed = shortfall_owed;
    }

    let receipt = &mut ctx.accounts.cash_out_receipt;
    receipt.audit_status = if honest {
        AuditStatus::Honest
    } else {
        AuditStatus::Violation
    };

    emit!(CashOutAudited {
        receipt: receipt.key(),
        ticket: receipt.ticket,
        authentic,
        violation: !honest,
        served_opposite_implied_bps: served_opposite_implied,
        consensus_opposite_implied_bps: consensus_opposite_implied,
        shortfall_owed,
    });
    Ok(())
}
