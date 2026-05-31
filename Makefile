# =============================================================================
#  VestFlow — Hardhat-style task runner
#  Targets: deploy, create-schedule, claim, revoke
#
#  Environment variables (with defaults):
#    NETWORK      = testnet | mainnet   (default: testnet)
#    RPC_URL      = Soroban RPC endpoint
#    SOURCE       = Stellar CLI key identity / seed
#    CONTRACT_ID  = Deployed contract ID
# =============================================================================

SHELL := /usr/bin/env bash
.DEFAULT_GOAL := help

# ── Config (overridable via env) ─────────────────────────────────────────────
NETWORK       ?= testnet
RPC_URL       ?= https://soroban-testnet.stellar.org
SOURCE        ?= $(or $(STELLAR_ACCOUNT),admin)
CONTRACT_ID   ?= $(NEXT_PUBLIC_CONTRACT_ID)

ifeq ($(NETWORK),mainnet)
  NETWORK_PASSPHRASE := "Public Global Stellar Network ; September 2015"
else
  NETWORK_PASSPHRASE := "Test SDF Network ; September 2015"
endif

WASM_PATH     := contracts/target/wasm32v1-none/release/vestflow.wasm

# ── Help ─────────────────────────────────────────────────────────────────────
help:
	@echo "Usage:  make <target> [NETWORK=mainnet] [CONTRACT_ID=...]"
	@echo ""
	@echo "Targets:"
	@echo "  deploy            Build WASM and deploy the VestFlow contract"
	@echo "  create-schedule   Create a new vesting schedule"
	@echo "  claim             Claim vested tokens for a schedule"
	@echo "  revoke            Revoke a vesting schedule"
	@echo ""
	@echo "Variables:"
	@echo "  NETWORK       Network (testnet/mainnet, default: testnet)"
	@echo "  RPC_URL       Soroban RPC URL"
	@echo "  SOURCE        Stellar CLI key identity"
	@echo "  CONTRACT_ID   Deployed contract ID"
	@echo ""
	@echo "Examples:"
	@echo "  make deploy"
	@echo "  make create-schedule NETWORK=mainnet CONTRACT_ID=CC..."
	@echo "  make claim CONTRACT_ID=CC... SCHEDULE_ID=1"

# ── Build ────────────────────────────────────────────────────────────────────
.PHONY: build
build:
	cargo build --target wasm32v1-none --release --manifest-path contracts/Cargo.toml

# ── Deploy ───────────────────────────────────────────────────────────────────
.PHONY: deploy
deploy: build
	stellar contract deploy \
		--wasm $(WASM_PATH) \
		--source $(SOURCE) \
		--network $(NETWORK) \
		--rpc-url $(RPC_URL) \
		--network-passphrase $(NETWORK_PASSPHRASE)

# ── Create Schedule ──────────────────────────────────────────────────────────
.PHONY: create-schedule
create-schedule:
	stellar contract invoke \
		--id $(CONTRACT_ID) \
		--source $(SOURCE) \
		--network $(NETWORK) \
		--rpc-url $(RPC_URL) \
		--network-passphrase $(NETWORK_PASSPHRASE) \
		-- \
		create_schedule \
		--grantor $(GRANTOR) \
		--beneficiary $(BENEFICIARY) \
		--token $(TOKEN) \
		--total-amount $(TOTAL_AMOUNT) \
		--start-time $(START_TIME) \
		--duration $(DURATION) \
		--cliff-duration $(CLIFF_DURATION) \
		--kind $(KIND) \
		--revocable $(REVOCABLE)

# ── Claim ────────────────────────────────────────────────────────────────────
.PHONY: claim
claim:
	stellar contract invoke \
		--id $(CONTRACT_ID) \
		--source $(SOURCE) \
		--network $(NETWORK) \
		--rpc-url $(RPC_URL) \
		--network-passphrase $(NETWORK_PASSPHRASE) \
		-- \
		claim \
		--schedule-id $(SCHEDULE_ID)

# ── Revoke ───────────────────────────────────────────────────────────────────
.PHONY: revoke
revoke:
	stellar contract invoke \
		--id $(CONTRACT_ID) \
		--source $(SOURCE) \
		--network $(NETWORK) \
		--rpc-url $(RPC_URL) \
		--network-passphrase $(NETWORK_PASSPHRASE) \
		-- \
		revoke \
		--schedule-id $(SCHEDULE_ID)
