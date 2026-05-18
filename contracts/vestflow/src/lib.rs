#![no_std]

use soroban_sdk::{
    contract, contractimpl, contracttype, symbol_short, token, Address, Env, String,
};

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    Schedule(u64),
    ScheduleCount,
}

/// The type of vesting curve applied to a schedule.
#[contracttype]
#[derive(Clone, PartialEq)]
pub enum VestingKind {
    /// Tokens unlock linearly from start_time to start_time + duration.
    Linear,
    /// No tokens unlock until cliff_time, then all unlock at once.
    Cliff,
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
    /// Cliff in seconds from start_time (only used for Cliff kind).
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
        }
    }

    /// Tokens vested but not yet claimed.
    pub fn claimable_at(&self, now: u64) -> i128 {
        let vested = self.vested_at(now);
        if vested > self.claimed { vested - self.claimed } else { 0 }
    }
}

#[contract]
pub struct VestFlowContract;

#[contractimpl]
impl VestFlowContract {
    /// Create a new vesting schedule and lock the tokens into the contract.
    ///
    /// The grantor must approve the contract to transfer `total_amount` of
    /// `token` before calling this function.
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
        assert!(
            cliff_duration <= duration,
            "Cliff cannot exceed duration"
        );

        let count: u64 = env
            .storage()
            .instance()
            .get(&DataKey::ScheduleCount)
            .unwrap_or(0);
        let id = count + 1;

        // Pull tokens from grantor into the contract
        let contract_address = env.current_contract_address();
        token::Client::new(&env, &token).transfer(
            &grantor,
            &contract_address,
            &total_amount,
        );

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

        env.storage().instance().set(&DataKey::Schedule(id), &schedule);
        env.storage().instance().set(&DataKey::ScheduleCount, &id);

        env.events().publish((symbol_short!("created"), grantor), id);

        id
    }

    /// Claim all currently vested but unclaimed tokens.
    pub fn claim(env: Env, schedule_id: u64) {
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

        env.storage().instance().set(&DataKey::Schedule(schedule_id), &schedule);
        env.events().publish(
            (symbol_short!("claimed"), schedule.beneficiary.clone()),
            (schedule_id, claimable),
        );
    }

    /// Revoke a vesting schedule (grantor only, revocable schedules only).
    /// Unvested tokens are returned to the grantor. Already-vested tokens
    /// remain claimable by the beneficiary.
    pub fn revoke(env: Env, schedule_id: u64) {
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

        env.storage().instance().set(&DataKey::Schedule(schedule_id), &schedule);
        env.events().publish(
            (symbol_short!("revoked"), schedule.grantor.clone()),
            (schedule_id, unvested),
        );
    }

    /// Read a vesting schedule by ID.
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
    pub fn claimable(env: Env, schedule_id: u64) -> i128 {
        let schedule: VestingSchedule = env
            .storage()
            .instance()
            .get(&DataKey::Schedule(schedule_id))
            .expect("Schedule not found");
        schedule.claimable_at(env.ledger().timestamp())
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
            &grantor, &beneficiary, &token_addr,
            &1000, &1000, &1000, &0, &VestingKind::Linear, &true,
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
            &grantor, &beneficiary, &token_addr,
            &1000, &0, &1000, &500, &VestingKind::Cliff, &false,
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
            &grantor, &beneficiary, &token_addr,
            &1000, &0, &1000, &0, &VestingKind::Linear, &true,
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
            &grantor, &beneficiary, &token_addr,
            &1000, &1000, &1000, &0, &VestingKind::Linear, &false,
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
            &grantor, &beneficiary, &token_addr,
            &1000, &0, &1000, &0, &VestingKind::Linear, &false,
        );
        client.revoke(&id);
    }
}
