use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};

use crate::constants::{
    AUDIT_BOUNTY_BPS, AUDIT_TOLERANCE_BPS, BPS_DENOMINATOR, HOUSE_SEED,
    MILLISECONDS_PER_DAY_I64, ODDS_BPS_SCALE, TXLINE_DAILY_BATCH_SEED,
    TXLINE_PRICE_DECIMAL_SCALE, TXLINE_PROGRAM_ID,
};
use crate::errors::TrueBookError;
use crate::events::TicketAudited;
use crate::math::{bounty_amount, implied_prob_bps, is_price_within_margin};
use crate::oddsmap::{expected_odds_record, record_matches_expectation};
use crate::state::{AuditStatus, House, Market, Side, Ticket, TicketState};
use crate::txline_cpi::{invoke_validate_odds, ValidateOddsArgs};

// Permissionless: prove the odds record a ticket was priced from is authentic TxLINE
// consensus data, then check the served price against that consensus plus the stated
// margin. A proven overcharge flags the ticket refundable, even a losing one, and
// pays the auditor the audit-to-earn bounty from the vault's free liquidity.
#[derive(Accounts)]
#[instruction(args: ValidateOddsArgs)]
pub struct AuditTicket<'info> {
    pub cranker: Signer<'info>,
    #[account(seeds = [HOUSE_SEED], bump = house.bump)]
    pub house: Account<'info, House>,
    #[account(has_one = house)]
    pub market: Account<'info, Market>,
    #[account(
        mut,
        constraint = ticket.market == market.key() @ TrueBookError::TicketMarketMismatch
    )]
    pub ticket: Account<'info, Ticket>,
    #[account(mut, address = house.vault)]
    pub vault: Account<'info, TokenAccount>,
    // The auditor picks where the bounty lands; only the mint is constrained.
    #[account(mut, token::mint = house.usdt_mint)]
    pub auditor_token_account: Account<'info, TokenAccount>,
    /// CHECK: the TxLINE daily odds (batch) roots PDA. Its key is checked against the
    /// PDA derived from the proof timestamp, and the CPI validates its data.
    pub daily_odds_merkle_roots: AccountInfo<'info>,
    /// CHECK: the TxLINE oracle program, pinned by address.
    #[account(address = TXLINE_PROGRAM_ID)]
    pub txoracle_program: AccountInfo<'info>,
    pub token_program: Program<'info, Token>,
}

pub fn handler(ctx: Context<AuditTicket>, args: ValidateOddsArgs) -> Result<()> {
    // The audited record must be the exact quote the ticket referenced.
    require!(
        args.odds_snapshot.message_id == ctx.accounts.ticket.odds_message_id
            && args.odds_snapshot.ts == ctx.accounts.ticket.odds_ts,
        TrueBookError::OddsRecordMismatch
    );
    require!(
        args.odds_snapshot.fixture_id == ctx.accounts.market.fixture_id,
        TrueBookError::FixtureMismatch
    );
    // And it must be the consensus record type the market's predicate commits
    // to (right SuperOddsType, right line, right period), so a keeper cannot
    // price one question and be audited against a cheaper record.
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

    // Consensus implied probability for the market's committed YES outcome.
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

    // The consensus implied probability of the ticket's own side.
    let consensus_implied = match ctx.accounts.ticket.side {
        Side::Yes => consensus_yes_implied,
        Side::No => (BPS_DENOMINATOR as u32)
            .checked_sub(consensus_yes_implied)
            .ok_or(TrueBookError::MathOverflow)?,
    };
    let served_implied = implied_prob_bps(ctx.accounts.ticket.quoted_odds_bps)?;

    let honest = is_price_within_margin(
        served_implied,
        consensus_implied,
        ctx.accounts.house.margin_bps,
        AUDIT_TOLERANCE_BPS,
    )?;

    // Audit-to-earn: the FIRST proven violation pays the auditor. The verdict
    // is deterministic per record, so the transition guard is what prevents
    // draining the vault by re-auditing the same ticket.
    let was_already_violation = ctx.accounts.ticket.audit_status == AuditStatus::Violation;
    let mut bounty_paid: u64 = 0;
    if !honest && !was_already_violation {
        let free_liquidity = ctx
            .accounts
            .vault
            .amount
            .saturating_sub(ctx.accounts.house.open_exposure);
        bounty_paid = bounty_amount(ctx.accounts.ticket.stake, AUDIT_BOUNTY_BPS, free_liquidity)?;
        if bounty_paid > 0 {
            let house_bump = ctx.accounts.house.bump;
            let signer_seeds: &[&[&[u8]]] = &[&[HOUSE_SEED, &[house_bump]]];
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
    }

    let ticket = &mut ctx.accounts.ticket;
    if honest {
        ticket.audit_status = AuditStatus::Honest;
    } else {
        ticket.audit_status = AuditStatus::Violation;
        // A proven overcharge makes the ticket refundable whether it is still live
        // or was already settled to Lost, so a house that front-runs the audit with
        // settle_ticket cannot dodge the refund. A Lost ticket was never paid (no
        // double payout); a Won ticket already received its full winnings and is left.
        if ticket.state == TicketState::Live || ticket.state == TicketState::Lost {
            ticket.state = TicketState::Refundable;
        }
    }

    emit!(TicketAudited {
        market: ctx.accounts.market.key(),
        ticket: ticket.key(),
        authentic,
        violation: !honest,
        served_implied_bps: served_implied,
        consensus_implied_bps: consensus_implied,
        bounty_paid,
    });
    Ok(())
}
