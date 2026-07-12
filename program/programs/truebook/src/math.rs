// Pure pricing and payout math. All arithmetic is checked; no floating point.
// Odds are decimal odds scaled by ODDS_BPS_SCALE (2.06 decimal = 20_600).
// Probabilities are basis points of 1.0 (BPS_DENOMINATOR = 10_000 = 100 percent).

use crate::constants::{BPS_DENOMINATOR, ODDS_BPS_SCALE};
use crate::errors::TrueBookError;

// Potential payout for a stake at given odds: stake * odds / scale, checked in u128.
pub fn potential_payout(stake: u64, odds_bps: u32) -> Result<u64, TrueBookError> {
    let numerator = (stake as u128)
        .checked_mul(odds_bps as u128)
        .ok_or(TrueBookError::MathOverflow)?;
    let payout = numerator
        .checked_div(ODDS_BPS_SCALE as u128)
        .ok_or(TrueBookError::MathOverflow)?;
    u64::try_from(payout).map_err(|_| TrueBookError::MathOverflow)
}

// Implied probability (in bps) from decimal odds (in odds bps): scale^2 / odds / denom.
// prob_bps = (ODDS_BPS_SCALE * BPS_DENOMINATOR) / odds_bps.
pub fn implied_prob_bps(odds_bps: u32) -> Result<u32, TrueBookError> {
    if odds_bps <= ODDS_BPS_SCALE as u32 {
        // Odds must represent > 1.0 for a valid probability below 100 percent.
        return Err(TrueBookError::InvalidOdds);
    }
    let numerator = (ODDS_BPS_SCALE as u128)
        .checked_mul(BPS_DENOMINATOR as u128)
        .ok_or(TrueBookError::MathOverflow)?;
    let prob = numerator
        .checked_div(odds_bps as u128)
        .ok_or(TrueBookError::MathOverflow)?;
    u32::try_from(prob).map_err(|_| TrueBookError::MathOverflow)
}

// The fair consensus probability plus the house margin, in bps.
// house_prob = consensus_prob * (BPS_DENOMINATOR + margin_bps) / BPS_DENOMINATOR.
pub fn house_prob_bps(consensus_prob_bps: u32, margin_bps: u16) -> Result<u32, TrueBookError> {
    let scaled = (consensus_prob_bps as u128)
        .checked_mul((BPS_DENOMINATOR as u128).checked_add(margin_bps as u128).ok_or(TrueBookError::MathOverflow)?)
        .ok_or(TrueBookError::MathOverflow)?;
    let result = scaled
        .checked_div(BPS_DENOMINATOR as u128)
        .ok_or(TrueBookError::MathOverflow)?;
    u32::try_from(result).map_err(|_| TrueBookError::MathOverflow)
}

// A served price is honest if its implied probability does not exceed the consensus
// probability grown by the stated margin plus an allowed tolerance. A higher served
// implied probability means a worse (lower) price for the bettor than promised.
pub fn is_price_within_margin(
    served_implied_bps: u32,
    consensus_implied_bps: u32,
    margin_bps: u16,
    tolerance_bps: u16,
) -> Result<bool, TrueBookError> {
    let allowed = house_prob_bps(consensus_implied_bps, margin_bps)?
        .checked_add(tolerance_bps as u32)
        .ok_or(TrueBookError::MathOverflow)?;
    Ok(served_implied_bps <= allowed)
}

// Cash-out value of a live ticket: the vault buys the ticket back for the
// payout weighted by the complement of the OPPOSITE side's implied probability.
// The opposite side's served implied already carries the house margin (it sits
// above consensus), so its complement sits below the fair value of the ticket:
// the margin lands in the house's favor without a second haircut, and the whole
// price is derived from the on-chain quote, which validate_odds can audit.
// value = payout * (BPS_DENOMINATOR - opposite_implied_bps) / BPS_DENOMINATOR.
pub fn cash_out_value(
    potential_payout: u64,
    opposite_implied_bps: u32,
) -> Result<u64, TrueBookError> {
    let complement = (BPS_DENOMINATOR as u128)
        .checked_sub(opposite_implied_bps as u128)
        .ok_or(TrueBookError::MathOverflow)?;
    let numerator = (potential_payout as u128)
        .checked_mul(complement)
        .ok_or(TrueBookError::MathOverflow)?;
    let value = numerator
        .checked_div(BPS_DENOMINATOR as u128)
        .ok_or(TrueBookError::MathOverflow)?;
    u64::try_from(value).map_err(|_| TrueBookError::MathOverflow)
}

// Audit-to-earn bounty: bounty_bps of the stake, capped by the vault's free
// liquidity so reserved payouts of live tickets are never spent on bounties.
pub fn bounty_amount(
    stake: u64,
    bounty_bps: u16,
    free_liquidity: u64,
) -> Result<u64, TrueBookError> {
    let raw = (stake as u128)
        .checked_mul(bounty_bps as u128)
        .ok_or(TrueBookError::MathOverflow)?
        .checked_div(BPS_DENOMINATOR as u128)
        .ok_or(TrueBookError::MathOverflow)?;
    let raw = u64::try_from(raw).map_err(|_| TrueBookError::MathOverflow)?;
    Ok(raw.min(free_liquidity))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn payout_scales_with_odds() {
        // 100 USDT (6 decimals) at 2.06 decimal odds = 206 USDT.
        let payout = potential_payout(100_000_000, 20_600).unwrap();
        assert_eq!(payout, 206_000_000);
    }

    #[test]
    fn implied_prob_of_two_even_odds() {
        // Decimal odds 2.0 => 50 percent = 5000 bps.
        assert_eq!(implied_prob_bps(20_000).unwrap(), 5_000);
    }

    #[test]
    fn odds_at_or_below_one_are_invalid() {
        assert!(implied_prob_bps(10_000).is_err());
    }

    #[test]
    fn served_price_within_margin_is_honest() {
        // Consensus 50 percent, 2 percent margin: allowed = 5100 + tolerance.
        assert!(is_price_within_margin(5_100, 5_000, 200, 25).unwrap());
        assert!(is_price_within_margin(5_125, 5_000, 200, 25).unwrap());
        // 5200 exceeds 5100 + 25 tolerance: a violation.
        assert!(!is_price_within_margin(5_200, 5_000, 200, 25).unwrap());
    }

    #[test]
    fn cash_out_pays_the_opposite_complement() {
        // Payout 206 USDT, opposite side implied 52 percent: value = 206 * 0.48.
        assert_eq!(cash_out_value(206_000_000, 5_200).unwrap(), 98_880_000);
        // Opposite side certain (100 percent) values the ticket at zero.
        assert_eq!(cash_out_value(206_000_000, 10_000).unwrap(), 0);
    }

    #[test]
    fn cash_out_sits_below_fair_value() {
        // Fair ticket value at consensus 50/50 on a 206 payout is 103. With a
        // 2 percent margin the opposite side is served at implied 51 percent,
        // so the cash-out (206 * 0.49 = 100.94) stays under fair value.
        let value = cash_out_value(206_000_000, 5_100).unwrap();
        assert!(value < 103_000_000);
        assert_eq!(value, 100_940_000);
    }

    #[test]
    fn bounty_is_five_percent_capped_by_free_liquidity() {
        // 5 percent of a 100 USDT stake is 5 USDT when liquidity allows.
        assert_eq!(bounty_amount(100_000_000, 500, 50_000_000).unwrap(), 5_000_000);
        // The cap wins when free liquidity is thinner than the bounty.
        assert_eq!(bounty_amount(100_000_000, 500, 1_250_000).unwrap(), 1_250_000);
        // An empty vault pays nothing but the audit itself still lands.
        assert_eq!(bounty_amount(100_000_000, 500, 0).unwrap(), 0);
    }
}
