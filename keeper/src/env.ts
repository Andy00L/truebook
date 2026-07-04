// Keeper environment: the service keypair, RPC connection, and program handle.
// The keeper signs TxLINE activation and posts on-chain quotes and settlements.

import { AnchorProvider, Program, Wallet } from "@coral-xyz/anchor";
import { Connection, Keypair } from "@solana/web3.js";
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { DEVNET_RPC_URL, TRUEBOOK_IDL, type Truebook } from "@truebook/shared";

// Load the keeper's Solana keypair from disk (env override or the CLI default).
export function loadKeeperKeypair(): Keypair {
  const keypairPath =
    process.env.KEEPER_KEYPAIR_PATH ?? `${homedir()}/.config/solana/id.json`;
  const secretKeyBytes = Uint8Array.from(JSON.parse(readFileSync(keypairPath, "utf8")));
  return Keypair.fromSecretKey(secretKeyBytes);
}

export function getConnection(): Connection {
  return new Connection(process.env.KEEPER_RPC_URL ?? DEVNET_RPC_URL, "confirmed");
}

// Build the Anchor provider and typed TrueBook program for the keeper keypair.
export function buildProgram(connection: Connection, keypair: Keypair): Program<Truebook> {
  const provider = new AnchorProvider(connection, new Wallet(keypair), { commitment: "confirmed" });
  return new Program(TRUEBOOK_IDL as Truebook, provider);
}
