# VestFlow Scripts

This directory contains shell scripts for deploying and testing the VestFlow contract.

## Prerequisites

- [Stellar CLI](https://developers.stellar.org/docs/tools/developer-tools/cli/install-cli)
- Rust with `wasm32v1-none` target
- A funded Stellar keypair in the CLI keystore

## Funding a key

```bash
stellar keys generate my-key --network testnet
stellar keys fund my-key --network testnet
```

Check the balance:
```bash
stellar keys balance my-key --network testnet
```

## Scripts

### `deploy-testnet.sh`

Builds and deploys the contract to Stellar Testnet, writes the contract ID to `.env.local`, records the deployment in `DEPLOYMENTS.md`, and runs a smoke test.

```bash
DEPLOYER_KEY=my-key ./scripts/deploy-testnet.sh
```

### `deploy-mainnet.sh`

Same flow for Stellar Mainnet with additional safety prompts.

```bash
DEPLOYER_KEY=my-mainnet-key ./scripts/deploy-mainnet.sh
```

Set `VERSION=vX.Y.Z` to record a tagged release version in the deployment registry. Set `UPDATE_DEPLOYMENTS=0` to skip writing `DEPLOYMENTS.md`.

### `generate-bindings.sh`

Builds the release Wasm and regenerates typed TypeScript contract bindings.

```bash
./scripts/generate-bindings.sh
```

### `contract-metrics.sh`

Builds the release Wasm, optimizes it when Stellar CLI is available, reports byte size, and checks the tracked per-schedule storage benchmark. When `CONTRACT_ID` is set it also runs `stellar contract invoke --cost` against cheap read entry points.

```bash
./scripts/contract-metrics.sh
```

With a deployed contract, it profiles argument-free entry points using
`stellar contract invoke --cost`. Stateful and authenticated methods require
deployment-specific inputs. Put those in a trusted shell file as calls to the
script's `profile` helper, then require complete entry-point coverage:

```bash
# /tmp/vestflow-cost-cases.sh
profile get_schedule --schedule-id 1
profile claimable --schedule-id 1
profile get_schedules_by_grantor --grantor G...
# Add the remaining stateful entry points with valid values for this deployment.

CONTRACT_ID=CC... SOURCE=my-key \
  COST_CASES_FILE=/tmp/vestflow-cost-cases.sh REQUIRE_ALL_COSTS=1 \
  ./scripts/contract-metrics.sh
```

The script reports every missing entry point and fails in strict mode, so a
cost report cannot accidentally claim complete coverage from a partial run.

### `upgrade-contract.sh`

Builds and optimizes the contract, uploads the Wasm, announces the hash through the contract's `announce_upgrade` entry point, and executes the upgrade after the 48-hour timelock.

```bash
CONTRACT_ID=CC... SOURCE=my-key ./scripts/upgrade-contract.sh

# Save the printed hash, wait for the timelock, then execute:
CONTRACT_ID=CC... SOURCE=my-key WASM_HASH=<hash> ACTION=execute ./scripts/upgrade-contract.sh
```

Use `NETWORK=mainnet` for Mainnet. The current authority must already be initialized on-chain with `initialize_upgrade_authority`, and `SOURCE` must be that authority.

### `update-deployment-registry.sh`

Records a contract deployment manually when needed.

```bash
VERSION=v0.1.0 NETWORK=testnet CONTRACT_ID=CC... ./scripts/update-deployment-registry.sh
```

### `integration-test.sh`

Runs a suite of integration tests against a deployed contract.

```bash
CONTRACT_ID=CC... SOURCE=my-key ./scripts/integration-test.sh
```

The test suite covers:
- `schedule_count` returns a number
- `create_schedule` with a funded key creates a schedule
- `claimable` on a fresh schedule returns 0 before `start_time`
