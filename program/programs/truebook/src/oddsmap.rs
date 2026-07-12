// Maps a market's committed predicate to the one TxLINE StablePrice record
// shape its quotes must be priced from. This is what keeps a multi-market
// audit sound: audit_ticket and audit_cash_out derive the expected
// SuperOddsType, MarketParameters line, MarketPeriod, and YES price index
// from the on-chain predicate, so a keeper cannot quote a market from one
// consensus record and be audited against a cheaper one.
//
// Supported predicates (both stats are participant goals, sourceRef
// constants.rs and .scratch/odds-updates-18172379.json):
//   goals(P1) - goals(P2) >  0   -> 1X2 record, YES = part1 (index 0)
//   goals(P1) - goals(P2) == 0   -> 1X2 record, YES = draw  (index 1)
//   goals(P1) - goals(P2) <  0   -> 1X2 record, YES = part2 (index 2)
//   goals(P1) - goals(P2) >  N>0 -> Asian handicap "line=-N.5", YES = part1
//   goals(P1) + goals(P2) >  T   -> Over/Under "line=T.5", YES = over (index 0)
// Periods: Total maps to a full-time record (MarketPeriod None); first half
// maps to MarketPeriod "half=1".

use crate::constants::{
    MARKET_PERIOD_FIRST_HALF, STAT_KEY_P1_GOALS, STAT_KEY_P2_GOALS, STAT_PERIOD_FIRST_HALF,
    STAT_PERIOD_TOTAL, SUPER_ODDS_1X2, SUPER_ODDS_ASIAN_HANDICAP, SUPER_ODDS_OVER_UNDER,
};
use crate::errors::TrueBookError;
use crate::state::{BinaryOp, Comparison, MarketParams};

// The record shape a predicate's quotes must come from.
pub struct ExpectedOddsRecord {
    pub super_odds_type: &'static str,
    pub market_parameters: Option<String>,
    pub market_period: Option<String>,
    pub yes_price_index: u8,
}

// The MarketPeriod string for a committed stat period, or an error for
// periods the feed does not quote.
fn market_period_for(stat_period: i32) -> Result<Option<String>, TrueBookError> {
    if stat_period == STAT_PERIOD_TOTAL {
        return Ok(None);
    }
    if stat_period == STAT_PERIOD_FIRST_HALF {
        return Ok(Some(MARKET_PERIOD_FIRST_HALF.to_string()));
    }
    Err(TrueBookError::UnsupportedMarketPredicate)
}

pub fn expected_odds_record(params: &MarketParams) -> Result<ExpectedOddsRecord, TrueBookError> {
    // Every supported predicate compares the two participants' goal stats of
    // one period.
    let is_goals_pair = params.has_stat_b
        && params.stat_a_key == STAT_KEY_P1_GOALS
        && params.stat_b_key == STAT_KEY_P2_GOALS
        && params.stat_a_period == params.stat_b_period;
    if !is_goals_pair {
        return Err(TrueBookError::UnsupportedMarketPredicate);
    }
    let market_period = market_period_for(params.stat_a_period)?;

    match (params.op, params.comparison, params.threshold) {
        // Result markets from the 1X2 consensus record.
        (BinaryOp::Subtract, Comparison::GreaterThan, 0) => Ok(ExpectedOddsRecord {
            super_odds_type: SUPER_ODDS_1X2,
            market_parameters: None,
            market_period,
            yes_price_index: 0,
        }),
        (BinaryOp::Subtract, Comparison::EqualTo, 0) => Ok(ExpectedOddsRecord {
            super_odds_type: SUPER_ODDS_1X2,
            market_parameters: None,
            market_period,
            yes_price_index: 1,
        }),
        (BinaryOp::Subtract, Comparison::LessThan, 0) => Ok(ExpectedOddsRecord {
            super_odds_type: SUPER_ODDS_1X2,
            market_parameters: None,
            market_period,
            yes_price_index: 2,
        }),
        // Winning-margin markets from the Asian handicap record: winning by
        // more than N goals is the part1 price of the "line=-N.5" record.
        (BinaryOp::Subtract, Comparison::GreaterThan, margin_goals) if margin_goals > 0 => {
            Ok(ExpectedOddsRecord {
                super_odds_type: SUPER_ODDS_ASIAN_HANDICAP,
                market_parameters: Some(format!("line=-{margin_goals}.5")),
                market_period,
                yes_price_index: 0,
            })
        }
        // Totals markets from the Over/Under record: more than T goals is the
        // over price of the "line=T.5" record.
        (BinaryOp::Add, Comparison::GreaterThan, total_goals) if total_goals >= 0 => {
            Ok(ExpectedOddsRecord {
                super_odds_type: SUPER_ODDS_OVER_UNDER,
                market_parameters: Some(format!("line={total_goals}.5")),
                market_period,
                yes_price_index: 0,
            })
        }
        _ => Err(TrueBookError::UnsupportedMarketPredicate),
    }
}

// True when an authenticated odds record has exactly the shape the market's
// predicate commits to.
pub fn record_matches_expectation(
    expected: &ExpectedOddsRecord,
    super_odds_type: &str,
    market_parameters: &Option<String>,
    market_period: &Option<String>,
) -> bool {
    super_odds_type == expected.super_odds_type
        && *market_parameters == expected.market_parameters
        && *market_period == expected.market_period
}

#[cfg(test)]
mod tests {
    use super::*;

    fn goals_params(op: BinaryOp, comparison: Comparison, threshold: i32) -> MarketParams {
        MarketParams {
            stat_a_key: STAT_KEY_P1_GOALS,
            stat_a_period: STAT_PERIOD_TOTAL,
            stat_b_key: STAT_KEY_P2_GOALS,
            stat_b_period: STAT_PERIOD_TOTAL,
            has_stat_b: true,
            op,
            comparison,
            threshold,
        }
    }

    #[test]
    fn home_win_maps_to_1x2_part1() {
        let expected =
            expected_odds_record(&goals_params(BinaryOp::Subtract, Comparison::GreaterThan, 0))
                .unwrap();
        assert_eq!(expected.super_odds_type, SUPER_ODDS_1X2);
        assert_eq!(expected.market_parameters, None);
        assert_eq!(expected.market_period, None);
        assert_eq!(expected.yes_price_index, 0);
    }

    #[test]
    fn draw_and_away_map_to_1x2_indexes() {
        let draw =
            expected_odds_record(&goals_params(BinaryOp::Subtract, Comparison::EqualTo, 0))
                .unwrap();
        assert_eq!(draw.yes_price_index, 1);
        let away =
            expected_odds_record(&goals_params(BinaryOp::Subtract, Comparison::LessThan, 0))
                .unwrap();
        assert_eq!(away.yes_price_index, 2);
    }

    #[test]
    fn totals_map_to_the_line_record() {
        let over =
            expected_odds_record(&goals_params(BinaryOp::Add, Comparison::GreaterThan, 2))
                .unwrap();
        assert_eq!(over.super_odds_type, SUPER_ODDS_OVER_UNDER);
        assert_eq!(over.market_parameters.as_deref(), Some("line=2.5"));
        assert_eq!(over.yes_price_index, 0);
    }

    #[test]
    fn winning_margin_maps_to_the_handicap_record() {
        let margin =
            expected_odds_record(&goals_params(BinaryOp::Subtract, Comparison::GreaterThan, 1))
                .unwrap();
        assert_eq!(margin.super_odds_type, SUPER_ODDS_ASIAN_HANDICAP);
        assert_eq!(margin.market_parameters.as_deref(), Some("line=-1.5"));
    }

    #[test]
    fn first_half_totals_carry_the_half_period() {
        let mut params = goals_params(BinaryOp::Add, Comparison::GreaterThan, 0);
        params.stat_a_period = STAT_PERIOD_FIRST_HALF;
        params.stat_b_period = STAT_PERIOD_FIRST_HALF;
        let expected = expected_odds_record(&params).unwrap();
        assert_eq!(expected.market_period.as_deref(), Some(MARKET_PERIOD_FIRST_HALF));
    }

    #[test]
    fn unknown_predicates_are_rejected() {
        // A corners predicate has no consensus record in the feed.
        let mut params = goals_params(BinaryOp::Add, Comparison::GreaterThan, 4);
        params.stat_a_key = 7;
        params.stat_b_key = 8;
        assert!(expected_odds_record(&params).is_err());
        // Under-style comparisons on totals never map (NO covers them).
        assert!(
            expected_odds_record(&goals_params(BinaryOp::Add, Comparison::LessThan, 2)).is_err()
        );
        // Mismatched periods across the two stats never map.
        let mut mixed = goals_params(BinaryOp::Subtract, Comparison::GreaterThan, 0);
        mixed.stat_b_period = STAT_PERIOD_FIRST_HALF;
        assert!(expected_odds_record(&mixed).is_err());
    }

    #[test]
    fn record_match_requires_every_field() {
        let expected =
            expected_odds_record(&goals_params(BinaryOp::Add, Comparison::GreaterThan, 2))
                .unwrap();
        assert!(record_matches_expectation(
            &expected,
            SUPER_ODDS_OVER_UNDER,
            &Some("line=2.5".to_string()),
            &None,
        ));
        assert!(!record_matches_expectation(
            &expected,
            SUPER_ODDS_OVER_UNDER,
            &Some("line=0.5".to_string()),
            &None,
        ));
        assert!(!record_matches_expectation(
            &expected,
            SUPER_ODDS_1X2,
            &None,
            &None,
        ));
    }
}
