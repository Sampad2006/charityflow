//! # Agent Registry
//!
//! Stores the set of public keys that are allowed to trigger aid disbursals
//! from the [`charity_escrow`] contract.
//!
//! Only the `admin` configured at [`initialize`](AgentRegistry::initialize)
//! time may add or remove agents. The registry exposes
//! [`is_agent`](AgentRegistry::is_agent) as a read-only view that the
//! `CharityEscrow` contract queries through a **cross-contract call** before
//! authorizing any payout.

#![no_std]

use soroban_sdk::{
    contract, contracterror, contractevent, contractimpl, contracttype, Address, Env, Vec,
};

/// Storage keys for the registry.
#[derive(Clone, Debug, Eq, PartialEq)]
#[contracttype]
pub enum DataKey {
    /// `Address` — the account allowed to manage agents.
    Admin,
    /// `Vec<Address>` — the list of approved AI agent public keys.
    Agents,
    /// `bool` — guards against double initialization.
    Initialized,
}

/// Registry error codes.
#[derive(Clone, Copy, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[contracterror]
#[repr(u32)]
pub enum RegistryError {
    /// `initialize` has already been called.
    AlreadyInitialized = 0,
    /// The contract has not been initialized yet.
    NotInitialized = 1,
    /// Caller is not the admin.
    Unauthorized = 2,
    /// Attempted to add an agent that is already registered.
    AgentAlreadyRegistered = 3,
    /// Attempted to remove an agent that is not registered.
    AgentNotFound = 4,
}

/// Emitted when the registry is initialized.
#[contractevent]
pub struct RegistryInitialized {
    #[topic]
    pub admin: Address,
}

/// Emitted when an agent is approved.
#[contractevent]
pub struct AgentAdded {
    #[topic]
    pub agent: Address,
}

/// Emitted when an agent is revoked.
#[contractevent]
pub struct AgentRemoved {
    #[topic]
    pub agent: Address,
}

/// A registry of authorized AI agents.
#[contract]
pub struct AgentRegistry;

#[contractimpl]
impl AgentRegistry {
    /// Initializes the contract with the given `admin`.
    ///
    /// # Panics
    /// Panics with [`RegistryError::AlreadyInitialized`] if called twice.
    pub fn initialize(env: Env, admin: Address) -> Result<(), RegistryError> {
        if env.storage().instance().has(&DataKey::Initialized) {
            return Err(RegistryError::AlreadyInitialized);
        }

        admin.require_auth();
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::Agents, &Vec::<Address>::new(&env));
        env.storage().instance().set(&DataKey::Initialized, &true);
        RegistryInitialized {
            admin: admin.clone(),
        }
        .publish(&env);
        Ok(())
    }

    /// Adds an `agent` to the registry. Only callable by the `admin`.
    ///
    /// # Panics
    /// Panics with [`RegistryError::Unauthorized`] if `admin` is not the
    /// configured admin, or [`RegistryError::AgentAlreadyRegistered`] if the
    /// agent is already present.
    pub fn add_agent(env: Env, admin: Address, agent: Address) -> Result<(), RegistryError> {
        Self::check_initialized(&env)?;
        Self::check_admin(&env, &admin)?;
        admin.require_auth();

        let mut agents: Vec<Address> = env
            .storage()
            .instance()
            .get(&DataKey::Agents)
            .unwrap_or(Vec::new(&env));

        if Self::contains(&agents, &agent) {
            return Err(RegistryError::AgentAlreadyRegistered);
        }

        agents.push_back(agent.clone());
        env.storage().instance().set(&DataKey::Agents, &agents);
        AgentAdded { agent }.publish(&env);
        Ok(())
    }

    /// Removes an `agent` from the registry. Only callable by the `admin`.
    ///
    /// # Panics
    /// Panics with [`RegistryError::Unauthorized`] if `admin` is not the
    /// configured admin, or [`RegistryError::AgentNotFound`] if the agent is
    /// not registered.
    pub fn remove_agent(env: Env, admin: Address, agent: Address) -> Result<(), RegistryError> {
        Self::check_initialized(&env)?;
        Self::check_admin(&env, &admin)?;
        admin.require_auth();

        let agents: Vec<Address> = env
            .storage()
            .instance()
            .get(&DataKey::Agents)
            .unwrap_or(Vec::new(&env));

        if !Self::contains(&agents, &agent) {
            return Err(RegistryError::AgentNotFound);
        }

        let mut pruned: Vec<Address> = Vec::new(&env);
        let mut i: u32 = 0;
        while i < agents.len() {
            let candidate = agents.get(i).unwrap();
            if candidate != agent {
                pruned.push_back(candidate);
            }
            i += 1;
        }

        env.storage().instance().set(&DataKey::Agents, &pruned);
        AgentRemoved { agent }.publish(&env);
        Ok(())
    }

    /// Returns `true` if `agent` is an approved AI agent. Read-only, safe to
    /// call from other contracts (used by `CharityEscrow`).
    pub fn is_agent(env: Env, agent: Address) -> bool {
        let agents: Vec<Address> = env
            .storage()
            .instance()
            .get(&DataKey::Agents)
            .unwrap_or(Vec::new(&env));
        Self::contains(&agents, &agent)
    }

    /// Returns the number of registered agents.
    pub fn agent_count(env: Env) -> u32 {
        let agents: Vec<Address> = env
            .storage()
            .instance()
            .get(&DataKey::Agents)
            .unwrap_or(Vec::new(&env));
        agents.len()
    }

    /// Returns the configured admin address.
    pub fn get_admin(env: Env) -> Result<Address, RegistryError> {
        Self::check_initialized(&env)?;
        Ok(env.storage().instance().get(&DataKey::Admin).unwrap())
    }

    /// Returns `true` when the registry has been initialized.
    pub fn is_initialized(env: Env) -> bool {
        env.storage().instance().has(&DataKey::Initialized)
    }

    // ─────────────────────────── internal helpers ───────────────────────────

    fn check_initialized(env: &Env) -> Result<(), RegistryError> {
        if !env.storage().instance().has(&DataKey::Initialized) {
            return Err(RegistryError::NotInitialized);
        }
        Ok(())
    }

    fn check_admin(env: &Env, caller: &Address) -> Result<(), RegistryError> {
        let admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap();
        if admin != *caller {
            return Err(RegistryError::Unauthorized);
        }
        Ok(())
    }

    fn contains(agents: &Vec<Address>, target: &Address) -> bool {
        let mut i: u32 = 0;
        while i < agents.len() {
            if agents.get(i).unwrap() == *target {
                return true;
            }
            i += 1;
        }
        false
    }
}

#[cfg(test)]
mod test {
    use super::*;
    use soroban_sdk::testutils::{Address as _, Events as _};
    use soroban_sdk::{Env, Event};

    fn setup(env: &Env) -> (Address, Address, Address, AgentRegistryClient) {
        env.mock_all_auths();
        let admin = Address::generate(env);
        let contract_id = env.register(AgentRegistry, ());
        let client = AgentRegistryClient::new(env, &contract_id);
        client.initialize(&admin);
        (admin, Address::generate(env), contract_id, client)
    }

    #[test]
    fn test_initialize_and_state() {
        let env = Env::default();
        env.mock_all_auths();
        let admin = Address::generate(&env);
        let contract_id = env.register(AgentRegistry, ());
        let client = AgentRegistryClient::new(&env, &contract_id);

        assert!(!client.is_initialized());
        client.initialize(&admin);
        assert!(client.is_initialized());
        assert_eq!(client.get_admin(), admin);
        assert_eq!(client.agent_count(), 0);

        let result = client.try_initialize(&admin);
        assert_eq!(result, Err(Ok(RegistryError::AlreadyInitialized)));
    }

    #[test]
    fn test_add_agent_is_agent_remove_agent() {
        let env = Env::default();
        let (admin, agent, _contract_id, client) = setup(&env);

        assert!(!client.is_agent(&agent));
        client.add_agent(&admin, &agent);
        assert!(client.is_agent(&agent));
        assert_eq!(client.agent_count(), 1);

        // Duplicate add is rejected.
        let duplicate = client.try_add_agent(&admin, &agent);
        assert_eq!(duplicate, Err(Ok(RegistryError::AgentAlreadyRegistered)));

        // Remove works and the agent is no longer authorized.
        client.remove_agent(&admin, &agent);
        assert!(!client.is_agent(&agent));
        assert_eq!(client.agent_count(), 0);

        // Removing a non-existent agent is rejected.
        let missing = client.try_remove_agent(&admin, &agent);
        assert_eq!(missing, Err(Ok(RegistryError::AgentNotFound)));
    }

    #[test]
    fn test_non_admin_cannot_manage_agents() {
        let env = Env::default();
        let (admin, agent, _contract_id, client) = setup(&env);
        let rogue = Address::generate(&env);

        let result = client.try_add_agent(&rogue, &agent);
        assert_eq!(result, Err(Ok(RegistryError::Unauthorized)));

        let result = client.try_remove_agent(&rogue, &agent);
        assert_eq!(result, Err(Ok(RegistryError::Unauthorized)));

        // Admin can still manage the registry afterwards.
        client.add_agent(&admin, &agent);
    }

    #[test]
    fn test_auth_required_for_add_agent() {
        // No mock_all_auths: only explicitly authorized callers succeed.
        let env = Env::default();
        let admin = Address::generate(&env);
        let contract_id = env.register(AgentRegistry, ());
        let client = AgentRegistryClient::new(&env, &contract_id);

        use soroban_sdk::testutils::{MockAuth, MockAuthInvoke};
        use soroban_sdk::{IntoVal, Vec};

        let init_auth = MockAuth {
            address: &admin,
            invoke: &MockAuthInvoke {
                contract: &contract_id,
                fn_name: "initialize",
                args: Vec::from_array(&env, [admin.clone().into_val(&env)]),
                sub_invokes: &[],
            },
        };
        env.mock_auths(&[init_auth]);
        client.initialize(&admin);

        // The configured admin calls add_agent WITHOUT authorizing → auth error.
        let result = client.try_add_agent(&admin, &Address::generate(&env));
        assert!(result.is_err());

        // Authorizing the admin lets the same call succeed.
        let agent = Address::generate(&env);
        let add_auth = MockAuth {
            address: &admin,
            invoke: &MockAuthInvoke {
                contract: &contract_id,
                fn_name: "add_agent",
                args: Vec::from_array(&env, [admin.clone().into_val(&env), agent.clone().into_val(&env)]),
                sub_invokes: &[],
            },
        };
        env.mock_auths(&[add_auth]);
        client.add_agent(&admin, &agent);
        assert!(client.is_agent(&agent));
    }

    #[test]
    fn test_events_emitted_on_manage() {
        let env = Env::default();
        let (admin, agent, contract_id, client) = setup(&env);

        // env.events().all() returns events from the *last* invocation only.
        client.add_agent(&admin, &agent);
        let events = env.events().all().filter_by_contract(&contract_id);
        assert_eq!(
            events,
            [AgentAdded {
                agent: agent.clone()
            }
            .to_xdr(&env, &contract_id)]
        );

        client.remove_agent(&admin, &agent);
        let events = env.events().all().filter_by_contract(&contract_id);
        assert_eq!(
            events,
            [AgentRemoved {
                agent: agent.clone()
            }
            .to_xdr(&env, &contract_id)]
        );
    }

    #[test]
    fn test_uninitialized_contract_errors() {
        let env = Env::default();
        env.mock_all_auths();
        let admin = Address::generate(&env);
        let agent = Address::generate(&env);
        let client = AgentRegistryClient::new(&env, &env.register(AgentRegistry, ()));

        let result = client.try_add_agent(&admin, &agent);
        assert_eq!(result, Err(Ok(RegistryError::NotInitialized)));

        let result = client.try_is_agent(&agent);
        // is_agent is total (never panics); returns false on uninitialized.
        assert_eq!(result, Ok(Ok(false)));
    }
}
