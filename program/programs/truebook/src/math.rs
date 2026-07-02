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
}
