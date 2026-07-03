// Cross-program invocation into the TxLINE oracle program. The types below mirror
// the TxLINE devnet IDL exactly so their borsh layout matches on the wire.
// sourceRef: packages/shared/src/idl/txoracle-devnet.json (validate_stat, validate_odds).
//
// validate_stat and validate_odds are view-style instructions: they take no mutable
// accounts and return a single boolean through Solana return data (the IDL marks the
// return as null, so we read the return data ourselves rather than via a typed CPI).

use anchor_lang::prelude::*;
use anchor_lang::solana_program::{
    hash::hash,
    instruction::{AccountMeta, Instruction},
    program::{get_return_data, invoke},
};

use crate::errors::TrueBookError;

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct TxProofNode {
    pub hash: [u8; 32],
    pub is_right_sibling: bool,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct TxScoreStat {
    pub key: u32,
    pub value: i32,
    pub period: i32,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct TxScoresUpdateStats {
    pub update_count: i32,
    pub min_timestamp: i64,
    pub max_timestamp: i64,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct TxScoresBatchSummary {
    pub fixture_id: i64,
    pub update_stats: TxScoresUpdateStats,
    pub events_sub_tree_root: [u8; 32],
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct TxStatTerm {
    pub stat_to_prove: TxScoreStat,
    pub event_stat_root: [u8; 32],
    pub stat_proof: Vec<TxProofNode>,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub enum TxComparison {
    GreaterThan,
    LessThan,
    EqualTo,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct TxTraderPredicate {
    pub threshold: i32,
    pub comparison: TxComparison,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub enum TxBinaryExpression {
    Add,
    Subtract,
}

// Full argument set for validate_stat, in the exact order the instruction expects.
#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct ValidateStatArgs {
    pub ts: i64,
    pub fixture_summary: TxScoresBatchSummary,
    pub fixture_proof: Vec<TxProofNode>,
    pub main_tree_proof: Vec<TxProofNode>,
    pub predicate: TxTraderPredicate,
    pub stat_a: TxStatTerm,
    pub stat_b: Option<TxStatTerm>,
    pub op: Option<TxBinaryExpression>,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct TxOddsUpdateStats {
    pub update_count: u32,
    pub min_timestamp: i64,
    pub max_timestamp: i64,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct TxOdds {
    pub fixture_id: i64,
    pub message_id: String,
    pub ts: i64,
    pub bookmaker: String,
    pub bookmaker_id: i32,
    pub super_odds_type: String,
    pub game_state: Option<String>,
    pub in_running: bool,
    pub market_parameters: Option<String>,
    pub market_period: Option<String>,
    pub price_names: Vec<String>,
    pub prices: Vec<i32>,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct TxOddsBatchSummary {
    pub fixture_id: i64,
    pub update_stats: TxOddsUpdateStats,
    pub odds_sub_tree_root: [u8; 32],
}

// Full argument set for validate_odds, in instruction order.
#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct ValidateOddsArgs {
    pub ts: i64,
    pub odds_snapshot: TxOdds,
    pub summary: TxOddsBatchSummary,
    pub sub_tree_proof: Vec<TxProofNode>,
    pub main_tree_proof: Vec<TxProofNode>,
}

// Read the single boolean the TxLINE program leaves in return data.
fn read_bool_return_data(expected_program: &Pubkey) -> Result<bool> {
    let (returning_program, data) =
        get_return_data().ok_or(error!(TrueBookError::ValidationNoResult))?;
    require_keys_eq!(returning_program, *expected_program, TrueBookError::ValidationNoResult);
    Ok(data.first().copied().unwrap_or(0) == 1)
}

// CPI into validate_stat and return the boolean predicate result.
pub fn invoke_validate_stat<'info>(
    txoracle_program: &AccountInfo<'info>,
    daily_scores_merkle_roots: &AccountInfo<'info>,
    args: &ValidateStatArgs,
) -> Result<bool> {
    let mut data = hash(b"global:validate_stat").to_bytes()[..8].to_vec();
    let serialized = args
        .try_to_vec()
        .map_err(|_| error!(TrueBookError::ValidationNoResult))?;
    data.extend_from_slice(&serialized);

    let instruction = Instruction {
        program_id: *txoracle_program.key,
        accounts: vec![AccountMeta::new_readonly(*daily_scores_merkle_roots.key, false)],
        data,
    };
    invoke(
        &instruction,
        &[daily_scores_merkle_roots.clone(), txoracle_program.clone()],
    )?;
    read_bool_return_data(txoracle_program.key)
}

// CPI into validate_odds and return whether the odds record is authentic.
pub fn invoke_validate_odds<'info>(
    txoracle_program: &AccountInfo<'info>,
    daily_odds_merkle_roots: &AccountInfo<'info>,
    args: &ValidateOddsArgs,
) -> Result<bool> {
    let mut data = hash(b"global:validate_odds").to_bytes()[..8].to_vec();
    let serialized = args
        .try_to_vec()
        .map_err(|_| error!(TrueBookError::ValidationNoResult))?;
    data.extend_from_slice(&serialized);

    let instruction = Instruction {
        program_id: *txoracle_program.key,
        accounts: vec![AccountMeta::new_readonly(*daily_odds_merkle_roots.key, false)],
        data,
    };
    invoke(
        &instruction,
        &[daily_odds_merkle_roots.clone(), txoracle_program.clone()],
    )?;
    read_bool_return_data(txoracle_program.key)
}
