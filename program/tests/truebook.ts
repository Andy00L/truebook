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
type ScoreStatJson = { key: number; value: number; period: number };
type UpdateStatsJson = { updateCount: number; minTimestamp: number; maxTimestamp: number };
type StatProofFixture = {
  summary: { fixtureId: number; updateStats: UpdateStatsJson; eventStatsSubTreeRoot: number[] };
  statToProve: ScoreStatJson;
  statToProve2: ScoreStatJson;
  eventStatRoot: number[];
  statProof: ProofNodeJson[];
  statProof2: ProofNodeJson[];
  subTreeProof: ProofNodeJson[];
  mainTreeProof: ProofNodeJson[];
};
type OddsValidationFixture = {
  odds: {
    FixtureId: number;
    MessageId: string;
    Ts: number;
    Bookmaker: string;
    BookmakerId: number;
    SuperOddsType: string;
    GameState: string | null;
    InRunning: boolean;
    MarketParameters: string | null;
    MarketPeriod: string | null;
    PriceNames: string[];
    Prices: number[];
  };
  summary: { fixtureId: number; updateStats: UpdateStatsJson; oddsSubTreeRoot: number[] };
  subTreeProof: ProofNodeJson[];
  mainTreeProof: ProofNodeJson[];
};

const mapProof = (nodes: ProofNodeJson[]) =>
  nodes.map((node) => ({ hash: node.hash, isRightSibling: node.isRightSibling }));
const sleep = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds));

// Home-win validate_stat args from the scores fixture: (P1 goals - P2 goals) > 0.
function buildStatArgs(proof: StatProofFixture) {
  return {
    ts: new BN(proof.summary.updateStats.minTimestamp),
    fixtureSummary: {
      fixtureId: new BN(proof.summary.fixtureId),
      updateStats: {
        updateCount: proof.summary.updateStats.updateCount,
        minTimestamp: new BN(proof.summary.updateStats.minTimestamp),
        maxTimestamp: new BN(proof.summary.updateStats.maxTimestamp),
      },
      eventsSubTreeRoot: proof.summary.eventStatsSubTreeRoot,
    },
    fixtureProof: mapProof(proof.subTreeProof),
    mainTreeProof: mapProof(proof.mainTreeProof),
    predicate: { threshold: 0, comparison: { greaterThan: {} } },
    statA: {
      statToProve: proof.statToProve,
      eventStatRoot: proof.eventStatRoot,
      statProof: mapProof(proof.statProof),
    },
    statB: {
      statToProve: proof.statToProve2,
      eventStatRoot: proof.eventStatRoot,
      statProof: mapProof(proof.statProof2),
    },
    op: { subtract: {} },
  };
}

// validate_odds args from the odds validation fixture.
function buildOddsArgs(validation: OddsValidationFixture) {
  const odds = validation.odds;
  return {
    ts: new BN(validation.summary.updateStats.minTimestamp),
    oddsSnapshot: {
      fixtureId: new BN(odds.FixtureId),
      messageId: odds.MessageId,
      ts: new BN(odds.Ts),
      bookmaker: odds.Bookmaker,
      bookmakerId: odds.BookmakerId,
      superOddsType: odds.SuperOddsType,
      gameState: odds.GameState,
      inRunning: odds.InRunning,
      marketParameters: odds.MarketParameters,
      marketPeriod: odds.MarketPeriod,
      priceNames: odds.PriceNames,
      prices: odds.Prices,
    },
    summary: {
      fixtureId: new BN(validation.summary.fixtureId),
      updateStats: {
        updateCount: validation.summary.updateStats.updateCount,
        minTimestamp: new BN(validation.summary.updateStats.minTimestamp),
        maxTimestamp: new BN(validation.summary.updateStats.maxTimestamp),
      },
      oddsSubTreeRoot: validation.summary.oddsSubTreeRoot,
    },
    subTreeProof: mapProof(validation.subTreeProof),
    mainTreeProof: mapProof(validation.mainTreeProof),
  };
}

describe("truebook", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.truebook as Program<Truebook>;
  const operator = (provider.wallet as anchor.Wallet).payer;

  const scoresProof: StatProofFixture = JSON.parse(
    readFileSync("tests/fixtures/scores-proof-home-win.json", "utf8"),
  );
  const oddsValidation: OddsValidationFixture = JSON.parse(
    readFileSync("tests/fixtures/odds-validation-1x2.json", "utf8"),
  );

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

    const statArgs = buildStatArgs(scoresProof);

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
    const oddsArgs = buildOddsArgs(oddsValidation);

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

  it("refunds a losing ticket even when the house settles before the audit", async () => {
    // Second market on the same fixture. The house rigs the NO price: consensus
    // home-win implied is ~62 percent, so fair NO is ~38 percent (about 2.63
    // decimal). Serving NO at 2.00 (implied 50 percent) is far outside the
    // 2 percent margin plus tolerance: a provable overcharge.
    const [market2Pda] = PublicKey.findProgramAddressSync(
      [Buffer.from("market"), housePda.toBuffer(), new BN(1).toArrayLike(Buffer, "le", 8)],
      program.programId,
    );
    const [outcome2Pda] = PublicKey.findProgramAddressSync(
      [Buffer.from("outcome"), market2Pda.toBuffer()],
      program.programId,
    );
    const riggedNoOddsBps = 20_000; // 2.00 decimal, rigged (fair is ~2.63)
    const noStake = new BN(50_000_000); // 50 USDT
    const yesStake = new BN(10_000_000); // 10 USDT, stays live to guard exposure math
    const noNonce = new BN(2);
    const yesNonce = new BN(3);
    const [ticketNoPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("ticket"), market2Pda.toBuffer(), bettor.publicKey.toBuffer(), noNonce.toArrayLike(Buffer, "le", 8)],
      program.programId,
    );
    const [ticketYesPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("ticket"), market2Pda.toBuffer(), bettor.publicKey.toBuffer(), yesNonce.toArrayLike(Buffer, "le", 8)],
      program.programId,
    );

    const kickoffTs = new BN(Math.floor(Date.now() / 1000) + 5);
    await program.methods
      .createMarket(FIXTURE_ID, marketParams, 0, kickoffTs)
      .accounts({ authority: operator.publicKey, house: housePda, market: market2Pda })
      .rpc();
    await program.methods
      .postQuote(yesOddsBps, riggedNoOddsBps, oddsValidation.odds.MessageId, new BN(oddsValidation.odds.Ts))
      .accounts({ keeper: operator.publicKey, house: housePda, market: market2Pda })
      .rpc();

    for (const [nonce, side, stake_] of [
      [noNonce, { no: {} }, noStake],
      [yesNonce, { yes: {} }, yesStake],
    ] as const) {
      await program.methods
        .placeBet(nonce, side, stake_)
        .accounts({
          bettor: bettor.publicKey,
          house: housePda,
          market: market2Pda,
          ticket:
            nonce === noNonce ? ticketNoPda : ticketYesPda,
          vault: vaultPda,
          bettorTokenAccount,
        })
        .signers([bettor])
        .rpc();
    }

    await sleep(6000);
    await program.methods.lockMarket().accounts({ cranker: operator.publicKey, market: market2Pda }).rpc();
    await program.methods
      .verifyMarket(buildStatArgs(scoresProof), 1058)
      .accounts({
        cranker: operator.publicKey,
        house: housePda,
        market: market2Pda,
        verifiedOutcome: outcome2Pda,
        dailyScoresMerkleRoots: SCORES_ROOT_PDA,
        txoracleProgram: TXORACLE_PROGRAM,
      })
      .preInstructions([anchor.web3.ComputeBudgetProgram.setComputeUnitLimit({ units: 1_400_000 })])
      .rpc();

    // The house front-runs the audit: settle the losing NO ticket immediately.
    await program.methods
      .settleTicket()
      .accounts({
        cranker: operator.publicKey,
        house: housePda,
        market: market2Pda,
        verifiedOutcome: outcome2Pda,
        ticket: ticketNoPda,
        vault: vaultPda,
        bettorTokenAccount,
      })
      .rpc();
    let ticketNo = await program.account.ticket.fetch(ticketNoPda);
    assert.deepEqual(ticketNo.state, { lost: {} }, "front-run settle marks the ticket Lost");

    // Exposure still owed to the live YES ticket, and to nothing else.
    const houseAfterSettle = await program.account.house.fetch(housePda);
    const yesTicket = await program.account.ticket.fetch(ticketYesPda);
    assert.equal(
      houseAfterSettle.openExposure.toString(),
      yesTicket.potentialPayout.toString(),
      "after settling NO, exposure equals the live YES ticket payout",
    );

    // The audit still catches the overcharge and reopens the Lost ticket.
    await program.methods
      .auditTicket(buildOddsArgs(oddsValidation))
      .accounts({
        cranker: operator.publicKey,
        house: housePda,
        market: market2Pda,
        ticket: ticketNoPda,
        dailyOddsMerkleRoots: ODDS_ROOT_PDA,
        txoracleProgram: TXORACLE_PROGRAM,
      })
      .preInstructions([anchor.web3.ComputeBudgetProgram.setComputeUnitLimit({ units: 1_400_000 })])
      .rpc();
    ticketNo = await program.account.ticket.fetch(ticketNoPda);
    assert.deepEqual(ticketNo.auditStatus, { violation: {} }, "audit proves the overcharge");
    assert.deepEqual(ticketNo.state, { refundable: {} }, "a settled Lost ticket becomes refundable");

    // Refund returns the full stake without double-releasing exposure.
    const balanceBefore = (await getAccount(provider.connection, bettorTokenAccount)).amount;
    await program.methods
      .refundTicket()
      .accounts({
        cranker: operator.publicKey,
        house: housePda,
        market: market2Pda,
        ticket: ticketNoPda,
        vault: vaultPda,
        bettorTokenAccount,
      })
      .rpc();
    const balanceAfter = (await getAccount(provider.connection, bettorTokenAccount)).amount;
    assert.equal((balanceAfter - balanceBefore).toString(), noStake.toString(), "full stake refunded");
    ticketNo = await program.account.ticket.fetch(ticketNoPda);
    assert.deepEqual(ticketNo.state, { refunded: {} });

    const houseAfterRefund = await program.account.house.fetch(housePda);
    assert.equal(
      houseAfterRefund.openExposure.toString(),
      yesTicket.potentialPayout.toString(),
      "refund does not release the settled ticket's exposure a second time",
    );

    // Clean up: settle the live YES winner and check exposure returns to zero.
    await program.methods
      .settleTicket()
      .accounts({
        cranker: operator.publicKey,
        house: housePda,
        market: market2Pda,
        verifiedOutcome: outcome2Pda,
        ticket: ticketYesPda,
        vault: vaultPda,
        bettorTokenAccount,
      })
      .rpc();
    const houseFinal = await program.account.house.fetch(housePda);
    assert.equal(houseFinal.openExposure.toString(), "0", "all exposure released exactly once");
  });
});
