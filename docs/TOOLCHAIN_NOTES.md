# Toolchain notes

## Solana BPF build: pinned dependencies (do not `cargo update` these back)

The Solana platform-tools bundled with the current Agave install build the
program with rustc 1.79.0 (platform-tools v1.43), which predates the
stabilization of Rust edition 2024 (Rust 1.85). A freshly generated
`program/Cargo.lock` resolves several transitive crates to versions that now
require `edition2024`, which fails the SBF build with:

```
feature `edition2024` is required ... not stabilized in this version of Cargo (1.79.0)
```

The fix is to pin those transitive crates to their last edition-2021 releases.
All pins live in `program/Cargo.lock` and are captured below with their reason.
Do not run `cargo update` on the program without re-checking these.

| Crate | Pinned to | Why | Pulled by |
|-------|-----------|-----|-----------|
| blake3 | 1.5.5 | 1.6+ moved to digest 0.11 / block-buffer 0.12.1 (edition2024) | solana-program |
| proc-macro-crate | 3.2.0 | 3.5.0 pulls toml_edit 0.25 / toml_datetime 1.1.1 (edition2024) | borsh-derive |
| indexmap | 2.7.1 | 2.14 requires hashbrown 0.17.1 (edition2024) | toml_edit |
| hashbrown | 0.15.5 | 0.16+ require edition2024 | indexmap |

Commands used (for reference, run by hand, never staged as build steps):

```bash
cd program
cargo update -p blake3 --precise 1.5.5
cargo update -p proc-macro-crate@3.5.0 --precise 3.2.0
cargo update -p indexmap@2.14.0 --precise 2.7.1
```

## Durable alternative (if the pin list grows)

Instead of pinning, build with a newer platform-tools whose Rust supports
edition 2024 (v1.48 or later bundles Rust 1.85+):

```bash
anchor build -- --tools-version v1.50
```

This was not adopted as the default because it requires passing the flag to
every `anchor build` and `anchor test` invocation. If the pin list becomes hard
to maintain, switch to this and document the version here.

## Verified toolchain versions (2026-07-02)

- bun 1.3.14
- rustc 1.96.1 (host)
- solana-cli 4.0.2 (Agave)
- cargo-build-sbf: platform-tools v1.43, rustc 1.79.0
- anchor-cli 0.31.1
- Next.js 16.2.10
