// TrueBook program derived addresses, matching the on-chain seeds.

import { PublicKey } from "@solana/web3.js";
import { BN } from "@coral-xyz/anchor";

export function housePda(programId: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync([Buffer.from("house")], programId)[0];
}

export function vaultPda(programId: PublicKey, house: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync([Buffer.from("vault"), house.toBuffer()], programId)[0];
}

export function marketPda(programId: PublicKey, house: PublicKey, marketId: BN): PublicKey {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("market"), house.toBuffer(), marketId.toArrayLike(Buffer, "le", 8)],
    programId,
  )[0];
}

export function outcomePda(programId: PublicKey, market: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync([Buffer.from("outcome"), market.toBuffer()], programId)[0];
}

export function ticketPda(
  programId: PublicKey,
  market: PublicKey,
  bettor: PublicKey,
  nonce: BN,
): PublicKey {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("ticket"), market.toBuffer(), bettor.toBuffer(), nonce.toArrayLike(Buffer, "le", 8)],
    programId,
  )[0];
}

export function cashOutReceiptPda(programId: PublicKey, ticket: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("cashout"), ticket.toBuffer()],
    programId,
  )[0];
}

// TxLINE daily-root PDAs, derived on the TxLINE program from a proof timestamp.
const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

function epochDayBuffer(minTimestampMs: number): Buffer {
  const epochDay = Math.floor(minTimestampMs / MILLISECONDS_PER_DAY);
  const buffer = Buffer.alloc(2);
  buffer.writeUInt16LE(epochDay, 0);
  return buffer;
}

export function dailyScoresRootPda(txlineProgramId: PublicKey, minTimestampMs: number): PublicKey {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("daily_scores_roots"), epochDayBuffer(minTimestampMs)],
    txlineProgramId,
  )[0];
}

export function dailyOddsRootPda(txlineProgramId: PublicKey, minTimestampMs: number): PublicKey {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("daily_batch_roots"), epochDayBuffer(minTimestampMs)],
    txlineProgramId,
  )[0];
}
