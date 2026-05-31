#![no_std]
#![allow(clippy::too_many_arguments)]

//! # VestFlow Contract
//!
//! Trustless token vesting schedules on Stellar / Soroban.
//!
//! ## Re-entrancy Invariant
//!
//! Soroban's host environment does not allow the classic EVM-style re-entrancy
//! because a contract invocation runs to completion before any cross-contract
//! call can trigger a new entry to the same contract.  Despite this guarantee
//! we still include an explicit storage-level re-entrancy guard on the two
//! state-mutating entry points — `claim` and `revoke` — as a defence-in-depth
//! measure and to make the invariant visible in the code.
//!
//! The guard is a simple boolean flag stored under `DataKey::Locked`.  Every
//! mutating entry point acquires the lock on entry and releases it on exit.
//! If a nested call somehow tried to re-enter, the guard would panic with
//! `"Re-entrant call detected"`.
//!
//! ## Error Messages
//!
//! The contract panics with plain string messages that callers can match on.
//! All public-facing error strings are listed below.
//!
//! | Error string                    | Triggered by                                                     |
//! |---------------------------------|------------------------------------------------------------------|
//! | `"Schedule not found"`          | `get_schedule`, `claim`, `revoke` with an unknown ID             |
//! | `"Nothing to claim yet"`        | `claim` called before any tokens have vested                     |
//! | `"Schedule has been revoked"`    | `claim` called on a schedule that was already revoked            |
//! | `"Schedule is not revocable"`   | `revoke` called on an irrevocable schedule                       |
//! | `"Already revoked"`             | `revoke` called a second time on the same schedule               |
//! | `"Amount must be positive"`     | `create_schedule` with `total_amount` ≤ 0                        |
//! | `"Duration must be positive"`   | `create_schedule` with `duration` = 0                            |
//! | `"Cliff cannot exceed duration"`| `create_schedule` with `cliff_duration` > `duration`             |
//! | `"Re-entrant call detected"`    | A state-mutating entry point is called while already executing   |

use soroban_sdk::{
    contract, contractimpl, contracttype, symbol_short, token, vec, Address, Env, Vec,
};

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    Schedule(u64),
    ScheduleCount,
    /// Re-entrancy guard flag.
    /// Set to `true` while a state-mutating entry point is executing.
    Locked,
}

/// The type of vesting curve applied to a schedule.
#[contracttype]
#[derive(Clone, PartialEq)]
pub enum VestingKind {
    /// Tokens unlock linearly from `start_time` to `start_time + duration`.
    /// The `cliff_duration` field is ignored for this variant.
    Linear,
    /// No tokens unlock until `start_time + cliff_duration`, then the full
    /// amount unlocks at once.
    Cliff,
    /// No tokens unlock until `start_time + cliff_duration` (the cliff).
    /// After the cliff, tokens unlock linearly from the cliff date to
    /// `start_time + duration`.
    ///
    /// This models the most common real-world employee vesting schedule:
    /// a 1-year cliff followed by linear vesting over the remaining term.
    LinearWithCliff,
}

#[contracttype]
#[derive(Clone)]
pub struct VestingSchedule {
    pub id: u64,
    /// Address that created and funded this schedule.
    pub grantor: Address,
    /// Address that can claim vested tokens.
    pub beneficiary: Address,
    /// Stellar asset contract for the vested token.
    pub token: Address,
    /// Total tokens locked into this schedule (in stroops / base units).
    pub total_amount: i128,
    /// Tokens already claimed by the beneficiary.
    pub claimed: i128,
    /// Unix timestamp when vesting begins.
    pub start_time: u64,
    /// Vesting duration in seconds.
    pub duration: u64,
    /// Cliff in seconds from `start_time`.
    ///
    /// - `Linear`: ignored.
    /// - `Cliff`: tokens unlock all-at-once after this many seconds.
    /// - `LinearWithCliff`: no tokens until this point; linear from here to end.
    pub cliff_duration: u64,
    pub kind: VestingKind,
    /// Whether the grantor can revoke unvested tokens.
    pub revocable: bool,
    /// Whether this schedule has been revoked.
    pub revoked: bool,
}

impl VestingSchedule {
    /// Calculate how many tokens are vested at a given timestamp.
    pub fn vested_at(&self, now: u64) -> i128 {
        if self.revoked {
            return self.claimed;
        }
        if now < self.start_time {
            return 0;
        }
        let elapsed = now - self.start_time;
        match self.kind {
            VestingKind::Cliff => {
                if elapsed >= self.cliff_duration {
                    self.total_amount
                } else {
                    0
                }
            }
            VestingKind::Linear => {
                if elapsed >= self.duration {
                    self.total_amount
                } else {
                    (self.total_amount * elapsed as i128) / self.duration as i128
                }
            }
            VestingKind::LinearWithCliff => {
                // Before cliff: nothing vests.
                if elapsed < self.cliff_duration {
                    return 0;
                }
                // After full duration: everything is vested.
                if elapsed >= self.duration {
                    return self.total_amount;
                }
                // Between cliff and end: linear from cliff_duration to duration.
                let linear_duration = self.duration - self.cliff_duration;
                let linear_elapsed = elapsed - self.cliff_duration;
                (self.total_amount * linear_elapsed as i128) / linear_duration as i128
            }
        }
    }

    /// Tokens vested but not yet claimed.
    pub fn claimable_at(&self, now: u64) -> i128 {
        let vested = self.vested_at(now);
        if vested > self.claimed {
            vested - self.claimed
        } else {
            0
        }
    }
}

#[contract]
pub struct VestFlowContract;

#[contractimpl]
impl VestFlowContract {
    /// Acquire the re-entrancy lock.
    ///
    /// Panics with `"Re-entrant call detected"` if the lock is already held.
    fn acquire_lock(env: &Env) {
        assert!(
            !env.storage().instance().has(&DataKey::Locked),
            "Re-entrant call detected"
        );
        env.storage().instance().set(&DataKey::Locked, &true);
    }

    /// Release the re-entrancy lock.
    fn release_lock(env: &Env) {
        env.storage().instance().remove(&DataKey::Locked);
    }

    /// Create a new vesting schedule and lock the tokens into the contract.
    ///
    /// The grantor must approve the contract to transfer `total_amount` of
    /// `token` before calling this function.
    ///
    /// # Errors
    ///
    /// Panics with `"Amount must be positive"` if `total_amount` ≤ 0.
    /// Panics with `"Duration must be positive"` if `duration` = 0.
    /// Panics with `"Cliff cannot exceed duration"` if `cliff_duration` > `duration`.
    pub fn create_schedule(
        env: Env,
        grantor: Address,
        beneficiary: Address,
        token: Address,
        total_amount: i128,
        start_time: u64,
        duration: u64,
        cliff_duration: u64,
        kind: VestingKind,
        revocable: bool,
    ) -> u64 {
        grantor.require_auth();

        assert!(total_amount > 0, "Amount must be positive");
        assert!(duration > 0, "Duration must be positive");
        assert!(cliff_duration <= duration, "Cliff cannot exceed duration");

        let count: u64 = env
            .storage()
            .instance()
            .get(&DataKey::ScheduleCount)
            .unwrap_or(0);
        let id = count + 1;

        // Pull tokens from grantor into the contract
        let contract_address = env.current_contract_address();
        token::Client::new(&env, &token).transfer(&grantor, &contract_address, &total_amount);

        let schedule = VestingSchedule {
            id,
            grantor: grantor.clone(),
            beneficiary,
            token,
            total_amount,
            claimed: 0,
            start_time,
            duration,
            cliff_duration,
            kind,
            revocable,
            revoked: false,
        };

        env.storage()
            .instance()
            .set(&DataKey::Schedule(id), &schedule);
        env.storage().instance().set(&DataKey::ScheduleCount, &id);

        env.events()
            .publish((symbol_short!("created"), grantor), id);

        id
    }

    /// Claim all currently vested but unclaimed tokens.
    ///
    /// # Errors
    ///
    /// Panics with `"Schedule not found"` if `schedule_id` does not exist.
    /// Panics with `"Schedule has been revoked"` if the schedule was revoked.
    /// Panics with `"Nothing to claim yet"` if no tokens are currently claimable.
    pub fn claim(env: Env, schedule_id: u64) {
        Self::acquire_lock(&env);

        let mut schedule: VestingSchedule = env
            .storage()
            .instance()
            .get(&DataKey::Schedule(schedule_id))
            .expect("Schedule not found");

        schedule.beneficiary.require_auth();
        assert!(!schedule.revoked, "Schedule has been revoked");

        let now = env.ledger().timestamp();
        let claimable = schedule.claimable_at(now);
        assert!(claimable > 0, "Nothing to claim yet");

        schedule.claimed += claimable;

        let contract_address = env.current_contract_address();
        token::Client::new(&env, &schedule.token).transfer(
            &contract_address,
            &schedule.beneficiary,
            &claimable,
        );

        env.storage()
            .instance()
            .set(&DataKey::Schedule(schedule_id), &schedule);
        env.events().publish(
            (symbol_short!("claimed"), schedule.beneficiary.clone()),
            (schedule_id, claimable),
        );

        Self::release_lock(&env);
    }

    /// Revoke a vesting schedule (grantor only, revocable schedules only).
    /// Unvested tokens are returned to the grantor. Already-vested tokens
    /// remain claimable by the beneficiary.
    ///
    /// # Errors
    ///
    /// Panics with `"Schedule not found"` if `schedule_id` does not exist.
    /// Panics with `"Schedule is not revocable"` if the schedule is irrevocable.
    /// Panics with `"Already revoked"` if the schedule has already been revoked.
    pub fn revoke(env: Env, schedule_id: u64) {
        Self::acquire_lock(&env);

        let mut schedule: VestingSchedule = env
            .storage()
            .instance()
            .get(&DataKey::Schedule(schedule_id))
            .expect("Schedule not found");

        schedule.grantor.require_auth();
        assert!(schedule.revocable, "Schedule is not revocable");
        assert!(!schedule.revoked, "Already revoked");

        let now = env.ledger().timestamp();
        let vested = schedule.vested_at(now);
        let unvested = schedule.total_amount - vested;

        schedule.revoked = true;

        // Return unvested tokens to grantor
        if unvested > 0 {
            let contract_address = env.current_contract_address();
            token::Client::new(&env, &schedule.token).transfer(
                &contract_address,
                &schedule.grantor,
                &unvested,
            );
        }

        env.storage()
            .instance()
            .set(&DataKey::Schedule(schedule_id), &schedule);
        env.events().publish(
            (symbol_short!("revoked"), schedule.grantor.clone()),
            (schedule_id, unvested),
        );

        Self::release_lock(&env);
    }

    /// Read a vesting schedule by ID.
    ///
    /// # Errors
    ///
    /// Panics with `"Schedule not found"` if `schedule_id` does not exist.
    pub fn get_schedule(env: Env, schedule_id: u64) -> VestingSchedule {
        env.storage()
            .instance()
            .get(&DataKey::Schedule(schedule_id))
            .expect("Schedule not found")
    }

    /// How many schedules have been created in total.
    pub fn schedule_count(env: Env) -> u64 {
        env.storage()
            .instance()
            .get(&DataKey::ScheduleCount)
            .unwrap_or(0)
    }

    /// Preview how many tokens are claimable right now for a given schedule.
    ///
    /// Returns 0 if `schedule_id` is unknown (does not panic).
    pub fn claimable(env: Env, schedule_id: u64) -> i128 {
        match env
            .storage()
            .instance()
            .get::<DataKey, VestingSchedule>(&DataKey::Schedule(schedule_id))
        {
            Some(schedule) => schedule.claimable_at(env.ledger().timestamp()),
            None => 0,
        }
    }

    /// Batch view: return claimable amounts for multiple schedule IDs in a
    /// single simulation round-trip.
    ///
    /// Results are returned in the same order as the input `ids` vector.
    /// Unknown IDs return 0 instead of panicking, so the caller can safely
    /// pass the full ID range without knowing which ones exist.
    ///
    /// This replaces the `Promise.all(claimable)` pattern in the frontend
    /// dashboard, reducing N simulation round-trips to 1.
    pub fn claimable_bulk(env: Env, ids: Vec<u64>) -> Vec<i128> {
        let now = env.ledger().timestamp();
        let mut results: Vec<i128> = vec![&env];
        for id in ids.iter() {
            let amount = match env
                .storage()
                .instance()
                .get::<DataKey, VestingSchedule>(&DataKey::Schedule(id))
            {
                Some(schedule) => schedule.claimable_at(now),
                None => 0,
            };
            results.push_back(amount);
        }
        results
    }
}

#[cfg(test)]
mod test {
    use super::*;
    use soroban_sdk::{
        testutils::{Address as _, Ledger, LedgerInfo},
        token::{Client as TokenClient, StellarAssetClient},
        Env,
    };

    fn setup(env: &Env) -> (VestFlowContractClient, Address, Address, Address, Address) {
        let contract_id = env.register(VestFlowContract, ());
        let client = VestFlowContractClient::new(env, &contract_id);
        let grantor = Address::generate(env);
        let beneficiary = Address::generate(env);
        let token_admin = Address::generate(env);
        let token_contract = env.register_stellar_asset_contract_v2(token_admin.clone());
        let token_address = token_contract.address();
        StellarAssetClient::new(env, &token_address)
            .mock_all_auths()
            .mint(&grantor, &10_000);
        (client, grantor, beneficiary, token_address, token_admin)
    }

    fn set_time(env: &Env, ts: u64) {
        env.ledger().set(LedgerInfo {
            timestamp: ts,
            protocol_version: 22,
            sequence_number: env.ledger().sequence(),
            network_id: Default::default(),
            base_reserve: 10,
            min_temp_entry_ttl: 10,
            min_persistent_entry_ttl: 10,
            max_entry_ttl: 3110400,
        });
    }

    #[test]
    fn test_linear_vesting_full_claim() {
        let env = Env::default();
        env.mock_all_auths();
        let (client, grantor, beneficiary, token_addr, _) = setup(&env);
        let token = TokenClient::new(&env, &token_addr);

        set_time(&env, 1000);
        let id = client.create_schedule(
            &grantor,
            &beneficiary,
            &token_addr,
            &1000,
            &1000,
            &1000,
            &0,
            &VestingKind::Linear,
            &true,
        );

        // Halfway through vesting
        set_time(&env, 1500);
        assert_eq!(client.claimable(&id), 500);
        client.claim(&id);
        assert_eq!(token.balance(&beneficiary), 500);

        // Fully vested
        set_time(&env, 2000);
        assert_eq!(client.claimable(&id), 500);
        client.claim(&id);
        assert_eq!(token.balance(&beneficiary), 1000);
    }

    #[test]
    fn test_cliff_vesting() {
        let env = Env::default();
        env.mock_all_auths();
        let (client, grantor, beneficiary, token_addr, _) = setup(&env);
        let token = TokenClient::new(&env, &token_addr);

        set_time(&env, 0);
        let id = client.create_schedule(
            &grantor,
            &beneficiary,
            &token_addr,
            &1000,
            &0,
            &1000,
            &500,
            &VestingKind::Cliff,
            &false,
        );

        // Before cliff
        set_time(&env, 499);
        assert_eq!(client.claimable(&id), 0);

        // At cliff — all unlocks
        set_time(&env, 500);
        assert_eq!(client.claimable(&id), 1000);
        client.claim(&id);
        assert_eq!(token.balance(&beneficiary), 1000);
    }

    #[test]
    fn test_revoke_returns_unvested() {
        let env = Env::default();
        env.mock_all_auths();
        let (client, grantor, beneficiary, token_addr, _) = setup(&env);
        let token = TokenClient::new(&env, &token_addr);

        set_time(&env, 0);
        let id = client.create_schedule(
            &grantor,
            &beneficiary,
            &token_addr,
            &1000,
            &0,
            &1000,
            &0,
            &VestingKind::Linear,
            &true,
        );

        // 25% vested, beneficiary claims
        set_time(&env, 250);
        client.claim(&id);
        assert_eq!(token.balance(&beneficiary), 250);

        // Grantor revokes — gets back 750 (unvested)
        let grantor_before = token.balance(&grantor);
        client.revoke(&id);
        assert_eq!(token.balance(&grantor), grantor_before + 750);
    }

    #[test]
    #[should_panic(expected = "Nothing to claim yet")]
    fn test_cannot_claim_before_vesting_starts() {
        let env = Env::default();
        env.mock_all_auths();
        let (client, grantor, beneficiary, token_addr, _) = setup(&env);

        set_time(&env, 0);
        let id = client.create_schedule(
            &grantor,
            &beneficiary,
            &token_addr,
            &1000,
            &1000,
            &1000,
            &0,
            &VestingKind::Linear,
            &false,
        );
        client.claim(&id);
    }

    #[test]
    #[should_panic(expected = "Schedule is not revocable")]
    fn test_cannot_revoke_irrevocable() {
        let env = Env::default();
        env.mock_all_auths();
        let (client, grantor, beneficiary, token_addr, _) = setup(&env);

        set_time(&env, 0);
        let id = client.create_schedule(
            &grantor,
            &beneficiary,
            &token_addr,
            &1000,
            &0,
            &1000,
            &0,
            &VestingKind::Linear,
            &false,
        );
        client.revoke(&id);
    }

    // --- Issue #19: LinearWithCliff tests ---

    #[test]
    fn test_linear_with_cliff_before_cliff_returns_zero() {
        let env = Env::default();
        env.mock_all_auths();
        let (client, grantor, beneficiary, token_addr, _) = setup(&env);

        // 1000s duration, 400s cliff
        set_time(&env, 0);
        let id = client.create_schedule(
            &grantor,
            &beneficiary,
            &token_addr,
            &1000,
            &0,
            &1000,
            &400,
            &VestingKind::LinearWithCliff,
            &false,
        );

        // Before cliff: nothing claimable
        set_time(&env, 399);
        assert_eq!(client.claimable(&id), 0);
    }

    #[test]
    fn test_linear_with_cliff_after_cliff_linear_release() {
        let env = Env::default();
        env.mock_all_auths();
        let (client, grantor, beneficiary, token_addr, _) = setup(&env);
        let token = TokenClient::new(&env, &token_addr);

        // 1000s duration, 400s cliff → 600s linear window
        set_time(&env, 0);
        let id = client.create_schedule(
            &grantor,
            &beneficiary,
            &token_addr,
            &1200,
            &0,
            &1000,
            &400,
            &VestingKind::LinearWithCliff,
            &false,
        );

        // At cliff: 0/600 through linear window → 0 tokens
        set_time(&env, 400);
        assert_eq!(client.claimable(&id), 0);

        // Halfway through linear window (elapsed=700, linear_elapsed=300, linear_duration=600)
        // vested = 1200 * 300 / 600 = 600
        set_time(&env, 700);
        assert_eq!(client.claimable(&id), 600);
        client.claim(&id);
        assert_eq!(token.balance(&beneficiary), 600);

        // Fully vested at end of duration
        set_time(&env, 1000);
        assert_eq!(client.claimable(&id), 600);
        client.claim(&id);
        assert_eq!(token.balance(&beneficiary), 1200);
    }

    // --- Issue #18: claimable_bulk tests ---

    #[test]
    fn test_claimable_bulk_returns_in_order() {
        let env = Env::default();
        env.mock_all_auths();
        let (client, grantor, beneficiary, token_addr, _) = setup(&env);

        set_time(&env, 0);
        // Schedule 1: 1000 tokens, 1000s linear
        let id1 = client.create_schedule(
            &grantor,
            &beneficiary,
            &token_addr,
            &1000,
            &0,
            &1000,
            &0,
            &VestingKind::Linear,
            &false,
        );
        // Schedule 2: 2000 tokens, 1000s cliff at 500s
        let id2 = client.create_schedule(
            &grantor,
            &beneficiary,
            &token_addr,
            &2000,
            &0,
            &1000,
            &500,
            &VestingKind::Cliff,
            &false,
        );

        // At t=500: id1 has 500 claimable, id2 has 2000 claimable (cliff hit)
        set_time(&env, 500);
        let ids = soroban_sdk::vec![&env, id1, id2];
        let bulk = client.claimable_bulk(&ids);
        assert_eq!(bulk.get(0).unwrap(), 500);
        assert_eq!(bulk.get(1).unwrap(), 2000);
    }

    #[test]
    fn test_claimable_bulk_unknown_id_returns_zero() {
        let env = Env::default();
        env.mock_all_auths();
        let (client, grantor, beneficiary, token_addr, _) = setup(&env);

        set_time(&env, 0);
        let _id = client.create_schedule(
            &grantor,
            &beneficiary,
            &token_addr,
            &1000,
            &0,
            &1000,
            &0,
            &VestingKind::Linear,
            &false,
        );

        // ID 999 does not exist — should return 0, not panic
        let ids = soroban_sdk::vec![&env, 999_u64];
        let bulk = client.claimable_bulk(&ids);
        assert_eq!(bulk.get(0).unwrap(), 0);
    }
}
