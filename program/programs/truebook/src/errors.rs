// TrueBook program errors. Each failure mode is distinct and actionable.

use anchor_lang::prelude::*;

#[error_code]
pub enum TrueBookError {
    #[msg("House is paused; no new bets accepted.")]
    HousePaused,
    #[msg("Margin basis points must be greater than zero and below 100 percent.")]
    InvalidMargin,
    #[msg("Odds must be strictly greater than 1.0 (10000 bps).")]
    InvalidOdds,
    #[msg("Stake must be greater than zero.")]
    ZeroStake,
    #[msg("The served quote has expired; refresh it before betting.")]
    QuoteExpired,
    #[msg("The market is not open for betting.")]
    MarketNotOpen,
    #[msg("Kickoff has already passed for this market.")]
    KickoffPassed,
    #[msg("Kickoff has not been reached yet; the market cannot be locked.")]
    KickoffNotReached,
    #[msg("The market is not locked.")]
    MarketNotLocked,
    #[msg("The market outcome has not been verified yet.")]
    OutcomeNotVerified,
    #[msg("The market outcome has already been verified.")]
    OutcomeAlreadyVerified,
    #[msg("Potential payout would exceed the house exposure cap for this market.")]
    ExposureCapExceeded,
    #[msg("Potential payout exceeds the per-ticket cap.")]
    PayoutCapExceeded,
    #[msg("The house vault has insufficient free liquidity to cover this payout.")]
    InsufficientLiquidity,
    #[msg("Withdrawal would drop the vault below its open exposure.")]
    WithdrawalBelowExposure,
    #[msg("The ticket has already been settled.")]
    TicketAlreadySettled,
    #[msg("The ticket does not belong to this market.")]
    TicketMarketMismatch,
    #[msg("The proof timestamp does not match the market fixture.")]
    FixtureMismatch,
    #[msg("The oracle validation returned no result.")]
    ValidationNoResult,
    #[msg("The referenced odds record could not be authenticated against consensus.")]
    OddsNotAuthentic,
    #[msg("The ticket price is within the stated margin; no violation to refund.")]
    NoPriceViolation,
    #[msg("The market grace period for voiding has not elapsed.")]
    VoidGraceNotElapsed,
    #[msg("The ticket is not in a refundable state.")]
    TicketNotRefundable,
    #[msg("Arithmetic overflow.")]
    MathOverflow,
    #[msg("The provided odds MessageId exceeds the maximum stored length.")]
    MessageIdTooLong,
    #[msg("Unauthorized: signer is not the house authority.")]
    Unauthorized,
    #[msg("The proof predicate does not match the market's committed predicate.")]
    PredicateMismatch,
    #[msg("The provided daily-root account does not match the timestamp's expected PDA.")]
    InvalidRootAccount,
    #[msg("The audited odds record does not match the ticket's referenced quote.")]
    OddsRecordMismatch,
    #[msg("The market predicate maps to no known TxLINE consensus record; it cannot be priced or audited.")]
    UnsupportedMarketPredicate,
    #[msg("The audited odds record is not the consensus record type the market's predicate commits to.")]
    WrongOddsRecordForMarket,
    #[msg("The current quote values this ticket at zero; hold it to settlement instead.")]
    CashOutValueZero,
    #[msg("This cash-out's shortfall and bounty have already been paid.")]
    ShortfallAlreadyPaid,
}
