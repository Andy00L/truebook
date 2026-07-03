// End-to-end test of the TrueBook trustless flow against the real TxLINE oracle,
// cloned onto a local validator (see Anchor.toml [test.validator]).
//
// Flow: initialize house -> deposit -> create home-win market -> post quote ->
// place a YES bet -> lock -> verify_market (CPI into validate_stat against the real
// cloned scores root) -> settle the winner -> audit the served price (validate_odds).
//
// The proof fixtures were captured from devnet on 2026-07-02 (fixture 18172379,
// USA 2-0 Bosnia). sourceRef: docs/research/2026-07-02-spike-findings.md.

import * as anchor from "@coral-xyz/anchor";
import { Program, BN } from "@coral-xyz/anchor";
import { Truebook } from "../target/types/truebook";
import { PublicKey, Keypair, LAMPORTS_PER_SOL } from "@solana/web3.js";
import {
  createMint,
  getOrCreateAssociatedTokenAccount,
  mintTo,
  getAccount,
} from "@solana/spl-token";
import { assert } from "chai";
import { readFileSync } from "fs";

const TXORACLE_PROGRAM = new PublicKey("6pW64gN1s2uqjHkn1unFeEjAwJkPGHoppGvS715wyP2J");
const SCORES_ROOT_PDA = new PublicKey("FNLRxCxRf3idEDyixYg8uHj9xEVJSuqHvStxwRHf7k6e");
const ODDS_ROOT_PDA = new PublicKey("2jrJG67oRfbDKwMNZBg86LD6vXviHRXaWcNcozrHjMom");
const FIXTURE_ID = new BN(18172379);
const USDT_DECIMALS = 6;

type ProofNodeJson = { hash: number[]; isRightSibling: boolean };
const mapProof = (nodes: ProofNodeJson[]) =>
  nodes.map((node) => ({ hash: node.hash, isRightSibling: node.isRightSibling }));
const sleep = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds));

describe("truebook", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.truebook as Program<Truebook>;
  const operator = (provider.wallet as anchor.Wallet).payer;

  const scoresProof = JSON.parse(readFileSync("tests/fixtures/scores-proof-home-win.json", "utf8"));
  const oddsValidation = JSON.parse(readFileSync("tests/fixtures/odds-validation-1x2.json", "utf8"));

  let usdtMint: PublicKey;
  let operatorTokenAccount: PublicKey;
  const bettor = Keypair.generate();
  let bettorTokenAccount: PublicKey;

  const [housePda] = PublicKey.findProgramAddressSync([Buffer.from("house")], program.programId);
  const [vaultPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("vault"), housePda.toBuffer()],
    program.programId,
  );
  const [marketPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("market"), housePda.toBuffer(), new BN(0).toArrayLike(Buffer, "le", 8)],
    program.programId,
  );
  const betNonce = new BN(1);
  const [ticketPda] = PublicKey.findProgramAddressSync(
    [
      Buffer.from("ticket"),
      marketPda.toBuffer(),
      bettor.publicKey.toBuffer(),
      betNonce.toArrayLike(Buffer, "le", 8),
    ],
    program.programId,
  );
  const [outcomePda] = PublicKey.findProgramAddressSync(
    [Buffer.from("outcome"), marketPda.toBuffer()],
    program.programId,
  );

  // Home win predicate: (P1 goals - P2 goals) > 0, period Total. Home price is part1 (index 0).
  const marketParams = {
    statAKey: 1,
    statAPeriod: 0,
    statBKey: 2,
    statBPeriod: 0,
    hasStatB: true,
    op: { subtract: {} },
    comparison: { greaterThan: {} },
    threshold: 0,
  };
  // 1.58 decimal (implied ~63.3 percent), honest against consensus 1.613 (~62 percent) + 2 percent margin.
  const yesOddsBps = 15_800;
  const noOddsBps = 30_000;
  const stake = new BN(100_000_000); // 100 USDT

  before(async () => {
    const airdropSignature = await provider.connection.requestAirdrop(
      bettor.publicKey,
      2 * LAMPORTS_PER_SOL,
    );
    const latestBlockhash = await provider.connection.getLatestBlockhash();
    await provider.connection.confirmTransaction({ signature: airdropSignature, ...latestBlockhash });

    usdtMint = await createMint(provider.connection, operator, operator.publicKey, null, USDT_DECIMALS);
    operatorTokenAccount = (
      await getOrCreateAssociatedTokenAccount(provider.connection, operator, usdtMint, operator.publicKey)
    ).address;
    bettorTokenAccount = (
      await getOrCreateAssociatedTokenAccount(provider.connection, operator, usdtMint, bettor.publicKey)
    ).address;
    await mintTo(provider.connection, operator, usdtMint, operatorTokenAccount, operator, 1_000_000_000);
    await mintTo(provider.connection, operator, usdtMint, bettorTokenAccount, operator, 500_000_000);
  });

  it("initializes the house and funds the vault", async () => {
    await program.methods
      .initializeHouse(200, new BN(1_000_000_000), new BN(1_000_000_000))
      .accounts({ authority: operator.publicKey, usdtMint, vault: vaultPda })
      .rpc();
    await program.methods
      .depositLiquidity(new BN(1_000_000_000))
      .accounts({ authority: operator.publicKey, vault: vaultPda, authorityTokenAccount: operatorTokenAccount })
      .rpc();
    const vaultAccount = await getAccount(provider.connection, vaultPda);
    assert.equal(vaultAccount.amount.toString(), "1000000000");
  });

  it("creates a home-win market and posts a quote", async () => {
    const kickoffTs = new BN(Math.floor(Date.now() / 1000) + 5);
    await program.methods
      .createMarket(FIXTURE_ID, marketParams, 0, kickoffTs)
      .accounts({ authority: operator.publicKey, house: housePda, market: marketPda })
      .rpc();
    await program.methods
      .postQuote(yesOddsBps, noOddsBps, oddsValidation.odds.MessageId, new BN(oddsValidation.odds.Ts))
      .accounts({ keeper: operator.publicKey, house: housePda, market: marketPda })
      .rpc();
    const market = await program.account.market.fetch(marketPda);
    assert.equal(market.yesOddsBps, yesOddsBps);
    assert.equal(market.oddsMessageId, oddsValidation.odds.MessageId);
  });

  it("places a YES bet snapshotting the quote", async () => {
    await program.methods
      .placeBet(betNonce, { yes: {} }, stake)
      .accounts({
        bettor: bettor.publicKey,
        house: housePda,
        market: marketPda,
        ticket: ticketPda,
        vault: vaultPda,
        bettorTokenAccount,
      })
      .signers([bettor])
      .rpc();
    const ticket = await program.account.ticket.fetch(ticketPda);
    assert.equal(ticket.stake.toString(), stake.toString());
    assert.equal(ticket.quotedOddsBps, yesOddsBps);
    assert.equal(ticket.oddsMessageId, oddsValidation.odds.MessageId);
  });

  it("locks then verifies the outcome by CPI into TxLINE validate_stat", async () => {
    await sleep(6000);
    await program.methods.lockMarket().accounts({ cranker: operator.publicKey, market: marketPda }).rpc();

    const statArgs = {
      ts: new BN(scoresProof.summary.updateStats.minTimestamp),
      fixtureSummary: {
        fixtureId: new BN(scoresProof.summary.fixtureId),
        updateStats: {
          updateCount: scoresProof.summary.updateStats.updateCount,
          minTimestamp: new BN(scoresProof.summary.updateStats.minTimestamp),
          maxTimestamp: new BN(scoresProof.summary.updateStats.maxTimestamp),
        },
        eventsSubTreeRoot: scoresProof.summary.eventStatsSubTreeRoot,
      },
      fixtureProof: mapProof(scoresProof.subTreeProof),
      mainTreeProof: mapProof(scoresProof.mainTreeProof),
      predicate: { threshold: 0, comparison: { greaterThan: {} } },
      statA: {
        statToProve: scoresProof.statToProve,
        eventStatRoot: scoresProof.eventStatRoot,
        statProof: mapProof(scoresProof.statProof),
      },
      statB: {
        statToProve: scoresProof.statToProve2,
        eventStatRoot: scoresProof.eventStatRoot,
        statProof: mapProof(scoresProof.statProof2),
      },
      op: { subtract: {} },
    };

    await program.methods
      .verifyMarket(statArgs, 1058)
      .accounts({
        cranker: operator.publicKey,
        house: housePda,
        market: marketPda,
        verifiedOutcome: outcomePda,
        dailyScoresMerkleRoots: SCORES_ROOT_PDA,
        txoracleProgram: TXORACLE_PROGRAM,
      })
      .preInstructions([anchor.web3.ComputeBudgetProgram.setComputeUnitLimit({ units: 1_400_000 })])
      .rpc();

    const verified = await program.account.verifiedOutcome.fetch(outcomePda);
    assert.equal(verified.outcome, true, "home win (2-0) must resolve YES");
  });

  it("settles the winning ticket from the vault", async () => {
    const balanceBefore = (await getAccount(provider.connection, bettorTokenAccount)).amount;
    await program.methods
      .settleTicket()
      .accounts({
        cranker: operator.publicKey,
        house: housePda,
        market: marketPda,
        verifiedOutcome: outcomePda,
        ticket: ticketPda,
        vault: vaultPda,
        bettorTokenAccount,
      })
      .rpc();
    const balanceAfter = (await getAccount(provider.connection, bettorTokenAccount)).amount;
    const expectedPayout = stake.muln(yesOddsBps).divn(10_000);
    assert.equal((balanceAfter - balanceBefore).toString(), expectedPayout.toString());
    const ticket = await program.account.ticket.fetch(ticketPda);
    assert.deepEqual(ticket.state, { won: {} });
  });

  it("audits the served price against consensus and finds it honest", async () => {
    const oddsArgs = {
      ts: new BN(oddsValidation.summary.updateStats.minTimestamp),
      oddsSnapshot: {
        fixtureId: new BN(oddsValidation.odds.FixtureId),
        messageId: oddsValidation.odds.MessageId,
        ts: new BN(oddsValidation.odds.Ts),
        bookmaker: oddsValidation.odds.Bookmaker,
        bookmakerId: oddsValidation.odds.BookmakerId,
        superOddsType: oddsValidation.odds.SuperOddsType,
        gameState: oddsValidation.odds.GameState,
        inRunning: oddsValidation.odds.InRunning,
        marketParameters: oddsValidation.odds.MarketParameters,
        marketPeriod: oddsValidation.odds.MarketPeriod,
        priceNames: oddsValidation.odds.PriceNames,
        prices: oddsValidation.odds.Prices,
      },
      summary: {
        fixtureId: new BN(oddsValidation.summary.fixtureId),
        updateStats: {
          updateCount: oddsValidation.summary.updateStats.updateCount,
          minTimestamp: new BN(oddsValidation.summary.updateStats.minTimestamp),
          maxTimestamp: new BN(oddsValidation.summary.updateStats.maxTimestamp),
        },
        oddsSubTreeRoot: oddsValidation.summary.oddsSubTreeRoot,
      },
      subTreeProof: mapProof(oddsValidation.subTreeProof),
      mainTreeProof: mapProof(oddsValidation.mainTreeProof),
    };

    await program.methods
      .auditTicket(oddsArgs)
      .accounts({
        cranker: operator.publicKey,
        house: housePda,
        market: marketPda,
        ticket: ticketPda,
        dailyOddsMerkleRoots: ODDS_ROOT_PDA,
        txoracleProgram: TXORACLE_PROGRAM,
      })
      .preInstructions([anchor.web3.ComputeBudgetProgram.setComputeUnitLimit({ units: 1_400_000 })])
      .rpc();

    const ticket = await program.account.ticket.fetch(ticketPda);
    assert.deepEqual(ticket.auditStatus, { honest: {} });
  });
});
