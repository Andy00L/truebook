# TxLINE API feedback from building TrueBook

Eight frictions we hit while integrating the devnet API and oracle program
end to end (June 30 to July 14, 2026). Each was verified against the live
service; file references point at our workarounds. None of them blocked the
build, and the merkle-proof design itself held up under real use: every
proof we requested validated on chain once these were worked around.

## 1. The `ts` seed differs per validator (error 6010)

- **Symptom:** `validate_odds` fails with error 6010 (TimestampMismatch)
  when called with `ts = summary.updateStats.minTimestamp`, which is exactly
  what `validate_stat` requires.
- **Root cause:** `validate_stat` derives its daily-root day from the batch
  `minTimestamp`, while `validate_odds` checks `ts` against the odds
  record's own `Ts`. The asymmetry is invisible in small test fixtures
  where the two values coincide; it surfaced only in live audits (July 9).
- **Suggested fix:** document the expected `ts` per validator in the IDL
  docs, or derive the day inside the program from the payload itself.
- **Our workaround:** `packages/shared/src/proofArgs.ts` (one builder per
  validator, header comment explains the asymmetry).

## 2. zstd responses break common fetch clients

- **Symptom:** response bodies come back undecodable in Bun and Node
  (undici) fetch.
- **Root cause:** the API answers with `Content-Encoding: zstd`, which
  these clients do not decode.
- **Suggested fix:** honor `Accept-Encoding` negotiation, defaulting to
  gzip or identity.
- **Our workaround:** send `Accept-Encoding: identity` on every request
  (`packages/shared/src/config.ts` ACCEPT_ENCODING_IDENTITY).

## 3. Field rename between the API and the program

- **Symptom:** proofs deserialize but fail validation when passed
  naively: the API returns `eventStatsSubTreeRoot`, the program argument is
  `events_sub_tree_root`.
- **Suggested fix:** align the JSON field name with the on-chain argument
  name, or note the mapping in the docs.
- **Our workaround:** explicit mapping in the args builders
  (`packages/shared/src/proofArgs.ts`).

## 4. `subscribe` requires a pre-existing TxL Token-2022 ATA

- **Symptom:** the on-chain `subscribe` instruction fails for a fresh
  wallet.
- **Root cause:** it expects the caller's TxL (Token-2022) associated
  token account to exist already.
- **Suggested fix:** create the ATA idempotently inside the instruction,
  or state the prerequisite in the subscription docs.
- **Our workaround:** `createAssociatedTokenAccountIdempotentInstruction`
  before subscribe (`keeper/src/txlineAuth.ts`).

## 5. Validators return data instead of view functions

- **Symptom:** `validate_stat` and `validate_odds` are declared with a
  null return in the IDL; the boolean verdict arrives via Solana return
  data.
- **Impact:** CPI consumers must call `get_return_data()` and check the
  returning program id themselves; off-chain consumers must simulate and
  decode base64 return data.
- **Suggested fix:** type the return value in the IDL so Anchor clients
  and CPIs get it for free.
- **Our workaround:** `program/programs/truebook/src/txline_cpi.rs`
  (read_bool_return_data) and `keeper/src/verifyReceipt.ts` (free
  simulation reads for the receipt re-verifier).

## 6. `/api/token/activate` returns plain text, not JSON

- **Symptom:** JSON parsing of the activation response fails; the body is
  the bare token string (sometimes quoted).
- **Suggested fix:** return a JSON envelope like the other endpoints.
- **Our workaround:** read text and strip quotes
  (`keeper/src/txlineAuth.ts`).

## 7. `/api/token/activate` answers HTTP 500 since July 9

- **Symptom:** the full activation flow (guest JWT, on-chain subscribe,
  activate) fails at the last step with HTTP 500; tokens activated before
  July 9 keep working.
- **Impact:** new integrators cannot mint an API token at all right now.
- **Suggested fix:** restore the endpoint; meanwhile a status note in the
  docs would save each team the debugging session.
- **Our workaround:** an env override that reuses a previously activated
  token (`keeper/src/txlineAuth.ts` acquireTxlineAuth).

## 8. Stat-validation proofs change `period` per seq

- **Symptom:** requesting `stat-validation` at the latest seq of a
  finished match can return the stat under a different period encoding
  (observed: period 100 as a full-time confirmation, 4 and 5 as extra
  periods) than the period 0 (Total) a consumer committed to, so a
  correct-looking proof fails a predicate-bound verifier.
- **Suggested fix:** accept a `period` filter on the endpoint, or document
  the period encodings emitted around full time.
- **Our workaround:** walk seqs downward until the proof's period matches
  the committed predicate (`keeper/src/jobs.ts` verifyAndSettleMarket).

## One documentation nit

A just-posted odds record is not yet in an anchored batch, so
`/api/odds/validation` answers 404 for about a minute after the record
appears in `/api/odds/updates`. Expected given the anchoring cadence, but
worth one sentence in the endpoint docs; we surface it to users as "wait
for the next batch and retry" (`app/src/lib/server/txlineProofs.ts`).
