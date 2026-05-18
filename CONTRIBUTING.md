# Contributing to VestFlow

Thank you for your interest in contributing! VestFlow is a Stellar/Soroban token vesting protocol — contributions to the smart contract, frontend, tests, and documentation are all welcome.

## Getting started

1. Fork the repository and clone your fork.
2. Install prerequisites: Node.js ≥ 18, Rust, `wasm32v1-none` target, Stellar CLI, Freighter wallet.
3. Run `npm install` in the project root.
4. Run `cargo test` inside `contracts/vestflow/` to verify the contract tests pass.
5. Run `npm run dev` and open `http://localhost:3000` to verify the frontend builds.

## Ways to contribute

- **Bug reports** — open an issue describing the behaviour, what you expected, and steps to reproduce.
- **Feature requests** — open an issue with the `enhancement` label. Discuss before implementing.
- **Good first issues** — issues labelled [`good first issue`](https://github.com/libby-coder/vestflow/issues?q=label%3A%22good+first+issue%22) are scoped and well-described — a great place to start.
- **Documentation** — typo fixes, clarifications, and new examples are always appreciated.
- **Tests** — additional test cases for edge cases in the contract are valuable.

## Pull request guidelines

- Keep each PR focused on one thing.
- For contract changes: add or update tests in `contracts/vestflow/src/lib.rs`. All tests must pass (`cargo test`).
- For frontend changes: make sure `npm run build` succeeds without TypeScript errors.
- Write a clear PR description explaining what changed and why.
- Reference any related issue with `Closes #<number>`.

## Contract development notes

The Soroban contract targets `wasm32v1-none` and uses `soroban-sdk` v22.

```bash
# Run tests
cd contracts/vestflow
cargo test

# Build WASM
cargo build --target wasm32v1-none --release

# Deploy to testnet (requires stellar CLI + funded key)
stellar contract deploy \
  --wasm target/wasm32v1-none/release/vestflow.wasm \
  --source your-key \
  --network testnet
```

## Code style

- Rust: follow standard `rustfmt` formatting (`cargo fmt`).
- TypeScript: no explicit linter configured — match the surrounding style.
- Comments: only when the *why* is non-obvious.

## Reporting security issues

Please do **not** open a public issue for security vulnerabilities. Email the maintainer directly so the issue can be addressed before public disclosure.
