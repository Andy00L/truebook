// TrueBook keeper entry point.
//
// The keeper is the permissionless off-chain worker that connects the TxLINE feed
// to the on-chain truebook program. Jobs, built out in later steps:
//   1. syncFixtures   create a Market per remaining fixture
//   2. refreshQuotes  stream StablePrice odds, post_quote on-chain
//   3. lockMarkets    lock_market at kickoff
//   4. settleMarkets  fetch score proof, verify_market (CPI validate_stat), settle_ticket
//
// This file is intentionally a thin runner; each job lives in its own module.

async function main(): Promise<void> {
  console.log("[main] TrueBook keeper starting");
  console.log("[main] jobs are wired in subsequent build steps");
}

main().catch((error: unknown) => {
  console.error("[main] fatal error:", error);
  process.exit(1);
});
