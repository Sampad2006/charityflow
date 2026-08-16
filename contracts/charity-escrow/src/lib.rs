//! # Charity Escrow
//!
//! Holds donated funds and disburses them to NGO wallets, but **only** when
//! the caller is an AI agent that is authorized by the
//! [`AgentRegistry`](agent_registry) contract.
//!
//! Authorization is enforced through a **cross-contract call**:
//! [`request_payout`](CharityEscrow::request_payout) invokes
//! `agent_registry::is_agent(agent)` and aborts with
//! [`EscrowError::Unauthorized`] if the caller is not an approved agent.
//!
//! Funds are held as an Stellar asset (XLM by default) tracked through the
//! native token interface (`token::Client`).

#![no_std]

/// Client types for the AgentRegistry contract, generated from its wasm spec
/// so that this crate does not link the registry contract's exported symbols
/// into the escrow wasm (which would collide with our own `get_admin`,
/// `is_initialized`, `initialize` exports).
mod agent_registry {
    soroban_sdk::contractimport!(file = "specs/agent_registry.wasm");
    pub use Client as AgentRegistryClient;
}

use soroban_sdk::{contract, contracterror, contractevent, contractimpl, contracttype, token, Address, Env, Symbol};

/// Storage keys for the escrow.
#[derive(Clone, Debug, Eq, PartialEq)]
#[contracttype]
pub enum DataKey {
    /// `Address` — administrative owner (can swap the registry).
    Admin,
    /// `Address` — the deployed `AgentRegistry` contract.
    Registry,
    /// `Address` — the asset contract whose balance backs the escrow.
    Token,
    /// `bool` — guards against double initialization.
    Initialized,
}

/// Escrow error codes.
#[derive(Clone, Copy, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[contracterror]
#[repr(u32)]
pub enum EscrowError {
    /// `initialize` has already been called.
    AlreadyInitialized = 0,
    /// The contract has not been initialized yet.
    NotInitialized = 1,
    /// Caller is not the contract admin.
    UnauthorizedAdmin = 2,
    /// The calling agent is not authorized by the registry.
    Unauthorized = 3,
    /// The escrow holds less than the requested payout amount.
    InsufficientFunds = 4,
    /// Amount must be strictly positive.
    ZeroAmount = 5,
}

/// Emitted when the escrow is initialized.
#[contractevent]
pub struct EscrowInitialized {
    #[topic]
    pub admin: Address,
}

/// Emitted when a donor contributes funds.
#[contractevent]
pub struct Deposit {
    #[topic]
    pub donor: Address,
    pub amount: i128,
}

/// Emitted when an authorized AI agent disburses aid.
#[contractevent]
pub struct Payout {
    #[topic]
    pub to: Address,
    #[topic]
    pub reason: Symbol,
    pub amount: i128,
}

/// Emitted when the admin re-points the escrow at a new registry.
#[contractevent]
pub struct RegistryUpdated {
    #[topic]
    pub registry: Address,
}

/// An escrow vault gated behind registry-authorized AI agents.
#[contract]
pub struct CharityEscrow;

#[contractimpl]
impl CharityEscrow {
    /// Initializes the escrow with an `admin`, the `registry` contract used
    /// for agent authorization, and the `token` contract that holds the funds.
    ///
    /// # Panics
    /// Panics with [`EscrowError::AlreadyInitialized`] if called twice.
    pub fn initialize(
        env: Env,
        admin: Address,
        registry: Address,
        token: Address,
    ) -> Result<(), EscrowError> {
        if env.storage().instance().has(&DataKey::Initialized) {
            return Err(EscrowError::AlreadyInitialized);
        }

        admin.require_auth();
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::Registry, &registry);
        env.storage().instance().set(&DataKey::Token, &token);
        env.storage().instance().set(&DataKey::Initialized, &true);
        EscrowInitialized { admin }.publish(&env);
        Ok(())
    }

    /// Accepts a `donor`'s contribution of `amount` tokens into the escrow.
    ///
    /// # Panics
    /// Panics with [`EscrowError::ZeroAmount`] if `amount <= 0`.
    pub fn deposit(env: Env, donor: Address, amount: i128) -> Result<(), EscrowError> {
        if amount <= 0 {
            return Err(EscrowError::ZeroAmount);
        }

        donor.require_auth();
        let token = Self::token_address(&env);
        token::Client::new(&env, &token).transfer(&donor, &env.current_contract_address(), &amount);

        Deposit {
            donor: donor.clone(),
            amount,
        }
        .publish(&env);
        Ok(())
    }

    /// Disburses `amount` to the `to` (NGO) wallet.
    ///
    /// Authorization:
    /// 1. The `agent` address must sign the invocation (`require_auth`).
    /// 2. A **cross-contract call** to `AgentRegistry::is_agent` must return
    ///    `true`.
    ///
    /// # Panics
    /// Panics with [`EscrowError::Unauthorized`] if the agent is not
    /// registered, [`EscrowError::InsufficientFunds`] if the escrow balance is
    /// too low, or [`EscrowError::ZeroAmount`] if `amount <= 0`.
    pub fn request_payout(
        env: Env,
        agent: Address,
        to: Address,
        amount: i128,
        reason: Symbol,
    ) -> Result<(), EscrowError> {
        Self::check_initialized(&env)?;

        if amount <= 0 {
            return Err(EscrowError::ZeroAmount);
        }

        agent.require_auth();

        // Inter-contract authorization check against the AgentRegistry.
        let registry = Self::registry_address(&env);
        let authorized = agent_registry::AgentRegistryClient::new(&env, &registry).is_agent(&agent);
        if !authorized {
            return Err(EscrowError::Unauthorized);
        }

        let balance = Self::escrow_balance(env.clone());
        if balance < amount {
            return Err(EscrowError::InsufficientFunds);
        }

        token::Client::new(&env, &Self::token_address(&env))
            .transfer(&env.current_contract_address(), &to, &amount);

        Payout {
            to: to.clone(),
            reason: reason.clone(),
            amount,
        }
        .publish(&env);
        Ok(())
    }

    /// Returns the token balance currently locked in the escrow.
    pub fn escrow_balance(env: Env) -> i128 {
        token::Client::new(&env, &Self::token_address(&env)).balance(&env.current_contract_address())
    }

    /// Re-points the escrow at a new registry. Only the `admin` may do this.
    ///
    /// # Panics
    /// Panics with [`EscrowError::UnauthorizedAdmin`] if `admin` is not the
    /// configured admin.
    pub fn set_registry(
        env: Env,
        admin: Address,
        registry: Address,
    ) -> Result<(), EscrowError> {
        Self::check_initialized(&env)?;
        Self::check_admin(&env, &admin)?;
        admin.require_auth();

        env.storage().instance().set(&DataKey::Registry, &registry);
        RegistryUpdated { registry }.publish(&env);
        Ok(())
    }

    /// Returns the configured admin address.
    pub fn get_admin(env: Env) -> Result<Address, EscrowError> {
        Self::check_initialized(&env)?;
        Ok(env.storage().instance().get(&DataKey::Admin).unwrap())
    }

    /// Returns the configured registry contract address.
    pub fn get_registry(env: Env) -> Result<Address, EscrowError> {
        Self::check_initialized(&env)?;
        Ok(Self::registry_address(&env))
    }

    /// Returns `true` when the escrow has been initialized.
    pub fn is_initialized(env: Env) -> bool {
        env.storage().instance().has(&DataKey::Initialized)
    }

    // ─────────────────────────── internal helpers ───────────────────────────

    fn token_address(env: &Env) -> Address {
        env.storage().instance().get(&DataKey::Token).unwrap()
    }

    fn registry_address(env: &Env) -> Address {
        env.storage().instance().get(&DataKey::Registry).unwrap()
    }

    fn check_initialized(env: &Env) -> Result<(), EscrowError> {
        if !env.storage().instance().has(&DataKey::Initialized) {
            return Err(EscrowError::NotInitialized);
        }
        Ok(())
    }

    fn check_admin(env: &Env, caller: &Address) -> Result<(), EscrowError> {
        let admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap();
        if admin != *caller {
            return Err(EscrowError::UnauthorizedAdmin);
        }
        Ok(())
    }
}

#[cfg(test)]
mod test {
    use super::*;
    use soroban_sdk::testutils::{Address as _, Events as _};
    use soroban_sdk::{token, Address, Env, Event, Symbol};

    struct Fixture {
        env: Env,
        admin: Address,
        agent: Address,
        rogue: Address,
        donor: Address,
        ngo: Address,
        registry: Address,
        escrow_id: Address,
        token: Address,
    }

    impl Fixture {
        fn client(&self) -> CharityEscrowClient {
            CharityEscrowClient::new(&self.env, &self.escrow_id)
        }
    }

    fn setup() -> Fixture {
        let env = Env::default();
        env.mock_all_auths();
        env.cost_estimate().budget().reset_unlimited();

        let admin = Address::generate(&env);
        let agent = Address::generate(&env);
        let rogue = Address::generate(&env);
        let donor = Address::generate(&env);
        let ngo = Address::generate(&env);

        // Deploy + initialize the registry, registering `agent`.
        let registry_id = env.register(agent_registry::WASM, ());
        let registry = agent_registry::AgentRegistryClient::new(&env, &registry_id);
        registry.initialize(&admin);
        registry.add_agent(&admin, &agent);
        assert!(registry.is_agent(&agent));

        // Deploy the escrow bound to the registry + a freshly deployed token.
        let token = env.register_stellar_asset_contract_v2(admin.clone()).address();
        let escrow_id = env.register(CharityEscrow, ());
        let escrow = CharityEscrowClient::new(&env, &escrow_id);
        escrow.initialize(&admin, &registry_id, &token);

        Fixture {
            env,
            admin,
            agent,
            rogue,
            donor,
            ngo,
            registry: registry_id,
            escrow_id,
            token,
        }
    }

    fn mint(f: &Fixture, to: &Address, amount: i128) {
        token::StellarAssetClient::new(&f.env, &f.token).mint(to, &amount);
    }

    fn token_balance(f: &Fixture, address: &Address) -> i128 {
        token::Client::new(&f.env, &f.token).balance(address)
    }

    #[test]
    fn test_initialize_and_state() {
        let f = setup();
        assert!(f.client().is_initialized());
        assert_eq!(f.client().get_admin(), f.admin);
        assert_eq!(f.client().get_registry(), f.registry);
        assert_eq!(f.client().escrow_balance(), 0);

        let result = f.client().try_initialize(&f.admin, &f.registry, &f.token);
        assert_eq!(result, Err(Ok(EscrowError::AlreadyInitialized)));
    }

    #[test]
    fn test_deposit_increases_escrow_balance() {
        let f = setup();
        mint(&f, &f.donor, 10_000_000);

        f.client().deposit(&f.donor, &2_000_000);
        assert_eq!(f.client().escrow_balance(), 2_000_000);
        assert_eq!(token_balance(&f, &f.donor), 8_000_000);
    }

    #[test]
    fn test_deposit_zero_amount_rejected() {
        let f = setup();
        mint(&f, &f.donor, 10_000_000);

        let result = f.client().try_deposit(&f.donor, &0);
        assert_eq!(result, Err(Ok(EscrowError::ZeroAmount)));

        let result = f.client().try_deposit(&f.donor, &(-5));
        assert_eq!(result, Err(Ok(EscrowError::ZeroAmount)));
    }

    #[test]
    fn test_authorized_agent_can_payout() {
        let f = setup();
        mint(&f, &f.donor, 10_000_000);
        f.client().deposit(&f.donor, &5_000_000);

        f.client()
            .request_payout(&f.agent, &f.ngo, &1_000_000, &Symbol::new(&f.env, "earthquake"));

        assert_eq!(f.client().escrow_balance(), 4_000_000);
        assert_eq!(token_balance(&f, &f.ngo), 1_000_000);
    }

    #[test]
    fn test_unauthorized_agent_cannot_payout() {
        let f = setup();
        mint(&f, &f.donor, 10_000_000);
        f.client().deposit(&f.donor, &5_000_000);

        let result = f.client().try_request_payout(
            &f.rogue,
            &f.ngo,
            &1_000_000,
            &Symbol::new(&f.env, "flood"),
        );
        assert_eq!(result, Err(Ok(EscrowError::Unauthorized)));

        // Nothing moved.
        assert_eq!(f.client().escrow_balance(), 5_000_000);
        assert_eq!(token_balance(&f, &f.ngo), 0);
    }

    #[test]
    fn test_payout_rejected_when_agent_removed_from_registry() {
        let f = setup();
        mint(&f, &f.donor, 10_000_000);
        f.client().deposit(&f.donor, &5_000_000);

        // Admin revokes the agent from the registry after the escrow is live.
        let registry_client = agent_registry::AgentRegistryClient::new(&f.env, &f.registry);
        registry_client.remove_agent(&f.admin, &f.agent);

        let result = f.client().try_request_payout(
            &f.agent,
            &f.ngo,
            &1_000_000,
            &Symbol::new(&f.env, "drought"),
        );
        assert_eq!(result, Err(Ok(EscrowError::Unauthorized)));
    }

    #[test]
    fn test_payout_rejected_when_insufficient_funds() {
        let f = setup();
        mint(&f, &f.donor, 100_000);
        f.client().deposit(&f.donor, &100_000);

        let result = f.client().try_request_payout(
            &f.agent,
            &f.ngo,
            &1_000_000,
            &Symbol::new(&f.env, "cyclone"),
        );
        assert_eq!(result, Err(Ok(EscrowError::InsufficientFunds)));
        assert_eq!(f.client().escrow_balance(), 100_000);
    }

    #[test]
    fn test_set_registry_requires_admin() {
        let f = setup();
        let other_registry = f.env.register(agent_registry::WASM, ());

        // Rogue cannot change the registry.
        let result = f.client().try_set_registry(&f.rogue, &other_registry);
        assert_eq!(result, Err(Ok(EscrowError::UnauthorizedAdmin)));

        // Admin can.
        f.client().set_registry(&f.admin, &other_registry);
        assert_eq!(f.client().get_registry(), other_registry);
    }

    #[test]
    fn test_deposit_and_payout_emit_events() {
        let f = setup();
        mint(&f, &f.donor, 10_000_000);

        // env.events().all() returns events from the *last* invocation only.
        f.client().deposit(&f.donor, &3_000_000);
        let events = f.env.events().all().filter_by_contract(&f.escrow_id);
        assert_eq!(
            events,
            [Deposit {
                donor: f.donor.clone(),
                amount: 3_000_000
            }
            .to_xdr(&f.env, &f.escrow_id)]
        );

        f.client()
            .request_payout(&f.agent, &f.ngo, &1_000_000, &Symbol::new(&f.env, "quake"));
        let events = f.env.events().all().filter_by_contract(&f.escrow_id);
        assert_eq!(
            events,
            [Payout {
                to: f.ngo.clone(),
                reason: Symbol::new(&f.env, "quake"),
                amount: 1_000_000
            }
            .to_xdr(&f.env, &f.escrow_id)]
        );
    }

    #[test]
    fn test_uninitialized_escrow_rejects_payout() {
        let env = Env::default();
        env.mock_all_auths();
        let agent = Address::generate(&env);
        let ngo = Address::generate(&env);
        let escrow_id = env.register(CharityEscrow, ());
        let escrow = CharityEscrowClient::new(&env, &escrow_id);

        let result = escrow.try_request_payout(
            &agent,
            &ngo,
            &100,
            &Symbol::new(&env, "quake"),
        );
        assert_eq!(result, Err(Ok(EscrowError::NotInitialized)));
    }
}
