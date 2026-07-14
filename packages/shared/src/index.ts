// Public surface of the shared package. Modules are added as they are built:
// config (validated constants), txline client (auth, SSE, proofs), and shared types.

export * from "./config.js";
export * from "./marketCatalog.js";
export * from "./proofArgs.js";
export * from "./receipt.js";
export * from "./txline/types.js";
export * from "./txline/sse.js";
export * from "./txline/client.js";

// Generated TrueBook program IDL (runtime object) and its TS type.
export type { Truebook } from "./idl/truebook.js";
export { default as TRUEBOOK_IDL } from "./idl/truebook.json" with { type: "json" };
